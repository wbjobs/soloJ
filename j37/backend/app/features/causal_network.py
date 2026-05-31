import numpy as np
from typing import Dict, List, Optional, Tuple
from itertools import combinations
import math

from app.features.causality import (
    transfer_entropy,
    granger_causality_test,
    estimate_delay_te,
    estimate_delay_xcorr,
)


class CausalInferenceEngine:
    def __init__(
        self,
        te_k: int = 2,
        te_bins: int = 8,
        gc_max_lag: int = 10,
        gc_auto_lag: bool = True,
        te_weight: float = 0.5,
        gc_weight: float = 0.3,
        xcorr_weight: float = 0.2,
        significance_threshold: float = 0.05,
        min_edge_strength: float = 0.1,
        max_delay_samples: int = 100,
    ):
        self.te_k = te_k
        self.te_bins = te_bins
        self.gc_max_lag = gc_max_lag
        self.gc_auto_lag = gc_auto_lag
        self.te_weight = te_weight
        self.gc_weight = gc_weight
        self.xcorr_weight = xcorr_weight
        self.significance_threshold = significance_threshold
        self.min_edge_strength = min_edge_strength
        self.max_delay_samples = max_delay_samples

    def infer_pairwise(
        self, source_signal: np.ndarray, target_signal: np.ndarray
    ) -> Dict:
        n = len(source_signal)
        if n < self.te_k * 4:
            return {
                "te": 0.0,
                "gc_f_stat": 0.0,
                "gc_p_value": 1.0,
                "gc_causal": False,
                "gc_lag": 0,
                "delay_te": 0,
                "delay_xcorr": 0,
                "delay": 0,
                "strength": 0.0,
                "direction": 0,
            }

        te_forward = transfer_entropy(
            source_signal, target_signal, k=self.te_k, n_bins=self.te_bins
        )
        te_backward = transfer_entropy(
            target_signal, source_signal, k=self.te_k, n_bins=self.te_bins
        )

        te_net = te_forward - te_backward

        gc_result = granger_causality_test(
            source_signal,
            target_signal,
            max_lag=self.gc_max_lag,
            auto_lag_selection=self.gc_auto_lag,
        )

        gc_score = 0.0
        if gc_result["causal"]:
            gc_score = min(1.0, gc_result["f_statistic"] / 10.0)

        delay_te, te_corr = estimate_delay_te(
            source_signal,
            target_signal,
            max_delay=min(self.max_delay_samples, n // 10),
            k=self.te_k,
        )
        delay_xcorr, xcorr_score = estimate_delay_xcorr(
            source_signal,
            target_signal,
            max_delay=min(self.max_delay_samples, n // 10),
        )

        te_norm = math.tanh(abs(te_net) * 10) * np.sign(te_net)

        strength = (
            self.te_weight * abs(te_norm)
            + self.gc_weight * gc_score
            + self.xcorr_weight * abs(xcorr_score)
        )

        direction = 1 if te_net > 0 else (-1 if te_net < 0 else 0)

        if direction > 0:
            final_delay = int(round(
                self.te_weight * delay_te + self.xcorr_weight * delay_xcorr
            ))
        else:
            final_delay = -int(round(
                self.te_weight * delay_te + self.xcorr_weight * delay_xcorr
            ))

        return {
            "te_forward": float(te_forward),
            "te_backward": float(te_backward),
            "te_net": float(te_net),
            "gc_f_stat": float(gc_result["f_statistic"]),
            "gc_p_value": float(gc_result["p_value"]),
            "gc_causal": gc_result["causal"],
            "gc_lag": gc_result["best_lag"],
            "delay_te": int(delay_te),
            "delay_xcorr": int(delay_xcorr),
            "delay_estimate": int(final_delay),
            "strength": float(strength),
            "direction": int(direction),
            "significant": gc_result["causal"] and strength > self.min_edge_strength,
        }

    def infer_network(
        self,
        signals: Dict[str, np.ndarray],
        sample_rate: int = 50000,
    ) -> Dict:
        node_ids = list(signals.keys())
        n_nodes = len(node_ids)

        nodes = []
        for i, node_id in enumerate(node_ids):
            sig = signals[node_id]
            rms_val = float(np.sqrt(np.mean(sig ** 2)))
            kurtosis = float(stats.kurtosis(sig, fisher=True)) if hasattr(stats, 'kurtosis') else 0.0
            nodes.append({
                "id": node_id,
                "index": i,
                "rms": rms_val,
                "energy": float(np.sum(sig ** 2)),
                "kurtosis": kurtosis,
            })

        edges = []
        for i, j in combinations(range(n_nodes), 2):
            source_id = node_ids[i]
            target_id = node_ids[j]
            source_sig = signals[source_id]
            target_sig = signals[target_id]

            min_len = min(len(source_sig), len(target_sig))
            source_sig = source_sig[:min_len]
            target_sig = target_sig[:min_len]

            result = self.infer_pairwise(source_sig, target_sig)

            if result["direction"] != 0:
                src = source_id if result["direction"] > 0 else target_id
                tgt = target_id if result["direction"] > 0 else source_id
                delay_samples = abs(result["delay_estimate"])
                delay_ms = (delay_samples / sample_rate) * 1000

                edges.append({
                    "source": src,
                    "target": tgt,
                    "strength": result["strength"],
                    "delay_samples": delay_samples,
                    "delay_ms": round(delay_ms, 3),
                    "te_net": result["te_net"],
                    "gc_f_stat": result["gc_f_stat"],
                    "gc_p_value": result["gc_p_value"],
                    "significant": result["significant"],
                    "bidirectional": False,
                })

        edges_sorted = sorted(
            [e for e in edges if e["significant"] or e["strength"] > self.min_edge_strength],
            key=lambda x: x["strength"],
            reverse=True,
        )

        max_strength = max([e["strength"] for e in edges_sorted]) if edges_sorted else 1.0
        for e in edges_sorted:
            e["normalized_strength"] = round(e["strength"] / max_strength, 4)

        propagation_paths = self._find_propagation_paths(nodes, edges_sorted)

        return {
            "nodes": nodes,
            "edges": edges_sorted,
            "sample_rate": sample_rate,
            "max_delay_ms": max([e["delay_ms"] for e in edges_sorted]) if edges_sorted else 0,
            "propagation_paths": propagation_paths,
        }

    def _find_propagation_paths(
        self, nodes: List[Dict], edges: List[Dict], max_path_length: int = 5
    ) -> List[Dict]:
        if not edges:
            return []

        adjacency = {n["id"]: [] for n in nodes}
        for e in edges:
            adjacency[e["source"]].append((e["target"], e))

        paths = []
        for start_node in [n["id"] for n in nodes]:
            self._dfs_paths(start_node, adjacency, [], paths, max_path_length)

        paths_sorted = sorted(paths, key=lambda p: p["total_delay"], reverse=True)
        return paths_sorted[:10]

    def _dfs_paths(
        self,
        current: str,
        adjacency: Dict[str, List[Tuple[str, Dict]]],
        current_path: List,
        all_paths: List,
        max_length: int,
    ):
        if len(current_path) >= max_length:
            if len(current_path) >= 2:
                total_delay = sum(step["delay_ms"] for step in current_path)
                total_strength = sum(step["strength"] for step in current_path)
                all_paths.append({
                    "path": [step["source"] for step in current_path] + [current],
                    "total_delay": round(total_delay, 3),
                    "avg_strength": round(total_strength / len(current_path), 4),
                    "hops": len(current_path),
                })
            return

        if len(current_path) >= 2:
            total_delay = sum(step["delay_ms"] for step in current_path)
            total_strength = sum(step["strength"] for step in current_path)
            all_paths.append({
                "path": [step["source"] for step in current_path] + [current],
                "total_delay": round(total_delay, 3),
                "avg_strength": round(total_strength / len(current_path), 4),
                "hops": len(current_path),
            })

        for neighbor, edge in adjacency[current]:
            if any(step["source"] == neighbor for step in current_path):
                continue
            self._dfs_paths(neighbor, adjacency, current_path + [edge], all_paths, max_length)


from scipy import stats
