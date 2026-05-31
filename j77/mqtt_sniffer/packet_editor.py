import struct
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Callable
from datetime import datetime

from .storage import SQLiteStorage
from .sniffer import MQTTSniffer, MQTTPacket


@dataclass
class Modification:
    offset: int
    operation: str
    value: Optional[int] = None
    bit_position: Optional[int] = None
    
    def apply(self, data: bytes) -> bytes:
        if self.offset >= len(data):
            raise IndexError(f"Offset {self.offset} out of range (payload length: {len(data)})")
        
        data_list = list(data)
        original = data_list[self.offset]
        
        if self.operation == "flip_bit":
            if self.bit_position is None:
                raise ValueError("bit_position required for flip_bit operation")
            if not (0 <= self.bit_position <= 7):
                raise ValueError("bit_position must be 0-7")
            data_list[self.offset] ^= (1 << self.bit_position)
        
        elif self.operation == "set_bit":
            if self.bit_position is None:
                raise ValueError("bit_position required for set_bit operation")
            data_list[self.offset] |= (1 << self.bit_position)
        
        elif self.operation == "clear_bit":
            if self.bit_position is None:
                raise ValueError("bit_position required for clear_bit operation")
            data_list[self.offset] &= ~(1 << self.bit_position)
        
        elif self.operation == "set_byte":
            if self.value is None:
                raise ValueError("value required for set_byte operation")
            if not (0 <= self.value <= 255):
                raise ValueError("value must be 0-255")
            data_list[self.offset] = self.value
        
        elif self.operation == "add":
            if self.value is None:
                raise ValueError("value required for add operation")
            data_list[self.offset] = (data_list[self.offset] + self.value) & 0xFF
        
        elif self.operation == "sub":
            if self.value is None:
                raise ValueError("value required for sub operation")
            data_list[self.offset] = (data_list[self.offset] - self.value) & 0xFF
        
        elif self.operation == "xor":
            if self.value is None:
                raise ValueError("value required for xor operation")
            data_list[self.offset] ^= self.value
        
        elif self.operation == "flip_all_bits":
            data_list[self.offset] ^= 0xFF
        
        else:
            raise ValueError(f"Unknown operation: {self.operation}")
        
        return bytes(data_list)
    
    def describe(self) -> str:
        op_names = {
            "flip_bit": f"翻转第 {self.bit_position} 位",
            "set_bit": f"置位第 {self.bit_position} 位",
            "clear_bit": f"清零第 {self.bit_position} 位",
            "set_byte": f"设置为 0x{self.value:02X}" if self.value is not None else "设置字节",
            "add": f"加 {self.value}" if self.value is not None else "加法",
            "sub": f"减 {self.value}" if self.value is not None else "减法",
            "xor": f"异或 0x{self.value:02X}" if self.value is not None else "异或",
            "flip_all_bits": "翻转所有位",
        }
        return f"偏移 {self.offset}: {op_names.get(self.operation, self.operation)}"


@dataclass
class EditResult:
    original_packet_id: int
    original_payload: bytes
    modified_payload: bytes
    modifications: List[Modification]
    published: bool = False
    new_topic: Optional[str] = None
    publish_mid: Optional[int] = None
    
    def to_dict(self) -> Dict:
        return {
            "original_packet_id": self.original_packet_id,
            "original_payload": self.original_payload.hex(),
            "modified_payload": self.modified_payload.hex(),
            "modifications": [
                {"offset": m.offset, "operation": m.operation, "value": m.value, "bit_position": m.bit_position}
                for m in self.modifications
            ],
            "published": self.published,
            "new_topic": self.new_topic,
            "publish_mid": self.publish_mid,
        }


