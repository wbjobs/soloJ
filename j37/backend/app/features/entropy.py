import numpy as np
from scipy.stats import kurtosis as _kurtosis, skew as _skew
from scipy.signal import welch
import pywt
from typing import Dict, List, Optional
import math


def _safe_r(signal: np.ndarray, r: Optional[float], factor: float = 0.2) -> float:
    if r is not None and r > 0:
        return r
    std_val = float(np.std(signal))
    if std_val > 1e-12:
        return factor * std_val
    ptp = float(np.ptp(signal))
    if ptp > 1e-12:
        return factor * ptp
    return 1e-8


def _delay_embedding(signal: np.ndarray, m: int, tau: int) -> np.ndarray:
    n = len(signal)
    num_vectors = n - (m - 1) * tau
    if num_vectors <= 0:
        return np.empty((0, m))
    indices = np.arange(num_vectors)[:, None] + np.arange(m)[None, :] * tau
    return signal[indices]


def _safe_log_ratio(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    if numerator <= 0:
        return -math.log(denominator)
    ratio = numerator / denominator
    if ratio <= 0:
        return 0.0
    if not math.isfinite(ratio):
        return 0.0
    result = -math.log(ratio)
    if not math.isfinite(result):
        return 0.0
    return result


def sample_entropy(signal: np.ndarray, m: int = 2, r: Optional[float] = None) -> float:
    n = len(signal)
    if n < m + 2:
        return 0.0
    r = _safe_r(signal, r)

    def _count(template_len: int) -> float:
        vectors = _delay_embedding(signal, template_len, tau=1)
        count = 0.0
        num = len(vectors)
        for i in range(num):
            for j in range(i + 1, num):
                if np.max(np.abs(vectors[i] - vectors[j])) <= r:
                    count += 1.0
        return count

    a = _count(m + 1)
    b = _count(m)
    return _safe_log_ratio(a, b)


def multiscale_sample_entropy(
    signal: np.ndarray, scales: List[int] = None, m: int = 2, r: Optional[float] = None
) -> List[float]:
    if scales is None:
        scales = list(range(1, 21))
    min_length_required = max(scales) * (m + 2)
    if len(signal) < min_length_required:
        max_safe_scale = len(signal) // (m + 2)
        scales = [s for s in scales if s <= max_safe_scale]
        if not scales:
            return [0.0] * len(scales) if scales else []
    results = []
    for scale in scales:
        coarse = _coarse_grain(signal, scale)
        if len(coarse) < m + 2:
            results.append(0.0)
        elif np.std(coarse) < 1e-12 and np.ptp(coarse) < 1e-12:
            results.append(0.0)
        else:
            se = sample_entropy(coarse, m, r)
            results.append(se if math.isfinite(se) else 0.0)
    while len(results) < len(scales):
        results.append(0.0)
    return results


def _coarse_grain(signal: np.ndarray, scale: int) -> np.ndarray:
    n = len(signal)
    num = n // scale
    if num == 0:
        return signal[:1]
    trimmed = signal[: num * scale]
    return trimmed.reshape(num, scale).mean(axis=1)


def fuzzy_entropy(
    signal: np.ndarray,
    m: int = 2,
    r: Optional[float] = None,
    n_param: float = 2.0,
    tau: int = 1,
) -> float:
    n_pts = len(signal)
    if n_pts < (m + 1) * tau:
        return 0.0
    r = _safe_r(signal, r)

    def _phi(template_len: int) -> float:
        vectors = _delay_embedding(signal, template_len, tau)
        num = len(vectors)
        if num <= 1:
            return 0.0
        vectors = vectors - vectors.mean(axis=1, keepdims=True)
        total = 0.0
        for i in range(num):
            for j in range(num):
                if i == j:
                    continue
                d = np.max(np.abs(vectors[i] - vectors[j]))
                exponent = -(d ** n_param) / r
                if exponent < -700:
                    continue
                total += math.exp(exponent)
        return total / (num * (num - 1))

    phi_m = _phi(m)
    phi_m1 = _phi(m + 1)
    return _safe_log_ratio(phi_m1, phi_m)


def permutation_entropy(
    signal: np.ndarray, m: int = 3, tau: int = 1, base: float = np.e
) -> float:
    n = len(signal)
    if n < m * tau:
        return 0.0

    vectors = _delay_embedding(signal, m, tau)
    from math import factorial
    from collections import Counter

    ordinal_patterns = Counter()
    for vec in vectors:
        pattern = tuple(np.argsort(vec))
        ordinal_patterns[pattern] += 1

    total = sum(ordinal_patterns.values())
    pe = 0.0
    log_base = math.log(base)
    log_factorial_m = math.log(factorial(m))
    if log_factorial_m <= 0:
        return 0.0
    for count in ordinal_patterns.values():
        p = count / total
        if p > 0:
            pe -= p * math.log(p)
    normalized = pe / log_factorial_m
    if not math.isfinite(normalized):
        return 0.0
    return normalized


def rms(signal: np.ndarray) -> float:
    return float(np.sqrt(np.mean(signal ** 2)))


def kurtosis_val(signal: np.ndarray) -> float:
    return float(_kurtosis(signal, fisher=True))


def skewness_val(signal: np.ndarray) -> float:
    return float(_skew(signal))


def crest_factor(signal: np.ndarray) -> float:
    peak = float(np.max(np.abs(signal)))
    r = rms(signal)
    return peak / r if r > 0 else 0.0


def shape_factor(signal: np.ndarray) -> float:
    r = rms(signal)
    mean_abs = float(np.mean(np.abs(signal)))
    return r / mean_abs if mean_abs > 0 else 0.0


def impulse_factor(signal: np.ndarray) -> float:
    peak = float(np.max(np.abs(signal)))
    mean_abs = float(np.mean(np.abs(signal)))
    return peak / mean_abs if mean_abs > 0 else 0.0


def margin_factor(signal: np.ndarray) -> float:
    peak = float(np.max(np.abs(signal)))
    root_mean_square_abs = float(np.sqrt(np.mean(np.sqrt(np.abs(signal))) ** 2))
    sq = float(np.mean(np.sqrt(np.abs(signal))) ** 2)
    sq2 = float(np.sqrt(sq))
    return peak / sq2 if sq2 > 0 else 0.0


def compute_spectrum(
    signal: np.ndarray, fs: int = 50000, nperseg: int = 4096
) -> Dict[str, np.ndarray]:
    freqs, psd = welch(signal, fs=fs, nperseg=nperseg)
    return {"freqs": freqs.tolist(), "psd": psd.tolist()}


def compute_cwt(
    signal: np.ndarray,
    fs: int = 50000,
    wavelet: str = "morl",
    scales: Optional[np.ndarray] = None,
) -> Dict[str, object]:
    if scales is None:
        max_scale = 128
        scales = np.arange(1, max_scale + 1)
    coeffs, freqs = pywt.cwt(signal, scales, wavelet, 1.0 / fs)
    return {
        "coeffs": coeffs.tolist(),
        "freqs": freqs.tolist(),
        "times": (np.arange(len(signal)) / fs).tolist(),
        "scales": scales.tolist(),
    }


def _sanitize_float(value: float) -> float:
    if not math.isfinite(value):
        return 0.0
    return value


def compute_features_for_channel(signal: np.ndarray) -> Dict[str, float]:
    raw = {
        "sample_entropy": sample_entropy(signal),
        "fuzzy_entropy": fuzzy_entropy(signal),
        "permutation_entropy": permutation_entropy(signal),
        "rms": rms(signal),
        "kurtosis": kurtosis_val(signal),
        "skewness": skewness_val(signal),
        "crest_factor": crest_factor(signal),
        "shape_factor": shape_factor(signal),
        "impulse_factor": impulse_factor(signal),
        "margin_factor": margin_factor(signal),
    }
    return {k: _sanitize_float(v) for k, v in raw.items()}


def compute_features_multichannel(
    data: np.ndarray, channel_names: Optional[List[str]] = None
) -> List[Dict]:
    num_channels = data.shape[1] if data.ndim == 2 else 1
    if channel_names is None:
        channel_names = [f"ch_{i}" for i in range(num_channels)]
    results = []
    for i in range(num_channels):
        ch_signal = data[:, i] if data.ndim == 2 else data
        feat = compute_features_for_channel(ch_signal)
        feat["channel"] = channel_names[i]
        results.append(feat)
    return results


def compute_multiscale_entropy_for_channel(
    signal: np.ndarray, scales: List[int] = None
) -> Dict[str, List[float]]:
    mse = multiscale_sample_entropy(signal, scales)
    return {"scales": scales or list(range(1, 21)), "mse_values": mse}
