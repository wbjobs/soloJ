import struct
import math
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from collections import Counter


@dataclass
class FieldCandidate:
    offset: int
    length: int
    field_type: str
    confidence: float
    description: str = ""
    values: List[int] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "offset": self.offset,
            "length": self.length,
            "field_type": self.field_type,
            "confidence": round(self.confidence, 2),
            "description": self.description,
        }


@dataclass
class ProtocolStructure:
    total_length: int
    fields: List[FieldCandidate] = field(default_factory=list)
    byte_distribution: Dict[int, Counter] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "total_length": self.total_length,
            "fields": [f.to_dict() for f in self.fields],
            "recommendations": self.recommendations,
        }


class ProtocolInferer:
    def __init__(self, min_packets: int = 5):
        self.min_packets = min_packets
        self.packets: List[bytes] = []
        self._invalid_packets = 0

    def add_packet(self, payload) -> bool:
        if payload is None:
            self._invalid_packets += 1
            return False
        
        if isinstance(payload, str):
            try:
                payload = bytes.fromhex(payload)
            except (ValueError, TypeError) as e:
                try:
                    payload = payload.encode('latin-1', errors='replace')
                except Exception:
                    self._invalid_packets += 1
                    return False
        elif not isinstance(payload, (bytes, bytearray, memoryview)):
            self._invalid_packets += 1
            return False
        
        try:
            if len(payload) == 0:
                return False
            
            if isinstance(payload, (bytearray, memoryview)):
                payload = bytes(payload)
            
            self.packets.append(payload)
            return True
        except Exception as e:
            self._invalid_packets += 1
            return False

    def clear(self):
        self.packets.clear()
        self._invalid_packets = 0

    def _safe_get_byte(self, data, index: int) -> Optional[int]:
        try:
            if 0 <= index < len(data):
                val = data[index]
                if isinstance(val, int) and 0 <= val <= 255:
                    return val
            return None
        except Exception:
            return None

    def _calculate_byte_distribution(self) -> Dict[int, Counter]:
        distribution: Dict[int, Counter] = {}
        if not self.packets:
            return distribution
        
        try:
            max_len = max(len(p) for p in self.packets)
        except (ValueError, TypeError):
            return distribution
        
        for i in range(max_len):
            counter: Counter = Counter()
            for packet in self.packets:
                try:
                    if i < len(packet):
                        val = packet[i]
                        if isinstance(val, int) and 0 <= val <= 255:
                            counter[val] += 1
                except Exception:
                    continue
            if counter:
                distribution[i] = counter
        
        return distribution

    def _entropy(self, counter: Counter) -> float:
        try:
            total = sum(counter.values())
            if total == 0:
                return 0.0
            ent = 0.0
            for count in counter.values():
                try:
                    p = count / total
                    if p > 0:
                        ent -= p * math.log2(p)
                except Exception:
                    continue
            return ent
        except Exception:
            return 0.0

    def _detect_length_prefix(self, byte_dist: Dict[int, Counter]) -> List[FieldCandidate]:
        candidates: List[FieldCandidate] = []
        if not self.packets:
            return candidates

        try:
            packet_lengths = [len(p) for p in self.packets]
            min_len = min(packet_lengths) if packet_lengths else 0
        except (ValueError, TypeError):
            return candidates

        max_offset = min(8, min_len - 1) if min_len > 1 else 0
        
        for offset in range(max_offset + 1):
            for length in [1, 2, 4]:
                if offset + length > min_len:
                    continue

                matches = 0
                values: List[int] = []
                valid_packets = 0
                
                for packet in self.packets:
                    try:
                        if len(packet) < offset + length:
                            continue
                        
                        valid_packets += 1
                        
                        if length == 1:
                            val = packet[offset]
                        elif length == 2:
                            val = struct.unpack('>H', packet[offset:offset+2])[0]
                        else:
                            val = struct.unpack('>I', packet[offset:offset+4])[0]
                        
                        if not isinstance(val, int) or val < 0:
                            continue
                            
                        values.append(val)
                        expected_len = len(packet) - offset - length
                        if val == expected_len:
                            matches += 1
                    except (struct.error, IndexError, TypeError, ValueError):
                        continue

                if valid_packets > 0:
                    try:
                        confidence = matches / valid_packets
                        if confidence > 0.3:
                            candidates.append(FieldCandidate(
                                offset=offset,
                                length=length,
                                field_type="length_prefix",
                                confidence=confidence,
                                description=f"可能的长度字段 (大端), 匹配 {matches}/{valid_packets} 个包",
                                values=values
                            ))
                    except (ZeroDivisionError, Exception):
                        continue

        return candidates

    def _detect_checksum(self, byte_dist: Dict[int, Counter]) -> List[FieldCandidate]:
        candidates: List[FieldCandidate] = []
        if len(self.packets) < 2:
            return candidates

        try:
            max_len = max(len(p) for p in self.packets)
        except (ValueError, TypeError):
            return candidates
        
        for offset in range(max_len):
            try:
                dist = byte_dist.get(offset, {})
                if not dist or len(dist) < len(self.packets) * 0.5:
                    continue

                ent = self._entropy(dist)
                if ent < 6.0:
                    continue
            except Exception:
                continue

            for length in [1, 2, 4]:
                if offset + length > max_len:
                    continue

                xor_matches = 0
                sum_matches = 0
                valid_packets = 0

                for packet in self.packets:
                    try:
                        if len(packet) < offset + length:
                            continue
                        
                        valid_packets += 1
                        body = packet[:offset]
                        checksum_bytes = packet[offset:offset+length]
                        
                        xor_calc = 0
                        for b in body:
                            if isinstance(b, int):
                                xor_calc ^= b
                        
                        mask = 0xFF if length == 1 else (0xFFFF if length == 2 else 0xFFFFFFFF)
                        sum_calc = sum(b for b in body if isinstance(b, int)) & mask
                        
                        checksum_val = int.from_bytes(checksum_bytes, 'big')
                        
                        if xor_calc == checksum_val:
                            xor_matches += 1
                        if sum_calc == checksum_val:
                            sum_matches += 1
                    except (IndexError, TypeError, ValueError, struct.error):
                        continue

                if valid_packets > 0:
                    try:
                        if xor_matches / valid_packets > 0.5:
                            candidates.append(FieldCandidate(
                                offset=offset,
                                length=length,
                                field_type="checksum_xor",
                                confidence=xor_matches / valid_packets,
                                description=f"XOR 校验和, 匹配 {xor_matches}/{valid_packets}"
                            ))
                        if sum_matches / valid_packets > 0.5:
                            candidates.append(FieldCandidate(
                                offset=offset,
                                length=length,
                                field_type="checksum_sum",
                                confidence=sum_matches / valid_packets,
                                description=f"SUM 校验和, 匹配 {sum_matches}/{valid_packets}"
                            ))
                    except (ZeroDivisionError, Exception):
                        continue

        return candidates

    def _detect_sequence_number(self, byte_dist: Dict[int, Counter]) -> List[FieldCandidate]:
        candidates: List[FieldCandidate] = []
        if len(self.packets) < 4:
            return candidates

        try:
            max_len = max(len(p) for p in self.packets)
            min_len = min(len(p) for p in self.packets)
        except (ValueError, TypeError):
            return candidates
        
        for offset in range(max_len):
            for length in [1, 2, 4]:
                if offset + length > min_len:
                    continue

                sequences: List[int] = []
                for packet in self.packets:
                    try:
                        val = int.from_bytes(packet[offset:offset+length], 'big')
                        sequences.append(val)
                    except (IndexError, TypeError, ValueError):
                        continue

                if len(sequences) < 2:
                    continue

                increasing = 0
                for i in range(1, len(sequences)):
                    try:
                        if sequences[i] > sequences[i-1]:
                            increasing += 1
                    except Exception:
                        continue

                try:
                    confidence = increasing / (len(sequences) - 1)
                    if confidence > 0.6:
                        unique_vals = len(set(sequences))
                        candidates.append(FieldCandidate(
                            offset=offset,
                            length=length,
                            field_type="sequence_number",
                            confidence=confidence,
                            description=f"序列号/计数器, 递增率 {int(confidence*100)}%, 唯一值 {unique_vals}",
                            values=sequences
                        ))
                except (ZeroDivisionError, Exception):
                    continue

        return candidates

    def _detect_fixed_fields(self, byte_dist: Dict[int, Counter]) -> List[FieldCandidate]:
        candidates: List[FieldCandidate] = []
        if not self.packets:
            return candidates
        
        try:
            max_len = max(len(p) for p in self.packets)
        except (ValueError, TypeError):
            return candidates

        for offset in range(max_len):
            try:
                counter = byte_dist.get(offset, {})
                if not counter:
                    continue

                most_common = counter.most_common(1)
                if not most_common:
                    continue

                val, count = most_common[0]
                total = len(self.packets)

                if count == total and total >= self.min_packets:
                    try:
                        desc = f"固定值 0x{val:02X}, 出现在所有包中"
                    except (TypeError, ValueError):
                        desc = f"固定值, 出现在所有包中"
                    candidates.append(FieldCandidate(
                        offset=offset,
                        length=1,
                        field_type="magic_byte",
                        confidence=1.0,
                        description=desc
                    ))
                elif count / total > 0.8 and total >= self.min_packets:
                    try:
                        desc = f"常数值 0x{val:02X}, 出现 {count}/{total}"
                    except (TypeError, ValueError):
                        desc = f"常数值, 出现 {count}/{total}"
                    candidates.append(FieldCandidate(
                        offset=offset,
                        length=1,
                        field_type="constant_like",
                        confidence=count / total,
                        description=desc
                    ))
            except Exception:
                continue

        return candidates

    def _detect_message_type(self, byte_dist: Dict[int, Counter]) -> List[FieldCandidate]:
        candidates: List[FieldCandidate] = []
        if len(self.packets) < self.min_packets:
            return candidates

        try:
            max_len = max(len(p) for p in self.packets)
        except (ValueError, TypeError):
            return candidates

        for offset in range(min(16, max_len)):
            try:
                counter = byte_dist.get(offset, {})
                if not counter:
                    continue

                unique_vals = len(counter)
                total = len(self.packets)

                if 2 <= unique_vals <= 32 and total >= self.min_packets:
                    ent = self._entropy(counter)
                    if 1.0 <= ent <= 5.0:
                        try:
                            ent_str = f"{ent:.2f}"
                        except Exception:
                            ent_str = "N/A"
                        candidates.append(FieldCandidate(
                            offset=offset,
                            length=1,
                            field_type="message_type",
                            confidence=min(1.0, unique_vals / 8.0),
                            description=f"可能的消息类型, {unique_vals} 种不同值, 熵 {ent_str}"
                        ))
            except Exception:
                continue

        return candidates

    def infer_structure(self) -> ProtocolStructure:
        if not self.packets:
            recs = ["没有足够的数据包进行分析"]
            if self._invalid_packets > 0:
                recs.append(f"已跳过 {self._invalid_packets} 个无效数据包")
            return ProtocolStructure(total_length=0, recommendations=recs)

        try:
            byte_dist = self._calculate_byte_distribution()
            max_len = max(len(p) for p in self.packets)
            
            structure = ProtocolStructure(
                total_length=max_len,
                byte_distribution=byte_dist
            )

            all_candidates: List[FieldCandidate] = []
            all_candidates.extend(self._detect_fixed_fields(byte_dist))
            all_candidates.extend(self._detect_length_prefix(byte_dist))
            all_candidates.extend(self._detect_sequence_number(byte_dist))
            all_candidates.extend(self._detect_message_type(byte_dist))
            all_candidates.extend(self._detect_checksum(byte_dist))

            all_candidates.sort(key=lambda x: (-x.confidence, x.offset))

            used_offsets: set = set()
            for candidate in all_candidates:
                try:
                    overlap = False
                    for o in range(candidate.offset, candidate.offset + candidate.length):
                        if o in used_offsets:
                            overlap = True
                            break
                    
                    if not overlap and candidate.confidence >= 0.3:
                        structure.fields.append(candidate)
                        for o in range(candidate.offset, candidate.offset + candidate.length):
                            used_offsets.add(o)
                except Exception:
                    continue

            structure.fields.sort(key=lambda x: x.offset)

            structure.recommendations = self._generate_recommendations(structure)
            
            if self._invalid_packets > 0:
                structure.recommendations.append(
                    f"分析过程中跳过 {self._invalid_packets} 个无效数据包"
                )
            
            return structure
        except Exception as e:
            return ProtocolStructure(
                total_length=0,
                recommendations=[f"分析过程中发生错误: {str(e)}"]
            )

    def _generate_recommendations(self, structure: ProtocolStructure) -> List[str]:
        recs: List[str] = []
        try:
            offsets_with_fields: set = set()
            for f in structure.fields:
                for o in range(f.offset, f.offset + f.length):
                    offsets_with_fields.add(o)

            unanalyzed: List[int] = []
            for o in range(structure.total_length):
                if o not in offsets_with_fields:
                    unanalyzed.append(o)

            if unanalyzed:
                ranges: List[Tuple[int, int]] = []
                start = unanalyzed[0]
                for i in range(1, len(unanalyzed)):
                    if unanalyzed[i] != unanalyzed[i-1] + 1:
                        ranges.append((start, unanalyzed[i-1]))
                        start = unanalyzed[i]
                ranges.append((start, unanalyzed[-1]))
                
                for start, end in ranges:
                    length = end - start + 1
                    if length >= 4:
                        recs.append(f"偏移 {start}-{end} (长度 {length}) 可能是数据载荷区域")

            if len(self.packets) < 10:
                recs.append(f"建议收集更多数据包 (当前 {len(self.packets)} 个, 推荐至少 10 个) 以提高推断准确度")

            has_length = any(f.field_type == "length_prefix" for f in structure.fields)
            if not has_length and len(self.packets) >= 5:
                recs.append("未检测到明显的长度前缀字段，可能使用固定长度或其他编码方式")
        except Exception:
            pass

        return recs

    def print_analysis(self, structure: Optional[ProtocolStructure] = None):
        try:
            if structure is None:
                structure = self.infer_structure()

            print("\n" + "="*60)
            print("协议结构推断分析报告")
            print("="*60)
            print(f"分析的数据包数量: {len(self.packets)}")
            if self._invalid_packets > 0:
                print(f"跳过的无效数据包: {self._invalid_packets}")
            print(f"最大数据包长度: {structure.total_length} 字节")
            print("-" * 60)

            if not structure.fields:
                print("未检测到显著的字段模式")
            else:
                print(f"检测到 {len(structure.fields)} 个候选字段:")
                print("-" * 60)
                for i, field in enumerate(structure.fields, 1):
                    try:
                        print(f"{i}. 偏移 {field.offset}-{field.offset + field.length - 1} "
                              f"(长度 {field.length} 字节)")
                        print(f"   类型: {field.field_type}")
                        try:
                            print(f"   置信度: {field.confidence:.1%}")
                        except (TypeError, ValueError):
                            print(f"   置信度: N/A")
                        desc = field.description or "N/A"
                        try:
                            print(f"   描述: {desc}")
                        except (UnicodeEncodeError, Exception):
                            print(f"   描述: [编码无法显示]")
                        print()
                    except Exception:
                        continue

            if structure.recommendations:
                print("-" * 60)
                print("建议:")
                for rec in structure.recommendations:
                    try:
                        print(f"  - {rec}")
                    except (UnicodeEncodeError, Exception):
                        print(f"  - [编码无法显示]")
            print("="*60 + "\n")
        except Exception as e:
            print(f"\n[错误] 打印分析结果时出错: {e}\n")
