"""Smith-Waterman local alignment with blockwise computation and heatmap downsampling."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Tuple

import numpy as np

from .matrices import get_matrix


DEFAULT_GAP_OPEN = -10
DEFAULT_GAP_EXT = -2


@dataclass
class AlignmentResult:
    score: int
    score_percent: float
    seq1_start: int
    seq1_end: int
    seq2_start: int
    seq2_end: int
    aligned_seq1: str
    aligned_seq2: str
    midline: str
    length: int
    matches: int
    mismatches: int
    gaps: int
    heatmap: List[List[int]] = field(default_factory=list)
    heatmap_rows: int = 0
    heatmap_cols: int = 0
    seq1_len: int = 0
    seq2_len: int = 0


def _encode(seq: str) -> np.ndarray:
    return np.frombuffer(seq.encode("ascii"), dtype=np.uint8)


def _build_subst_array(matrix: Dict[Tuple[str, str], int], default_mismatch: int = -4) -> np.ndarray:
    """Build a 256x256 lookup table indexed by ASCII byte values."""
    tbl = np.full((256, 256), default_mismatch, dtype=np.int32)
    for (a, b), v in matrix.items():
        ai = ord(a)
        bi = ord(b)
        tbl[ai, bi] = v
        tbl[bi, ai] = v
    # Case-insensitive: map lowercase to uppercase
    for c in range(256):
        if 97 <= c <= 122:
            up = c - 32
            tbl[c, :] = tbl[up, :]
            tbl[:, c] = tbl[:, up]
    return tbl


def _score_row(
    prev_row: np.ndarray,
    prev_gap_row: np.ndarray,
    a_byte: int,
    b_encoded: np.ndarray,
    subst: np.ndarray,
    gap_open: int,
    gap_ext: int,
) -> Tuple[np.ndarray, np.ndarray, int, int]:
    """Compute one DP row. Returns (H_row, E_row, row_max, row_argmax)."""
    m = b_encoded.shape[0]
    H = np.zeros(m + 1, dtype=np.int32)
    E = np.full(m + 1, -10**9, dtype=np.int32)
    match_scores = subst[a_byte, b_encoded]  # shape (m,)
    diag = prev_row[:-1] + match_scores
    cand1 = np.empty(m + 1, dtype=np.int32)
    cand1[0] = prev_row[0] + gap_open
    cand1[1:] = prev_row[1:] + gap_open
    # E[j] = max(cand1[j], E[j-1]+gap_ext). Sequential dependency.
    E_vals = np.empty(m + 1, dtype=np.int32)
    E_vals[0] = cand1[0]
    for j in range(1, m + 1):
        e_prev = E_vals[j - 1] + gap_ext
        E_vals[j] = cand1[j] if cand1[j] > e_prev else e_prev
    E = E_vals
    # H[j] = max(0, diag[j-1] + match, E[j], prev_row[j] + gap)
    gap_down = prev_row + gap_open
    diag_full = np.empty(m + 1, dtype=np.int32)
    diag_full[0] = 0
    diag_full[1:] = diag
    H = np.maximum.reduce(
        [
            np.zeros(m + 1, dtype=np.int32),
            diag_full,
            E,
            gap_down,
        ]
    )
    row_max = int(H.max())
    row_argmax = int(H.argmax())
    return H, E, row_max, row_argmax


def _block_align(
    seq1: str,
    seq2: str,
    subst: Dict[Tuple[str, str], int],
    gap_open: int,
    gap_ext: int,
    heatmap_bins: int = 200,
    block_rows: int = 2000,
) -> Tuple[AlignmentResult, np.ndarray]:
    """Run SW and return alignment result + full H-matrix downsampled into heatmap.

    For sequences up to 100k x 100k, storing the full matrix is impossible.
    We instead:
      - Compute row-by-row (blocked over rows) to bound memory.
      - Downsample H into a (heatmap_bins x heatmap_bins) grid by taking
        the maximum score within each cell (so hot spots are preserved).
      - Keep the last DP row to allow backward trace starting from the
        maximum cell position, then re-run a local trace window around
        that best region to avoid storing the full matrix.
    """
    n = len(seq1)
    m = len(seq2)
    a_enc = _encode(seq1)
    b_enc = _encode(seq2)
    tbl = _build_subst_array(subst)

    bh = min(heatmap_bins, max(1, n))
    bw = min(heatmap_bins, max(1, m))
    heatmap = np.zeros((bh, bw), dtype=np.int32)

    prev_H = np.zeros(m + 1, dtype=np.int32)
    prev_E = np.full(m + 1, -10**9, dtype=np.int32)

    global_max = 0
    best_i = 0
    best_j = 0

    row_bin_size = max(1, (n + bh - 1) // bh)
    col_bin_size = max(1, (m + bw - 1) // bw)

    # Pre-compute column indices for speed
    col_bins = np.arange(m) // col_bin_size

    for i in range(1, n + 1):
        a_byte = int(a_enc[i - 1])
        H, E, row_max, row_argmax = _score_row(
            prev_H, prev_E, a_byte, b_enc, tbl, gap_open, gap_ext
        )
        if row_max > global_max:
            global_max = row_max
            best_i = i
            best_j = row_argmax
        # Downsample into heatmap bin for this row
        rbin = min(bh - 1, (i - 1) // row_bin_size)
        # H[1:] has scores for columns 1..m
        row_scores = H[1:]
        # Accumulate max per column bin
        if bw == m:
            heatmap[rbin, :] = np.maximum(heatmap[rbin, :], row_scores)
        else:
            # group max by bin
            np.maximum.at(heatmap[rbin], col_bins, row_scores)
        prev_H = H
        prev_E = E

    # Now re-run a limited region around (best_i, best_j) to do traceback.
    # Window size: heuristic based on max score and expected matches.
    window = min(4000, max(500, global_max * 4))
    i_lo = max(1, best_i - window)
    j_lo = max(1, best_j - window)
    i_hi = min(n, best_i + window)
    j_hi = min(m, best_j + window)
    sub_seq1 = seq1[i_lo - 1 : i_hi]
    sub_seq2 = seq2[j_lo - 1 : j_hi]
    local_result = _full_sw_traceback(sub_seq1, sub_seq2, tbl, gap_open, gap_ext)

    # Adjust coordinates back to global
    local_result.seq1_start += i_lo - 1
    local_result.seq1_end += i_lo - 1
    local_result.seq2_start += j_lo - 1
    local_result.seq2_end += j_lo - 1
    local_result.seq1_len = n
    local_result.seq2_len = m
    local_result.heatmap = heatmap.tolist()
    local_result.heatmap_rows = bh
    local_result.heatmap_cols = bw
    local_result.score_percent = (
        100.0 * local_result.score / max(1, local_result.length)
    )
    return local_result, heatmap


def _full_sw_traceback(
    seq1: str,
    seq2: str,
    tbl: np.ndarray,
    gap_open: int,
    gap_ext: int,
) -> AlignmentResult:
    """Compute full DP matrix (for small window) and perform traceback."""
    n = len(seq1)
    m = len(seq2)
    H = np.zeros((n + 1, m + 1), dtype=np.int32)
    # Also store which cell we came from: 0=stop, 1=diag, 2=left(E), 3=up(F)
    trace = np.zeros((n + 1, m + 1), dtype=np.uint8)
    E = np.full((n + 1, m + 1), -10**9, dtype=np.int32)
    F = np.full((n + 1, m + 1), -10**9, dtype=np.int32)

    a_enc = _encode(seq1)
    b_enc = _encode(seq2)

    for i in range(1, n + 1):
        ai = int(a_enc[i - 1])
        for j in range(1, m + 1):
            bj = int(b_enc[j - 1])
            s = int(tbl[ai, bj])
            E[i, j] = max(H[i, j - 1] + gap_open, E[i, j - 1] + gap_ext)
            F[i, j] = max(H[i - 1, j] + gap_open, F[i - 1, j] + gap_ext)
            diag = H[i - 1, j - 1] + s
            best = max(0, diag, E[i, j], F[i, j])
            H[i, j] = best
            if best == 0:
                trace[i, j] = 0
            elif best == diag:
                trace[i, j] = 1
            elif best == E[i, j]:
                trace[i, j] = 2
            else:
                trace[i, j] = 3

    # Find max
    max_idx = np.unravel_index(H.argmax(), H.shape)
    i, j = int(max_idx[0]), int(max_idx[1])
    max_score = int(H[i, j])
    end_i, end_j = i, j

    a1: List[str] = []
    a2: List[str] = []
    mid: List[str] = []

    while i > 0 and j > 0 and H[i, j] > 0:
        t = trace[i, j]
        if t == 1:
            c1 = seq1[i - 1]
            c2 = seq2[j - 1]
            a1.append(c1)
            a2.append(c2)
            mid.append("|" if c1 == c2 else (":" if int(tbl[ord(c1), ord(c2)]) > 0 else "."))
            i -= 1
            j -= 1
        elif t == 2:
            a1.append("-")
            a2.append(seq2[j - 1])
            mid.append(" ")
            j -= 1
        elif t == 3:
            a1.append(seq1[i - 1])
            a2.append("-")
            mid.append(" ")
            i -= 1
        else:
            break

    a1.reverse()
    a2.reverse()
    mid.reverse()
    aligned1 = "".join(a1)
    aligned2 = "".join(a2)
    midline = "".join(mid)
    length = len(aligned1)
    matches = sum(1 for k in range(length) if aligned1[k] == aligned2[k] and aligned1[k] != "-")
    gaps = sum(1 for k in range(length) if aligned1[k] == "-" or aligned2[k] == "-")
    mismatches = length - matches - gaps

    return AlignmentResult(
        score=max_score,
        score_percent=0.0,
        seq1_start=i,
        seq1_end=end_i - 1,
        seq2_start=j,
        seq2_end=end_j - 1,
        aligned_seq1=aligned1,
        aligned_seq2=aligned2,
        midline=midline,
        length=length,
        matches=matches,
        mismatches=mismatches,
        gaps=gaps,
    )


def align(
    seq1: str,
    seq2: str,
    matrix_name: str = "DNA",
    gap_open: int = DEFAULT_GAP_OPEN,
    gap_ext: int = DEFAULT_GAP_EXT,
    heatmap_bins: int = 200,
) -> AlignmentResult:
    matrix = get_matrix(matrix_name)
    result, _ = _block_align(
        seq1, seq2, matrix, gap_open, gap_ext, heatmap_bins=heatmap_bins
    )
    return result


def heatmap_diff_regions(heatmap: List[List[int]], threshold: float = 0.5) -> List[Dict]:
    """Return a JSON-friendly list of high-scoring regions in the heatmap grid."""
    arr = np.array(heatmap, dtype=np.float32)
    if arr.size == 0:
        return []
    vmax = float(arr.max())
    if vmax <= 0:
        return []
    cutoff = vmax * threshold
    regions: List[Dict] = []
    # Group consecutive high-scoring cells per row
    for r in range(arr.shape[0]):
        row = arr[r]
        in_region = False
        start = 0
        for c in range(arr.shape[1]):
            if row[c] >= cutoff and not in_region:
                start = c
                in_region = True
            elif row[c] < cutoff and in_region:
                regions.append({"row": int(r), "col_start": int(start), "col_end": int(c - 1)})
                in_region = False
        if in_region:
            regions.append({"row": int(r), "col_start": int(start), "col_end": int(arr.shape[1] - 1)})
    return regions