class PacketEditor:
    def __init__(self, storage: SQLiteStorage):
        self.storage = storage
        self.edit_history: List[EditResult] = []
    
    def get_packet_by_id(self, packet_id: int) -> Optional[Dict]:
        with self.storage.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM mqtt_packets WHERE id = ?', (packet_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def display_packet(self, packet: Dict, show_hex: bool = True):
        print("=" * 70)
        print(f"数据包 ID: {packet['id']}")
        print("=" * 70)
        print(f"时间: {packet.get('datetime', 'N/A')}")
        print(f"类型: {packet.get('packet_type', 'N/A')}")
        print(f"主题: {packet.get('topic', 'N/A')}")
        print(f"QoS: {packet.get('qos', 'N/A')}")
        print(f"长度: {packet.get('payload_length', 0)} bytes")
        
        payload_hex = packet.get('payload_hex')
        if payload_hex and show_hex:
            print(f"\n原始载荷 (十六进制):")
            self._print_hex_dump(bytes.fromhex(payload_hex))
        
        print("=" * 70)
    
    def _print_hex_dump(self, data: bytes):
        for i in range(0, len(data), 16):
            chunk = data[i:i+16]
            hex_part = ' '.join(f'{b:02X}' for b in chunk)
            ascii_part = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
            print(f"  {i:04X}: {hex_part:<48} {ascii_part}")
        
        print(f"\n字节索引:")
        for i in range(min(len(data), 16)):
            print(f"  [{i:2d}]", end='')
        print()
        for i in range(min(len(data), 16)):
            print(f"   {data[i]:02X}", end='')
        print()
        for i in range(min(len(data), 16)):
            bit_str = ''.join(str((data[i] >> (7-j)) & 1) for j in range(8))
            print(f"\n  [{i:2d}] bit 76543210 = {bit_str} (0x{data[i]:02X} = {data[i]:3d})", end='')
        print()
    
    def parse_modification(self, mod_str: str) -> Modification:
        parts = mod_str.split(':')
        if len(parts) < 2:
            raise ValueError(f"无效的修改格式: {mod_str}. 使用: offset:operation[:params]")
        
        try:
            offset = int(parts[0], 0)
        except ValueError:
            raise ValueError(f"无效的偏移量: {parts[0]}")
        
        operation = parts[1].lower()
        
        mod = Modification(offset=offset, operation=operation)
        
        if operation in ["flip_bit", "set_bit", "clear_bit"]:
            if len(parts) < 3:
                raise ValueError(f"{operation} 需要位位置参数")
            try:
                mod.bit_position = int(parts[2])
            except ValueError:
                raise ValueError(f"无效的位位置: {parts[2]}")
        
        elif operation in ["set_byte", "add", "sub", "xor"]:
            if len(parts) < 3:
                raise ValueError(f"{operation} 需要值参数")
            try:
                mod.value = int(parts[2], 0)
            except ValueError:
                raise ValueError(f"无效的值: {parts[2]}")
        
        return mod
    
    def apply_modifications(self, payload: bytes, modifications: List[Modification]) -> bytes:
        result = payload
        for mod in modifications:
            result = mod.apply(result)
        return result
    
    def edit_and_publish(self, packet_id: int, modifications: List[Modification],
                         broker_host: str = "localhost", broker_port: int = 1883,
                         username: Optional[str] = None, password: Optional[str] = None,
                         new_topic: Optional[str] = None, qos: Optional[int] = None,
                         dry_run: bool = False) -> EditResult:
        
        packet_data = self.get_packet_by_id(packet_id)
        if not packet_data:
            raise ValueError(f"未找到数据包 ID: {packet_id}")
        
        payload_hex = packet_data.get('payload_hex')
        if not payload_hex:
            raise ValueError(f"数据包 {packet_id} 没有载荷数据")
        
        try:
            original_payload = bytes.fromhex(payload_hex)
        except ValueError as e:
            raise ValueError(f"载荷数据无效: {e}")
        
        self.display_packet(packet_data)
        
        print(f"\n应用修改:")
        for i, mod in enumerate(modifications, 1):
            print(f"  {i}. {mod.describe()}")
        
        try:
            modified_payload = self.apply_modifications(original_payload, modifications)
        except Exception as e:
            raise RuntimeError(f"应用修改失败: {e}")
        
        print(f"\n修改后的载荷:")
        self._print_hex_dump(modified_payload)
        
        print(f"\n原始:  {original_payload.hex()}")
        print(f"修改后: {modified_payload.hex()}")
        
        diff_positions = []
        for i in range(min(len(original_payload), len(modified_payload))):
            if original_payload[i] != modified_payload[i]:
                diff_positions.append(i)
        if diff_positions:
            diff_marker = ''.join('^' if i in diff_positions else ' ' for i in range(len(modified_payload)*3-1))
            print(f"        {diff_marker}")
            print(f"  差异位置: {diff_positions}")
        
        result = EditResult(
            original_packet_id=packet_id,
            original_payload=original_payload,
            modified_payload=modified_payload,
            modifications=modifications,
            new_topic=new_topic
        )
        
        if dry_run:
            print(f"\n[DRY RUN] 不会实际发布消息")
            return result
        
        topic = new_topic or packet_data.get('topic')
        publish_qos = qos if qos is not None else packet_data.get('qos', 0)
        
        print(f"\n发布到主题: {topic} (QoS {publish_qos})")
        
        sniffer = MQTTSniffer(
            host=broker_host,
            port=broker_port,
            username=username,
            password=password
        )
        
        try:
            sniffer.start()
            mid = sniffer.publish(topic, modified_payload, qos=publish_qos)
            result.published = True
            result.publish_mid = mid
            print(f"[+] 消息已发布，消息 ID: {mid}")
        except Exception as e:
            print(f"[-] 发布失败: {e}")
            raise
        finally:
            sniffer.stop()
        
        self.edit_history.append(result)
        return result
    
    def interactive_edit(self, packet_id: int, broker_host: str = "localhost",
                         broker_port: int = 1883, username: Optional[str] = None,
                         password: Optional[str] = None):
        
        packet_data = self.get_packet_by_id(packet_id)
        if not packet_data:
            print(f"[-] 未找到数据包 ID: {packet_id}")
            return
        
        self.display_packet(packet_data)
        
        payload_hex = packet_data.get('payload_hex')
        if not payload_hex:
            print("[-] 该数据包没有载荷数据")
            return
        
        original_payload = bytes.fromhex(payload_hex)
        current_payload = original_payload
        
        modifications: List[Modification] = []
        
        print("\n可用操作:")
        print("  flip_bit:offset:bit       - 翻转指定偏移的指定位 (0-7)")
        print("  set_bit:offset:bit        - 置位指定偏移的指定位")
        print("  clear_bit:offset:bit      - 清零指定偏移的指定位")
        print("  set_byte:offset:value     - 设置指定偏移的字节值 (十进制或 0x)")
        print("  add:offset:value          - 指定偏移字节加上值")
        print("  sub:offset:value          - 指定偏移字节减去值")
        print("  xor:offset:value          - 指定偏移字节异或值")
        print("  flip_all_bits:offset      - 翻转指定偏移的所有位")
        print("  undo                      - 撤销上一次修改")
        print("  reset                     - 重置为原始载荷")
        print("  show                      - 显示当前载荷")
        print("  topic [new_topic]         - 设置或查看发布主题")
        print("  publish                   - 发布修改后的消息")
        print("  quit                      - 退出\n")
        
        publish_topic = packet_data.get('topic', '')
        print(f"当前发布主题: {publish_topic}")
        
        while True:
            try:
                cmd = input(f"\n[{len(modifications)} 个修改] > ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n[*] 已取消")
                return
            
            if not cmd:
                continue
            
            if cmd.lower() in ['quit', 'exit', 'q']:
                break
            
            elif cmd.lower() == 'show':
                print("\n当前载荷:")
                self._print_hex_dump(current_payload)
                continue
            
            elif cmd.lower() == 'undo':
                if modifications:
                    modifications.pop()
                    current_payload = self.apply_modifications(original_payload, modifications)
                    print(f"[*] 已撤销，剩余 {len(modifications)} 个修改")
                else:
                    print("[!] 没有可撤销的修改")
                continue
            
            elif cmd.lower() == 'reset':
                modifications.clear()
                current_payload = original_payload
                print("[*] 已重置为原始载荷")
                continue
            
            elif cmd.lower().startswith('topic'):
                parts = cmd.split(maxsplit=1)
                if len(parts) > 1:
                    publish_topic = parts[1]
                    print(f"[*] 发布主题已设置为: {publish_topic}")
                else:
                    print(f"当前发布主题: {publish_topic}")
                continue
            
            elif cmd.lower() == 'publish':
                if not modifications:
                    confirm = input("[!] 没有应用任何修改，确定要发布原始消息吗? (y/N): ")
                    if confirm.lower() != 'y':
                        continue
                
                confirm = input(f"\n确定发布到 '{publish_topic}'? (y/N): ")
                if confirm.lower() != 'y':
                    continue
                
                self.edit_and_publish(
                    packet_id=packet_id,
                    modifications=modifications,
                    broker_host=broker_host,
                    broker_port=broker_port,
                    username=username,
                    password=password,
                    new_topic=publish_topic if publish_topic != packet_data.get('topic') else None
                )
                break
            
            else:
                try:
                    mod = self.parse_modification(cmd)
                    new_payload = mod.apply(current_payload)
                    modifications.append(mod)
                    current_payload = new_payload
                    print(f"[+] {mod.describe()}")
                    print(f"    偏移 {mod.offset}: 0x{original_payload[mod.offset]:02X} -> 0x{current_payload[mod.offset]:02X}")
                except Exception as e:
                    print(f"[-] {e}")
    
    def get_history(self) -> List[EditResult]:
        return self.edit_history
