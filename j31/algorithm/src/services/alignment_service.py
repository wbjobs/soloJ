import numpy as np
from typing import List, Dict, Tuple
import logging

logger = logging.getLogger(__name__)

class AlignmentService:
    def __init__(self):
        self.max_offset_search = 30.0
        self.coarse_step = 0.5
        self.fine_step = 0.01
        self.precision_step = 0.001
        
        self.min_acceptable_confidence = 0.3
        self.min_acceptable_match_rate = 0.5

    def calculate_offset(self, vad_segments: List[Dict], subtitle_segments: List[Dict]) -> Tuple[float, float]:
        if not vad_segments or not subtitle_segments:
            logger.warning("Empty segments, returning 0 offset")
            return 0.0, 0.0
        
        logger.info(f"Starting alignment: {len(vad_segments)} VAD segments, {len(subtitle_segments)} subtitle segments")
        
        vad_starts = np.array([seg['start'] for seg in vad_segments])
        vad_ends = np.array([seg['end'] for seg in vad_segments])
        sub_starts = np.array([seg['start'] for seg in subtitle_segments])
        sub_ends = np.array([seg['end'] for seg in subtitle_segments])
        
        vad_durations = vad_ends - vad_starts
        sub_durations = sub_ends - sub_starts
        
        vad_total_duration = np.sum(vad_durations)
        sub_total_duration = np.sum(sub_durations)
        
        duration_ratio = vad_total_duration / sub_total_duration if sub_total_duration > 0 else 1.0
        logger.info(f"Duration ratio (VAD/Sub): {duration_ratio:.3f}")
        
        if duration_ratio < 0.3 or duration_ratio > 3.0:
            logger.warning(f"Unusual duration ratio: {duration_ratio:.3f}, result may be unreliable")
        
        best_offset, best_score = self._multi_stage_search(
            vad_starts, vad_ends, sub_starts, sub_ends
        )
        
        logger.info(f"Coarse search result: offset={best_offset:.3f}s, score={best_score:.4f}")
        
        fine_offset, fine_score = self._fine_tune_offset(
            vad_starts, vad_ends, sub_starts, sub_ends,
            best_offset, search_range=2.0
        )
        
        logger.info(f"Fine search result: offset={fine_offset:.3f}s, score={fine_score:.4f}")
        
        precision_offset, precision_score = self._fine_tune_offset(
            vad_starts, vad_ends, sub_starts, sub_ends,
            fine_offset, search_range=0.2, step=self.precision_step
        )
        
        logger.info(f"Precision search result: offset={precision_offset:.4f}s, score={precision_score:.4f}")
        
        is_valid = self._validate_result(
            vad_segments, subtitle_segments, precision_offset, precision_score
        )
        
        if not is_valid:
            logger.warning("Primary alignment result validation failed, trying alternative methods")
            
            cross_corr_offset = self._cross_correlation_search(
                vad_starts, vad_ends, sub_starts, sub_ends
            )
            
            if cross_corr_offset is not None:
                logger.info(f"Cross-correlation result: {cross_corr_offset:.3f}s")
                
                if abs(cross_corr_offset - precision_offset) > 0.5:
                    cross_corr_score = self._calculate_overlap_score(
                        vad_starts, vad_ends, sub_starts, sub_ends, cross_corr_offset
                    )
                    
                    if cross_corr_score > precision_score * 0.9:
                        logger.info(f"Using cross-correlation result: {cross_corr_offset:.3f}s (score: {cross_corr_score:.4f})")
                        precision_offset = cross_corr_offset
                        precision_score = cross_corr_score
        
        confidence = self._calculate_confidence(
            precision_score, vad_segments, subtitle_segments, precision_offset
        )
        
        if abs(precision_offset) < 0.01 and confidence < 0.5:
            logger.warning("Offset near zero with low confidence, verifying if subtitle is already aligned")
            zero_offset_score = self._calculate_overlap_score(
                vad_starts, vad_ends, sub_starts, sub_ends, 0.0
            )
            if zero_offset_score > precision_score * 0.95:
                logger.info("Subtitle appears to be already aligned")
                precision_offset = 0.0
                precision_score = zero_offset_score
                confidence = max(confidence, 0.7)
        
        final_offset = round(precision_offset, 3)
        final_confidence = round(confidence, 3)
        
        logger.info(f"Final alignment result: offset={final_offset}s, confidence={final_confidence}")
        
        return final_offset, final_confidence
    
    def _multi_stage_search(self, vad_starts: np.ndarray, vad_ends: np.ndarray,
                           sub_starts: np.ndarray, sub_ends: np.ndarray) -> Tuple[float, float]:
        
        best_offset = 0.0
        best_score = 0.0
        
        offsets_coarse = np.arange(-self.max_offset_search, self.max_offset_search + self.coarse_step, self.coarse_step)
        
        scores = np.zeros_like(offsets_coarse)
        for i, offset in enumerate(offsets_coarse):
            scores[i] = self._calculate_overlap_score(vad_starts, vad_ends, sub_starts, sub_ends, offset)
        
        top_indices = np.argsort(scores)[-5:]
        
        for idx in top_indices:
            candidate_offset = offsets_coarse[idx]
            candidate_score = scores[idx]
            
            fine_range = self.coarse_step * 2
            fine_offsets = np.arange(
                candidate_offset - fine_range,
                candidate_offset + fine_range + self.fine_step,
                self.fine_step
            )
            
            for f_offset in fine_offsets:
                f_score = self._calculate_overlap_score(vad_starts, vad_ends, sub_starts, sub_ends, f_offset)
                if f_score > best_score:
                    best_score = f_score
                    best_offset = f_offset
        
        return best_offset, best_score
    
    def _cross_correlation_search(self, vad_starts: np.ndarray, vad_ends: np.ndarray,
                                   sub_starts: np.ndarray, sub_ends: np.ndarray) -> float:
        try:
            max_time = max(np.max(vad_ends), np.max(sub_ends))
            resolution = 0.1
            
            vad_signal = self._segments_to_signal(vad_starts, vad_ends, max_time, resolution)
            sub_signal = self._segments_to_signal(sub_starts, sub_ends, max_time, resolution)
            
            vad_signal = vad_signal - np.mean(vad_signal)
            sub_signal = sub_signal - np.mean(sub_signal)
            
            correlation = np.correlate(vad_signal, sub_signal, mode='full')
            max_corr_idx = np.argmax(correlation)
            
            lag_samples = max_corr_idx - (len(sub_signal) - 1)
            lag_seconds = lag_samples * resolution
            
            if -self.max_offset_search <= lag_seconds <= self.max_offset_search:
                return lag_seconds
            
        except Exception as e:
            logger.error(f"Cross-correlation search failed: {str(e)}")
        
        return None
    
    def _segments_to_signal(self, starts: np.ndarray, ends: np.ndarray, 
                            max_time: float, resolution: float) -> np.ndarray:
        num_samples = int(max_time / resolution) + 1
        signal = np.zeros(num_samples)
        
        for start, end in zip(starts, ends):
            start_idx = int(start / resolution)
            end_idx = int(end / resolution)
            start_idx = max(0, min(num_samples - 1, start_idx))
            end_idx = max(0, min(num_samples, end_idx))
            signal[start_idx:end_idx] = 1.0
        
        return signal
    
    def _calculate_overlap_score(self, vad_starts: np.ndarray, vad_ends: np.ndarray,
                                 sub_starts: np.ndarray, sub_ends: np.ndarray, 
                                 offset: float) -> float:
        shifted_sub_starts = sub_starts + offset
        shifted_sub_ends = sub_ends + offset
        
        shifted_sub_starts = np.maximum(0, shifted_sub_starts)
        shifted_sub_ends = np.maximum(0.01, shifted_sub_ends)
        
        valid_mask = shifted_sub_ends > shifted_sub_starts
        if not np.any(valid_mask):
            return 0.0
        
        shifted_sub_starts = shifted_sub_starts[valid_mask]
        shifted_sub_ends = shifted_sub_ends[valid_mask]
        
        total_overlap = 0.0
        total_sub_duration = np.sum(shifted_sub_ends - shifted_sub_starts)
        
        if total_sub_duration <= 0:
            return 0.0
        
        start_overlaps = np.maximum.outer(vad_starts, shifted_sub_starts)
        end_overlaps = np.minimum.outer(vad_ends, shifted_sub_ends)
        
        overlaps = np.maximum(0, end_overlaps - start_overlaps)
        total_overlap = np.sum(overlaps)
        
        overlap_ratio = total_overlap / total_sub_duration
        
        vad_coverage = self._calculate_vad_coverage(vad_starts, vad_ends, shifted_sub_starts, shifted_sub_ends)
        
        start_alignment_score = self._calculate_start_alignment_score(vad_starts, shifted_sub_starts)
        
        combined_score = (
            overlap_ratio * 0.6 +
            vad_coverage * 0.25 +
            start_alignment_score * 0.15
        )
        
        return max(0.0, min(1.0, combined_score))
    
    def _calculate_vad_coverage(self, vad_starts: np.ndarray, vad_ends: np.ndarray,
                                sub_starts: np.ndarray, sub_ends: np.ndarray) -> float:
        if len(vad_starts) == 0:
            return 0.0
        
        vad_covered_by_sub = 0.0
        total_vad_duration = np.sum(vad_ends - vad_starts)
        
        if total_vad_duration <= 0:
            return 0.0
        
        for vad_start, vad_end in zip(vad_starts, vad_ends):
            overlap_starts = np.maximum(vad_start, sub_starts)
            overlap_ends = np.minimum(vad_end, sub_ends)
            overlaps = np.maximum(0, overlap_ends - overlap_starts)
            vad_covered_by_sub += np.sum(overlaps)
        
        return vad_covered_by_sub / total_vad_duration
    
    def _calculate_start_alignment_score(self, vad_starts: np.ndarray, sub_starts: np.ndarray) -> float:
        if len(vad_starts) == 0 or len(sub_starts) == 0:
            return 0.0
        
        threshold = 0.5
        
        matched_starts = 0
        for sub_start in sub_starts:
            time_diffs = np.abs(vad_starts - sub_start)
            if np.any(time_diffs < threshold):
                matched_starts += 1
        
        return matched_starts / len(sub_starts)
    
    def _fine_tune_offset(self, vad_starts: np.ndarray, vad_ends: np.ndarray,
                         sub_starts: np.ndarray, sub_ends: np.ndarray,
                         initial_offset: float, search_range: float = 2.0,
                         step: float = 0.01) -> Tuple[float, float]:
        
        best_offset = initial_offset
        best_score = self._calculate_overlap_score(vad_starts, vad_ends, sub_starts, sub_ends, initial_offset)
        
        search_start = initial_offset - search_range
        search_end = initial_offset + search_range + step
        
        current_offset = search_start
        while current_offset <= search_end:
            score = self._calculate_overlap_score(vad_starts, vad_ends, sub_starts, sub_ends, current_offset)
            if score > best_score:
                best_score = score
                best_offset = current_offset
            current_offset += step
        
        return round(best_offset, 4), round(best_score, 6)
    
    def _validate_result(self, vad_segments: List[Dict], subtitle_segments: List[Dict],
                         offset: float, score: float) -> bool:
        if len(vad_segments) < 3 or len(subtitle_segments) < 3:
            logger.warning("Too few segments for reliable validation")
            return True
        
        if score < 0.1:
            logger.warning(f"Score too low: {score:.4f}")
            return False
        
        vad_starts = np.array([seg['start'] for seg in vad_segments])
        sub_starts = np.array([seg['start'] + offset for seg in subtitle_segments])
        
        matched_count = 0
        for sub_start in sub_starts:
            min_diff = np.min(np.abs(vad_starts - sub_start))
            if min_diff < 1.0:
                matched_count += 1
        
        match_rate = matched_count / len(sub_starts) if len(sub_starts) > 0 else 0
        
        if match_rate < self.min_acceptable_match_rate:
            logger.warning(f"Match rate too low: {match_rate:.3f}")
            return False
        
        if abs(offset) > self.max_offset_search * 0.9:
            logger.warning(f"Offset near search boundary: {offset:.3f}s")
            return False
        
        half_offset = offset / 2
        half_score = self._calculate_overlap_score(
            np.array([s['start'] for s in vad_segments]),
            np.array([s['end'] for s in vad_segments]),
            np.array([s['start'] for s in subtitle_segments]),
            np.array([s['end'] for s in subtitle_segments]),
            half_offset
        )
        
        if half_score > score * 0.8 and abs(half_offset) > 0.5:
            logger.warning(f"Half offset score too close: {half_score:.4f} vs {score:.4f}")
            return False
        
        return True
    
    def _calculate_confidence(self, best_score: float, vad_segments: List[Dict], 
                              subtitle_segments: List[Dict], offset: float) -> float:
        if not vad_segments or not subtitle_segments:
            return 0.0
        
        vad_duration = sum(seg['end'] - seg['start'] for seg in vad_segments)
        sub_duration = sum(seg['end'] - seg['start'] for seg in subtitle_segments)
        
        if sub_duration == 0:
            return 0.0
        
        duration_ratio = min(vad_duration / sub_duration, sub_duration / vad_duration) if sub_duration > 0 else 0
        
        vad_count = len(vad_segments)
        sub_count = len(subtitle_segments)
        count_ratio = min(vad_count / sub_count, sub_count / vad_count) if sub_count > 0 else 0
        
        precision_penalty = 1.0
        if abs(offset - round(offset, 1)) > 0.001:
            precision_penalty = 0.95
        
        score_weight = 0.45
        duration_weight = 0.25
        count_weight = 0.2
        precision_weight = 0.1
        
        confidence = (
            best_score * score_weight +
            duration_ratio * duration_weight +
            count_ratio * count_weight +
            precision_penalty * precision_weight
        )
        
        if best_score > 0.6:
            confidence = min(1.0, confidence + 0.1)
        elif best_score < 0.2:
            confidence = max(0.0, confidence - 0.2)
        
        if abs(offset) < 0.1 and best_score > 0.5:
            confidence = max(confidence, 0.8)
        
        if vad_count < 5 or sub_count < 5:
            confidence *= 0.8
        
        return max(0.0, min(1.0, confidence))
    
    def apply_offset(self, segments: List[Dict], offset: float) -> List[Dict]:
        aligned_segments = []
        for seg in segments:
            new_start = max(0, seg['start'] + offset)
            new_end = max(0.001, seg['end'] + offset)
            
            if new_end <= new_start:
                new_end = new_start + 0.001
            
            aligned_segments.append({
                **seg,
                'start': round(new_start, 3),
                'end': round(new_end, 3)
            })
        
        return aligned_segments
    
    def get_alignment_report(self, vad_segments: List[Dict], subtitle_segments: List[Dict],
                             offset: float) -> Dict:
        if not vad_segments or not subtitle_segments:
            return {
                "total_vad_segments": 0,
                "total_subtitle_segments": 0,
                "matched_segments": 0,
                "unmatched_subtitles": [],
                "alignment_score": 0.0
            }
        
        matched_count = 0
        unmatched = []
        avg_time_diff = 0.0
        
        vad_ranges = [(seg['start'], seg['end']) for seg in vad_segments]
        vad_starts = np.array([seg['start'] for seg in vad_segments])
        
        for sub in subtitle_segments:
            shifted_start = sub['start'] + offset
            shifted_end = sub['end'] + offset
            
            is_matched = False
            min_start_diff = float('inf')
            
            for vad_start, vad_end in vad_ranges:
                overlap_start = max(vad_start, shifted_start)
                overlap_end = min(vad_end, shifted_end)
                overlap_duration = max(0, overlap_end - overlap_start)
                sub_duration = shifted_end - shifted_start
                
                if sub_duration > 0 and overlap_duration / sub_duration > 0.5:
                    is_matched = True
                    matched_count += 1
                
                start_diff = abs(vad_start - shifted_start)
                if start_diff < min_start_diff:
                    min_start_diff = start_diff
            
            avg_time_diff += min_start_diff
            
            if not is_matched:
                unmatched.append({
                    "index": sub.get('index'),
                    "start": round(shifted_start, 3),
                    "end": round(shifted_end, 3),
                    "text": sub.get('text', '')[:50],
                    "nearest_vad_diff": round(min_start_diff, 3)
                })
        
        avg_time_diff = avg_time_diff / len(subtitle_segments) if subtitle_segments else 0
        
        vad_starts_arr = np.array([s['start'] for s in vad_segments])
        vad_ends_arr = np.array([s['end'] for s in vad_segments])
        sub_starts_arr = np.array([s['start'] for s in subtitle_segments])
        sub_ends_arr = np.array([s['end'] for s in subtitle_segments])
        
        alignment_score = self._calculate_overlap_score(
            vad_starts_arr, vad_ends_arr, sub_starts_arr, sub_ends_arr, offset
        )
        
        return {
            "total_vad_segments": len(vad_segments),
            "total_subtitle_segments": len(subtitle_segments),
            "matched_segments": matched_count,
            "match_rate": round(matched_count / len(subtitle_segments) if subtitle_segments else 0, 3),
            "average_start_diff": round(avg_time_diff, 3),
            "alignment_score": round(alignment_score, 4),
            "unmatched_subtitles": unmatched[:20],
            "has_more_unmatched": len(unmatched) > 20
        }
    
    def get_alternative_offsets(self, vad_segments: List[Dict], subtitle_segments: List[Dict],
                                current_offset: float, top_n: int = 3) -> List[Dict]:
        if len(vad_segments) < 3 or len(subtitle_segments) < 3:
            return []
        
        vad_starts = np.array([seg['start'] for seg in vad_segments])
        vad_ends = np.array([seg['end'] for seg in vad_segments])
        sub_starts = np.array([seg['start'] for seg in subtitle_segments])
        sub_ends = np.array([seg['end'] for seg in subtitle_segments])
        
        offsets = np.arange(-10.0, 10.0, 0.1)
        scores = []
        
        for offset in offsets:
            if abs(offset - current_offset) < 0.2:
                continue
            score = self._calculate_overlap_score(vad_starts, vad_ends, sub_starts, sub_ends, offset)
            scores.append((offset, score))
        
        scores.sort(key=lambda x: x[1], reverse=True)
        
        alternatives = []
        for offset, score in scores[:top_n]:
            confidence = self._calculate_confidence(score, vad_segments, subtitle_segments, offset)
            alternatives.append({
                "offset": round(offset, 2),
                "score": round(score, 4),
                "confidence": round(confidence, 3)
            })
        
        return alternatives
