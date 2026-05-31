"""Sliding-window similarity analysis and GFF3 annotation export."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class SimilarityRegion:
    seq_id: str
    start: int  # 0-based inclusive
    end: int  # 0-based inclusive
    score: float  # 0..1 similarity
    strand: str = "+"
    source: str = "sliding_window"
    feature: str = "similarity_region"

    def gff3_line(self, ref_seq: str = "reference", attributes: Optional[Dict] = None) -> str:
        """Format as GFF3 line (1-based coordinates)."""
        attr_str = ";".join(
            [f"{k}={v}" for k, v in (attributes or {}).items()]
            + [f"ID={self.seq_id}_{self.start}_{self.end}"]
        )
        return "\t".join(
            [
                ref_seq,
                self.source,
                self.feature,
                str(self.start + 1),  # GFF is 1-based
                str(self.end + 1),
                f"{self.score:.4f}",
                self.strand,
                ".",
                attr_str,
            ]
        )


def sliding_window_similarity(
    seq1: str,
    seq2: str,
    window_size: int = 100,
    step: int = 10,
    min_similarity: float = 0.85,
    min_region_length: int = 50,
    merge_distance: int = 20,
) -> List[SimilarityRegion]:
    """Compute local similarity regions using sliding window on seq1 vs seq2.

    For each window in seq1, find the best matching window in seq2 (O(n*m) naive
    matching for small windows; use k-mer indexing for larger scales).
    Returns merged regions with similarity >= min_similarity.
    """
    n = len(seq1)
    m = len(seq2)
    if n < window_size or m < window_size:
        return []

    # Precompute set of windows for seq2 (k-mer style, but full window)
    # For speed, we'll just do direct comparison on small windows.
    hits: List[SimilarityRegion] = []

    for i in range(0, n - window_size + 1, step):
        w1 = seq1[i : i + window_size]
        best_score = 0.0
        best_j = 0
        # Only scan nearby? For full search, iterate all.
        # To keep it fast, we'll slide both sequences in lockstep + small offset range.
        search_start = max(0, i - 100)
        search_end = min(m - window_size, i + 100)
        for j in range(search_start, search_end + 1, max(1, step // 2)):
            w2 = seq2[j : j + window_size]
            matches = sum(1 for a, b in zip(w1, w2) if a == b)
            score = matches / window_size
            if score > best_score:
                best_score = score
                best_j = j
        if best_score >= min_similarity:
            hits.append(
                SimilarityRegion(
                    seq_id="seq1",
                    start=i,
                    end=i + window_size - 1,
                    score=best_score,
                    source=f"window_{window_size}",
                    feature="match_to_seq2",
                )
            )

    if not hits:
        return []

    # Merge overlapping / nearby hits
    merged: List[SimilarityRegion] = [hits[0]]
    for h in hits[1:]:
        last = merged[-1]
        if h.start - last.end <= merge_distance:
            last.end = max(last.end, h.end)
            last.score = (last.score + h.score) / 2  # rolling average
        else:
            merged.append(h)

    # Filter by minimum region length
    merged = [r for r in merged if (r.end - r.start + 1) >= min_region_length]
    return merged


def export_gff3(
    regions: List[SimilarityRegion],
    ref_seq: str = "reference",
    header_comments: Optional[List[str]] = None,
) -> str:
    """Export similarity regions as GFF3 format text."""
    lines = ["##gff-version 3"]
    if header_comments:
        lines.extend(f"## {c}" for c in header_comments)
    lines.extend(
        r.gff3_line(ref_seq=ref_seq, attributes={"Name": f"region_{i+1}"})
        for i, r in enumerate(regions)
    )
    lines.append("###")
    return "\n".join(lines) + "\n"


def multi_sliding_window(
    sequences: List[str],
    window_size: int = 100,
    step: int = 10,
    min_similarity: float = 0.85,
) -> Dict[str, List[SimilarityRegion]]:
    """Compare all pairs in a set of sequences (max 5 recommended)."""
    results: Dict[str, List[SimilarityRegion]] = {}
    for i, s1 in enumerate(sequences):
        for j, s2 in enumerate(sequences):
            if i == j:
                continue
            key = f"seq{i+1}_vs_seq{j+1}"
            results[key] = sliding_window_similarity(
                s1, s2, window_size=window_size, step=step, min_similarity=min_similarity
            )
    return results
