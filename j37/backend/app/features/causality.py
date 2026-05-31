import numpy as np
from scipy import stats
from typing import Dict, List, Optional, Tuple
import math
from collections import Counter


def _embed_time_series(signal: np.ndarray, lag: int, k: int) -> np.ndarray:
    n = len(signal)
    result = np.zeros((n - (k - 1) * lag, k))
    for i in range(k):
        result[:, i] = signal[i * lag : n - (k - 1 - i) * lag]
    return result


def _discretize(signal: np.ndarray, n_bins: int = 10) -> np.ndarray:
    sorted_vals = np.sort(signal)
    edges = np.percentile(sorted_vals, np.linspace(0, 100, n_bins + 1))
    edges[0] = edges[0] - 1e-9
    edges[-1] = edges[-1] + 1e-9
    return np.digitize(signal, edges) - 1


def _joint_probability(x: np.ndarray, y: np.ndarray = None) -> np.ndarray:
    if y is None:
        counts = Counter(x.tolist())
        total = len(x)
        return np.array([counts[i] / total for i in sorted(counts.keys())])
    else:
        pairs = list(zip(x.tolist(), y.tolist()))
        counts = Counter(pairs)
        total = len(pairs)
        return np.array([counts[p] / total for p in sorted(counts.keys())])


def _entropy(p: np.ndarray) -> float:
    p = p[p > 0]
    return float(-np.sum(p * np.log(p)))


def _conditional_entropy(x: np.ndarray, y: np.ndarray) -> float:
    n = len(x)
    y_counts = Counter(y.tolist())
    total = 0.0
    for y_val, y_count in y_counts.items():
        mask = y == y_val
        x_given_y = x[mask]
        p_given_y = _joint_probability(x_given_y)
        total += (y_count / n) * _entropy(p_given_y)
    return total


def transfer_entropy(
    source: np.ndarray,
    target: np.ndarray,
    k: int = 2,
    l: int = 2,
    lag: int = 1,
    n_bins: int = 10,
) -> float:
    if len(source) != len(target):
        raise ValueError("Source and target signals must have the same length")

    n = len(source)
    min_length = (max(k, l) + 1) * lag
    if n <= min_length:
        return 0.0

    source_disc = _discretize(source, n_bins)
    target_disc = _discretize(target, n_bins)

    source_past = source_disc[:-lag] if lag > 0 else source_disc
    target_present = target_disc[lag:]
    target_past = target_disc[:-lag] if lag > 0 else target_disc

    if len(target_present) < k:
        return 0.0

    target_past_k = target_past[-len(target_present) :]

    H_target_given_past = _conditional_entropy(target_present, target_past_k)

    combined_past = np.array([
        (int(target_past_k[i]), int(source_past[i % len(source_past)]))
        for i in range(len(target_present))
    ])
    combined_past_tuple = [
        (int(target_past_k[i]), int(source_past[i % len(source_past)]))
        for i in range(len(target_present))
    ]

    y_counts = Counter(combined_past_tuple)
    H_combined = 0.0
    total = len(target_present)

    for (y_val, s_val), count in y_counts.items():
        mask = [
            combined_past_tuple[i] == (y_val, s_val)
            for i in range(len(combined_past_tuple))
        ]
        x_given = target_present[mask]
        if len(x_given) > 0:
            p_given = _joint_probability(x_given)
            H_combined += (count / total) * _entropy(p_given)

    te = H_target_given_past - H_combined
    return max(0.0, te)


def _estimate_ar_coefficients(X: np.ndarray, y: np.ndarray) -> np.ndarray:
    if X.ndim == 1:
        X = X.reshape(-1, 1)
    X_with_bias = np.hstack([X, np.ones((X.shape[0], 1))])
    try:
        coeffs, _, _, _ = np.linalg.lstsq(X_with_bias, y, rcond=None)
        return coeffs
    except np.linalg.LinAlgError:
        return np.zeros(X_with_bias.shape[1])


