import numpy as np
import soundfile as sf
import logging
from typing import List, Dict, Tuple
from scipy import signal
from scipy.ndimage import median_filter

logger = logging.getLogger(__name__)

class VADService:
    def __init__(self, aggressiveness: int = 2):
        self.aggressiveness = aggressiveness
        self.sample_rate = 16000
        self.frame_duration = 30
        self.frame_size = int(self.sample_rate * self.frame_duration / 1000)
        self.hop_size = int(self.sample_rate * 0.015)
        
        self.voice_freq_low = 80
        self.voice_freq_high = 4000
        self.music_dominant_freq_low = 20
        self.music_dominant_freq_high = 20000
        
        self.min_voice_segment_duration = 0.1
        self.max_gap_between_segments = 0.3
        
        self.energy_weight = 0.3
        self.spectral_centroid_weight = 0.25
        self.zcr_weight = 0.2
        self.band_energy_ratio_weight = 0.25

    def detect_voice_activity(self, audio_path: str) -> List[Dict[str, float]]:
        try:
            audio, sr = sf.read(audio_path)
            
            if len(audio.shape) > 1:
                audio = audio[:, 0]
            
            if sr != self.sample_rate:
                logger.info(f"Resampling from {sr} Hz to {self.sample_rate} Hz")
                audio = self._resample(audio, sr, self.sample_rate)
                sr = self.sample_rate
            
            logger.info("Applying audio preprocessing...")
            audio = self._preprocess_audio(audio, sr)
            
            logger.info("Running enhanced VAD detection...")
            segments = self._enhanced_vad(audio, sr)
            
            logger.info(f"Found {len(segments)} voice segments after filtering")
            return segments
            
        except Exception as e:
            logger.error(f"VAD detection failed: {str(e)}", exc_info=True)
            raise

    def _resample(self, audio: np.ndarray, original_sr: int, target_sr: int) -> np.ndarray:
        from scipy.signal import resample
        duration = len(audio) / original_sr
        target_length = int(duration * target_sr)
        return resample(audio, target_length)

    def _preprocess_audio(self, audio: np.ndarray, sr: int) -> np.ndarray:
        audio = self._remove_dc_offset(audio)
        
        audio = self._bandpass_filter(audio, sr, self.voice_freq_low, self.voice_freq_high)
        
        audio = self._spectral_subtraction(audio, sr)
        
        audio = self._normalize_audio(audio)
        
        return audio

    def _remove_dc_offset(self, audio: np.ndarray) -> np.ndarray:
        return audio - np.mean(audio)

    def _bandpass_filter(self, audio: np.ndarray, sr: int, low_freq: float, high_freq: float) -> np.ndarray:
        nyquist = sr / 2
        low = low_freq / nyquist
        high = high_freq / nyquist
        
        b, a = signal.butter(4, [low, high], btype='band')
        
        filtered_audio = signal.filtfilt(b, a, audio)
        
        return filtered_audio

    def _spectral_subtraction(self, audio: np.ndarray, sr: int, noise_estimation_duration: float = 0.5) -> np.ndarray:
        noise_samples = int(noise_estimation_duration * sr)
        noise_samples = min(noise_samples, len(audio) // 4)
        
        noise_estimation = audio[:noise_samples]
        
        n_fft = 512
        hop_length = 128
        
        noise_stft = np.abs(signal.stft(noise_estimation, n_fft=n_fft, hop_length=hop_length)[2])
        noise_power = np.mean(noise_stft ** 2, axis=1)
        
        f, t, Zxx = signal.stft(audio, n_fft=n_fft, hop_length=hop_length)
        magnitude = np.abs(Zxx)
        phase = np.angle(Zxx)
        
        magnitude_power = magnitude ** 2
        alpha = 2.0
        beta = 0.01
        
        enhanced_power = magnitude_power - alpha * noise_power[:, np.newaxis]
        enhanced_power = np.maximum(enhanced_power, beta * magnitude_power)
        
        enhanced_magnitude = np.sqrt(enhanced_power)
        enhanced_Zxx = enhanced_magnitude * np.exp(1j * phase)
        
        _, enhanced_audio = signal.istft(enhanced_Zxx, n_fft=n_fft, hop_length=hop_length)
        
        return enhanced_audio[:len(audio)]

    def _normalize_audio(self, audio: np.ndarray) -> np.ndarray:
        max_val = np.max(np.abs(audio))
        if max_val > 0:
            return audio / max_val * 0.9
        return audio

    def _enhanced_vad(self, audio: np.ndarray, sr: int) -> List[Dict[str, float]]:
        frame_size = self.frame_size
        hop_size = self.hop_size
        
        num_frames = (len(audio) - frame_size) // hop_size + 1
        
        voice_scores = np.zeros(num_frames)
        features_list = []
        
        for i in range(num_frames):
            start = i * hop_size
            end = start + frame_size
            frame = audio[start:end]
            
            if len(frame) < frame_size:
                frame = np.pad(frame, (0, frame_size - len(frame)))
            
            features = self._extract_frame_features(frame, sr)
            features_list.append(features)
            
            voice_prob = self._calculate_voice_probability(features)
            voice_scores[i] = voice_prob
        
        features_array = np.array(features_list)
        
        adaptive_threshold = self._calculate_adaptive_threshold(voice_scores, features_array)
        logger.info(f"Adaptive threshold: {adaptive_threshold:.4f}")
        
        voice_scores_smoothed = self._smooth_scores(voice_scores)
        
        active_frames = np.where(voice_scores_smoothed > adaptive_threshold)[0]
        
        if len(active_frames) == 0:
            logger.warning("No voice activity detected")
            return []
        
        active_frames = self._filter_short_active_frames(active_frames, voice_scores_smoothed)
        
        segments = self._frames_to_segments(active_frames, hop_size, sr)
        
        segments = self._merge_adjacent_segments(segments)
        
        segments = self._filter_segments_by_features(segments, audio, sr)
        
        return segments

    def _extract_frame_features(self, frame: np.ndarray, sr: int) -> Dict[str, float]:
        features = {}
        
        energy = np.sum(frame ** 2) / len(frame)
        features['energy'] = energy
        
        rms = np.sqrt(np.mean(frame ** 2))
        features['rms'] = rms
        
        zcr = np.sum(np.abs(np.diff(np.sign(frame)))) / (2 * len(frame))
        features['zcr'] = zcr
        
        n_fft = 256
        spectrum = np.abs(np.fft.rfft(frame, n_fft))
        freqs = np.fft.rfftfreq(n_fft, 1.0 / sr)
        
        spectral_centroid = np.sum(freqs * spectrum) / (np.sum(spectrum) + 1e-10)
        features['spectral_centroid'] = spectral_centroid
        
        spectral_rolloff = self._calculate_spectral_rolloff(freqs, spectrum, 0.85)
        features['spectral_rolloff'] = spectral_rolloff
        
        spectral_rolloff_low = self._calculate_spectral_rolloff(freqs, spectrum, 0.15)
        features['spectral_rolloff_low'] = spectral_rolloff_low
        
        spectrum_flatness = np.exp(np.mean(np.log(spectrum + 1e-10))) / (np.mean(spectrum) + 1e-10)
        features['spectral_flatness'] = spectrum_flatness
        
        voice_band_mask = (freqs >= 300) & (freqs <= 3400)
        low_band_mask = (freqs >= 20) & (freqs < 300)
        high_band_mask = (freqs > 3400) & (freqs <= 8000)
        
        voice_band_energy = np.sum(spectrum[voice_band_mask] ** 2)
        total_energy = np.sum(spectrum ** 2) + 1e-10
        features['voice_band_ratio'] = voice_band_energy / total_energy
        
        low_band_energy = np.sum(spectrum[low_band_mask] ** 2)
        features['low_band_ratio'] = low_band_energy / total_energy
        
        high_band_energy = np.sum(spectrum[high_band_mask] ** 2)
        features['high_band_ratio'] = high_band_energy / total_energy
        
        mfccs = self._calculate_mfcc(frame, sr)
        for i, mfcc in enumerate(mfccs[:5]):
            features[f'mfcc_{i}'] = mfcc
        
        features['harmonicity'] = self._calculate_harmonicity(frame, sr)
        
        return features

    def _calculate_spectral_rolloff(self, freqs: np.ndarray, spectrum: np.ndarray, percentile: float) -> float:
        total_energy = np.sum(spectrum ** 2)
        target_energy = total_energy * percentile
        cumulative_energy = np.cumsum(spectrum ** 2)
        
        rolloff_idx = np.where(cumulative_energy >= target_energy)[0]
        if len(rolloff_idx) > 0:
            return freqs[rolloff_idx[0]]
        return freqs[-1]

    def _calculate_mfcc(self, frame: np.ndarray, sr: int, n_mfcc: int = 13) -> np.ndarray:
        try:
            from python_speech_features import mfcc
            mfccs = mfcc(frame, sr, numcep=n_mfcc, nfft=256)
            if len(mfccs) > 0:
                return np.mean(mfccs, axis=0)
        except ImportError:
            pass
        
        return np.zeros(n_mfcc)

    def _calculate_harmonicity(self, frame: np.ndarray, sr: int) -> float:
        autocorr = np.correlate(frame, frame, mode='full')
        autocorr = autocorr[len(autocorr)//2:]
        
        min_lag = int(sr / 400)
        max_lag = int(sr / 80)
        
        if len(autocorr) > max_lag:
            peak_region = autocorr[min_lag:max_lag]
            if len(peak_region) > 0:
                peak_idx = np.argmax(peak_region) + min_lag
                if autocorr[0] > 0:
                    return autocorr[peak_idx] / autocorr[0]
        
        return 0.0

    def _calculate_voice_probability(self, features: Dict[str, float]) -> float:
        score = 0.0
        
        energy = features['energy']
        if energy > 1e-6:
            energy_score = min(1.0, np.log10(energy + 1) / 2)
        else:
            energy_score = 0.0
        score += energy_score * self.energy_weight
        
        centroid = features['spectral_centroid']
        if 300 <= centroid <= 3400:
            centroid_score = 1.0 - abs(centroid - 1850) / 1550
        else:
            centroid_score = max(0.0, 1.0 - abs(centroid - 1850) / 3000)
        score += centroid_score * self.spectral_centroid_weight
        
        zcr = features['zcr']
        if 0.01 <= zcr <= 0.1:
            zcr_score = 1.0
        else:
            zcr_score = max(0.0, 1.0 - abs(zcr - 0.055) / 0.1)
        score += zcr_score * self.zcr_weight
        
        voice_band_ratio = features['voice_band_ratio']
        band_score = min(1.0, voice_band_ratio * 2)
        score += band_score * self.band_energy_ratio_weight
        
        harmonicity = features['harmonicity']
        if harmonicity > 0.2:
            score += min(0.2, harmonicity * 0.5)
        
        spectral_flatness = features['spectral_flatness']
        if spectral_flatness < 0.5:
            score += (1.0 - spectral_flatness * 2) * 0.1
        
        low_band_ratio = features['low_band_ratio']
        if low_band_ratio > 0.6:
            score -= (low_band_ratio - 0.6) * 0.5
        
        rolloff = features['spectral_rolloff']
        if rolloff < 1000 or rolloff > 6000:
            score -= 0.1
        
        return max(0.0, min(1.0, score))

    def _calculate_adaptive_threshold(self, scores: np.ndarray, features: np.ndarray) -> float:
        median_score = np.median(scores)
        mean_score = np.mean(scores)
        std_score = np.std(scores)
        
        base_threshold = 0.4
        
        if std_score < 0.1:
            threshold = max(base_threshold, median_score + 0.1)
        elif mean_score > 0.6:
            threshold = max(base_threshold, mean_score - 0.2)
        else:
            threshold = max(base_threshold, median_score + std_score * 0.5)
        
        high_energy_count = np.sum(scores > 0.7)
        if high_energy_count < len(scores) * 0.05:
            threshold = max(0.3, threshold - 0.1)
        
        return min(0.7, max(0.3, threshold))

    def _smooth_scores(self, scores: np.ndarray, window_size: int = 5) -> np.ndarray:
        if len(scores) < window_size:
            return scores
        
        kernel = np.ones(window_size) / window_size
        smoothed = np.convolve(scores, kernel, mode='same')
        
        smoothed = median_filter(smoothed, size=3)
        
        return smoothed

    def _filter_short_active_frames(self, active_frames: np.ndarray, scores: np.ndarray) -> np.ndarray:
        if len(active_frames) == 0:
            return active_frames
        
        min_frames = int(self.min_voice_segment_duration * self.sample_rate / self.hop_size)
        
        filtered_frames = []
        current_run = [active_frames[0]]
        
        for i in range(1, len(active_frames)):
            if active_frames[i] == active_frames[i-1] + 1:
                current_run.append(active_frames[i])
            else:
                if len(current_run) >= min_frames:
                    filtered_frames.extend(current_run)
                elif np.mean(scores[current_run]) > 0.8:
                    filtered_frames.extend(current_run)
                current_run = [active_frames[i]]
        
        if len(current_run) >= min_frames or np.mean(scores[current_run]) > 0.8:
            filtered_frames.extend(current_run)
        
        return np.array(filtered_frames)

    def _frames_to_segments(self, active_frames: np.ndarray, hop_size: int, sr: int) -> List[Dict[str, float]]:
        if len(active_frames) == 0:
            return []
        
        segments = []
        current_start = active_frames[0]
        
        for i in range(1, len(active_frames)):
            if active_frames[i] != active_frames[i-1] + 1:
                start_time = current_start * hop_size / sr
                end_time = (active_frames[i-1] + 1) * hop_size / sr
                segments.append({"start": start_time, "end": end_time})
                current_start = active_frames[i]
        
        start_time = current_start * hop_size / sr
        end_time = (active_frames[-1] + 1) * hop_size / sr
        segments.append({"start": start_time, "end": end_time})
        
        return segments

    def _merge_adjacent_segments(self, segments: List[Dict[str, float]]) -> List[Dict[str, float]]:
        if len(segments) < 2:
            return segments
        
        merged = [segments[0].copy()]
        
        for seg in segments[1:]:
            last = merged[-1]
            gap = seg["start"] - last["end"]
            
            if gap < self.max_gap_between_segments:
                last["end"] = seg["end"]
            else:
                merged.append(seg.copy())
        
        return merged

    def _filter_segments_by_features(self, segments: List[Dict[str, float]], audio: np.ndarray, sr: int) -> List[Dict[str, float]]:
        if len(segments) == 0:
            return segments
        
        filtered = []
        
        for seg in segments:
            duration = seg["end"] - seg["start"]
            if duration < self.min_voice_segment_duration:
                continue
            
            start_sample = int(seg["start"] * sr)
            end_sample = int(seg["end"] * sr)
            segment_audio = audio[start_sample:end_sample]
            
            if len(segment_audio) < self.frame_size:
                continue
            
            features = self._extract_frame_features(segment_audio, sr)
            
            is_music = self._classify_as_music(features, duration)
            
            if not is_music:
                filtered.append(seg)
            else:
                logger.debug(f"Filtered out segment {seg['start']:.2f}-{seg['end']:.2f}s as music")
        
        return filtered

    def _classify_as_music(self, features: Dict[str, float], duration: float) -> bool:
        music_score = 0.0
        
        if features['low_band_ratio'] > 0.5:
            music_score += (features['low_band_ratio'] - 0.5) * 2
        
        if features['spectral_flatness'] > 0.3:
            music_score += (features['spectral_flatness'] - 0.3) * 1.5
        
        if features['harmonicity'] < 0.3:
            music_score += (0.3 - features['harmonicity'])
        
        if features['voice_band_ratio'] < 0.3:
            music_score += (0.3 - features['voice_band_ratio']) * 2
        
        if features['spectral_centroid'] < 500 or features['spectral_centroid'] > 4000:
            music_score += 0.2
        
        if duration > 10 and features['spectral_flatness'] > 0.2:
            music_score += 0.3
        
        if duration < 0.3 and features['energy'] < 0.01:
            return True
        
        return music_score > 0.5

    def _webrtc_vad(self, audio: np.ndarray) -> List[Dict[str, float]]:
        try:
            import webrtcvad
            vad = webrtcvad.Vad(self.aggressiveness)
            
            if len(audio.shape) > 1:
                audio = audio[:, 0]
            
            audio_int16 = (audio * 32767).astype(np.int16)
            
            num_frames = len(audio_int16) // self.frame_size
            
            active_frames = []
            for i in range(num_frames):
                start = i * self.frame_size
                end = start + self.frame_size
                frame = audio_int16[start:end].tobytes()
                
                if len(frame) == self.frame_size * 2:
                    if vad.is_speech(frame, self.sample_rate):
                        active_frames.append(i)
            
            return self._merge_active_frames(active_frames)
            
        except ImportError:
            logger.warning("webrtcvad not available")
            return []

    def _merge_active_frames(self, active_frames: List[int]) -> List[Dict[str, float]]:
        segments = []
        if not active_frames:
            return segments
        
        current_start = active_frames[0]
        for i in range(1, len(active_frames)):
            if active_frames[i] - active_frames[i-1] > 3:
                start_time = current_start * self.frame_duration / 1000
                end_time = active_frames[i-1] * self.frame_duration / 1000
                if end_time - start_time > 0.1:
                    segments.append({"start": start_time, "end": end_time})
                current_start = active_frames[i]
        
        start_time = current_start * self.frame_duration / 1000
        end_time = active_frames[-1] * self.frame_duration / 1000
        if end_time - start_time > 0.1:
            segments.append({"start": start_time, "end": end_time})
        
        return segments

    def _energy_based_vad(self, audio: np.ndarray, sample_rate: int) -> List[Dict[str, float]]:
        logger.warning("Using energy-based VAD as fallback")
        return self._enhanced_vad(audio, sample_rate)

    def get_segment_statistics(self, segments: List[Dict[str, float]]) -> Dict[str, float]:
        if not segments:
            return {
                "count": 0,
                "total_duration": 0,
                "mean_duration": 0,
                "median_duration": 0,
                "gap_mean": 0
            }
        
        durations = [s["end"] - s["start"] for s in segments]
        gaps = [segments[i+1]["start"] - segments[i]["end"] for i in range(len(segments)-1)]
        
        return {
            "count": len(segments),
            "total_duration": sum(durations),
            "mean_duration": np.mean(durations),
            "median_duration": np.median(durations),
            "gap_mean": np.mean(gaps) if gaps else 0
        }
