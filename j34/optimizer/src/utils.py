import math
import numpy as np
from typing import Dict, Tuple, List


def enforce_physical_constraints(params: Dict[str, float]) -> Dict[str, float]:
    a = params.get("lattice_constant", 0.05)
    r = params.get("cylinder_radius", 0.015)

    if r >= a / 2 - 1e-6:
        r = a / 2 * 0.9
        params["cylinder_radius"] = r

    expected_ff = math.pi * (r ** 2) / (a ** 2)
    params["filling_fraction"] = min(max(expected_ff, 0.1), 0.5)

    return params


def validate_params(params: Dict[str, float]) -> Tuple[bool, str]:
    a = params.get("lattice_constant", 0)
    r = params.get("cylinder_radius", 0)
    h = params.get("cylinder_height", 0)

    if r >= a / 2:
        return False, f"柱体半径 ({r:.4f}) 超过晶格常数的一半 ({a/2:.4f})"

    if a <= 0 or r <= 0 or h <= 0:
        return False, "几何参数必须 > 0"

    drho = abs(params.get("matrix_density", 0) - params.get("scatterer_density", 0))
    dc = abs(params.get("matrix_speed_of_sound", 0) - params.get("scatterer_speed_of_sound", 0))
    if drho < 10 and dc < 10:
        return False, "基体和散射体材料参数必须有显著差异"

    return True, "参数有效"


def extract_band_gaps(eigenvalues: list, threshold_ratio: float = 0.05) -> list:
    if not eigenvalues or len(eigenvalues) == 0:
        return []

    band_gaps = []
    num_bands = len(eigenvalues[0])

    for band_idx in range(num_bands - 1):
        current_band = []
        next_band = []
        for eigs in eigenvalues:
            if len(eigs) > band_idx:
                val = eigs[band_idx]
                if isinstance(val, (int, float)) and not (val != val):
                    current_band.append(val)
            if len(eigs) > band_idx + 1:
                val = eigs[band_idx + 1]
                if isinstance(val, (int, float)) and not (val != val):
                    next_band.append(val)

        if not current_band or not next_band:
            continue

        max_current = max(current_band)
        min_next = min(next_band)

        if min_next > max_current and min_next > 0:
            gap_width = min_next - max_current
            center_freq = (max_current + min_next) / 2
            if center_freq <= 0:
                continue
            relative_width = gap_width / center_freq

            if relative_width > threshold_ratio:
                band_gaps.append({
                    "start": float(max_current),
                    "end": float(min_next),
                    "width": float(gap_width),
                    "center": float(center_freq),
                    "relative_width": float(relative_width)
                })

    return band_gaps


def calculate_objective_score(band_gaps: List[Dict],
                              target_start: float = 500.0,
                              target_end: float = 800.0) -> float:
    if not band_gaps:
        return 1e5

    target_center = (target_start + target_end) / 2
    target_width = target_end - target_start
    best_score = 1e5

    for gap in band_gaps:
        gap_center = gap["center"]
        gap_width = gap["width"]
        gap_rel_width = gap["relative_width"]

        overlap_start = max(gap["start"], target_start)
        overlap_end = min(gap["end"], target_end)
        overlap = max(0, overlap_end - overlap_start)

        if overlap > 0:
            coverage_ratio = overlap / target_width
            center_distance = abs(gap_center - target_center) / target_width
            width_ratio = min(gap_width / target_width, 1.0)

            score = (
                (1.0 - coverage_ratio) * 100
                + center_distance * 40
                + (1.0 - width_ratio) * 20
                + (1.0 - min(gap_rel_width, 1.0)) * 30
            )
        else:
            distance_to_target = min(
                abs(gap["end"] - target_start),
                abs(target_end - gap["start"])
            )
            score = 200 + distance_to_target / target_width * 100

        best_score = min(best_score, score)

    return best_score