def granger_causality_test(
    source: np.ndarray,
    target: np.ndarray,
    max_lag: int = 10,
    auto_lag_selection: bool = True,
) -> Dict:
    if len(source) != len(target):
        raise ValueError("Source and target signals must have the same length")

    n = len(source)
    if n < max_lag + 10:
        return {"f_statistic": 0.0, "p_value": 1.0, "best_lag": 0, "causal": False}

    best_bic = float("inf")
    best_lag = 1

    if auto_lag_selection:
        for lag in range(1, min(max_lag, n // 4) + 1):
            X_restricted = _embed_time_series(target, 1, lag)
            y = target[lag:]
            if len(y) == 0:
                continue
            coeffs = _estimate_ar_coefficients(X_restricted, y)
            X_with_bias = np.hstack([X_restricted, np.ones((len(y), 1))])
            residuals = y - X_with_bias @ coeffs
            rss_restricted = np.sum(residuals ** 2)
            k = lag + 1
            bic = n * np.log(rss_restricted / n) + k * np.log(n)
            if bic < best_bic:
                best_bic = bic
                best_lag = lag
    else:
        best_lag = max_lag

    lag = best_lag
    if lag >= n:
        return {"f_statistic": 0.0, "p_value": 1.0, "best_lag": lag, "causal": False}

    X_restricted = _embed_time_series(target, 1, lag)
    y = target[lag:]
    if len(y) == 0:
        return {"f_statistic": 0.0, "p_value": 1.0, "best_lag": lag, "causal": False}

    coeffs_restricted = _estimate_ar_coefficients(X_restricted, y)
    X_restricted_bias = np.hstack([X_restricted, np.ones((len(y), 1))])
    residuals_restricted = y - X_restricted_bias @ coeffs_restricted
    rss_restricted = np.sum(residuals_restricted ** 2)

    source_shifted = _embed_time_series(source, 1, lag)
    min_len = min(len(X_restricted), len(source_shifted))
    X_unrestricted = np.hstack([X_restricted[-min_len:], source_shifted[-min_len:]])
    y_unrestricted = y[-min_len:]

    coeffs_unrestricted = _estimate_ar_coefficients(X_unrestricted, y_unrestricted)
    X_unrestricted_bias = np.hstack([X_unrestricted, np.ones((min_len, 1))])
    residuals_unrestricted = y_unrestricted - X_unrestricted_bias @ coeffs_unrestricted
    rss_unrestricted = np.sum(residuals_unrestricted ** 2)

    df1 = lag
    df2 = min_len - 2 * lag - 1

    if df2 <= 0 or rss_restricted <= 0:
        return {"f_statistic": 0.0, "p_value": 1.0, "best_lag": lag, "causal": False}

    f_stat = ((rss_restricted - rss_unrestricted) / df1) / (rss_unrestricted / df2)
    p_value = 1.0 - stats.f.cdf(max(0, f_stat), df1, df2)

    return {
        "f_statistic": float(f_stat),
        "p_value": float(p_value),
        "best_lag": lag,
        "causal": bool(p_value < 0.05 and f_stat > 0),
        "rss_restricted": float(rss_restricted),
        "rss_unrestricted": float(rss_unrestricted),
    }


def estimate_delay_te(
    source: np.ndarray,
    target: np.ndarray,
    min_delay: int = 0,
    max_delay: int = 50,
    k: int = 2,
    n_bins: int = 8,
) -> Tuple[int, float]:
    best_delay = min_delay
    best_te = 0.0

    for delay in range(min_delay, max_delay + 1):
        if delay > 0:
            src = source[:-delay]
            tgt = target[delay:]
        else:
            src = source
            tgt = target

        if len(src) < 10 * k:
            continue

        te = transfer_entropy(src, tgt, k=k, n_bins=n_bins)
        if te > best_te:
            best_te = te
            best_delay = delay

    return best_delay, best_te


def estimate_delay_xcorr(
    source: np.ndarray,
    target: np.ndarray,
    max_delay: int = 50,
) -> Tuple[int, float]:
    source_norm = (source - np.mean(source)) / (np.std(source) + 1e-9)
    target_norm = (target - np.mean(target)) / (np.std(target) + 1e-9)

    correlation = np.correlate(source_norm, target_norm, mode="full")
    mid = len(target_norm) - 1
    valid_range = slice(mid - max_delay, mid + max_delay + 1)
    valid_corr = correlation[valid_range]

    peak_idx = int(np.argmax(np.abs(valid_corr)))
    delay = peak_idx - max_delay
    max_corr = float(valid_corr[peak_idx])

    return delay, max_corr
