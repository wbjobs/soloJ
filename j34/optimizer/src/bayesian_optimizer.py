import nevergrad as ng
import numpy as np
from typing import Dict, List, Tuple, Optional, Callable
from dataclasses import dataclass, field
import json
from datetime import datetime
import logging
import math
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

from .fem_client import FEMClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class OptimizationConfig:
    target_band_gap_start: float = 500.0
    target_band_gap_end: float = 800.0
    budget: int = 80
    num_workers: int = 4
    optimizer: str = "TwoPointsDE"
    use_multi_fidelity: bool = True
    use_surrogate: bool = True
    surrogate_top_k: int = 3
    surrogate_uncertainty_threshold: float = 20.0
    warm_start_samples: int = 10
    param_limits: Dict[str, Tuple[float, float]] = field(default_factory=lambda: {
        "lattice_constant": (0.03, 0.08),
        "cylinder_radius": (0.008, 0.03),
        "cylinder_height": (0.02, 0.06),
        "matrix_density": (900.0, 1800.0),
        "matrix_speed_of_sound": (1800.0, 3500.0),
        "scatterer_density": (3000.0, 9000.0),
        "scatterer_speed_of_sound": (3500.0, 7000.0),
        "filling_fraction": (0.15, 0.5)
    })


@dataclass
class OptimizationResult:
    best_params: Dict[str, float]
    best_objective: float
    best_band_gaps: List[Dict]
    optimization_history: List[Dict]
    config: OptimizationConfig


from .utils import (
    enforce_physical_constraints as _enforce_physical_constraints,
    validate_params as _validate_params
)

def enforce_physical_constraints(params: Dict[str, float]) -> Dict[str, float]:
    return _enforce_physical_constraints(params)

def validate_params(params: Dict[str, float]) -> Tuple[bool, str]:
    return _validate_params(params)


class BandGapOptimizer:
    def __init__(self, config: OptimizationConfig, fem_client: Optional[FEMClient] = None,
                 surrogate_model=None):
        self.config = config
        self.fem_client = fem_client or FEMClient()
        self.optimization_history: List[Dict] = []
        self.iteration_count = 0
        self._on_iteration_callback: Optional[Callable] = None
        self._timeout_seconds = 120
        self._surrogate_model = surrogate_model
        self._cache = {}
        self._surrogate_stats = {'total_calls': 0, 'surrogate_filtered': 0, 'fem_calls': 0}

        if self.config.use_surrogate and self._surrogate_model is None:
            try:
                from .nn_surrogate import SurrogateModelTrainer
                self._surrogate_trainer = SurrogateModelTrainer()
                if self._surrogate_trainer.load():
                    self._surrogate_model = self._surrogate_trainer
                    logger.info("Surrogate model loaded successfully")
                else:
                    logger.info("No pre-trained surrogate model found, will train on first use")
            except Exception as e:
                logger.warning(f"Failed to initialize surrogate model: {e}")
                self.config.use_surrogate = False

    def set_iteration_callback(self, callback: Callable):
        self._on_iteration_callback = callback

    def _surrogate_predict_batch(self, params_list: List[Dict[str, float]]) -> Tuple[np.ndarray, np.ndarray]:
        if self._surrogate_model is None:
            return None, None
        try:
            predictions, stds = self._surrogate_model.predict_batch(
                params_list, return_std=True
            )
            return predictions, stds
        except Exception as e:
            logger.debug(f"Surrogate prediction failed: {e}")
            return None, None

    def _surrogate_filter_candidates(self, params_batch: List[Dict[str, float]]) -> List[int]:
        if not self.config.use_surrogate or self._surrogate_model is None:
            return list(range(len(params_batch)))

        predictions, stds = self._surrogate_predict_batch(params_batch)

        if predictions is None:
            return list(range(len(params_batch)))

        self._surrogate_stats['total_calls'] += len(params_batch)

        scores = predictions + stds * 0.1

        top_k = min(self.config.surrogate_top_k, len(params_batch))
        top_indices = np.argsort(scores)[:top_k].tolist()

        uncertain_indices = [
            i for i in range(len(params_batch))
            if stds[i] > self.config.surrogate_uncertainty_threshold
        ]

        final_indices = list(set(top_indices + uncertain_indices[:2]))
        final_indices = sorted(final_indices)[:top_k]

        self._surrogate_stats['surrogate_filtered'] += (len(params_batch) - len(final_indices))
        self._surrogate_stats['fem_calls'] += len(final_indices)

        if len(params_batch) > 5:
            logger.debug(
                f"Surrogate filtered: {len(params_batch)} → {len(final_indices)} "
                f"(saved {len(params_batch) - len(final_indices)} FEM calls)"
            )

        return final_indices

    def train_surrogate_model(self, n_synthetic: int = 2000, epochs: int = 200) -> Dict:
        try:
            from .nn_surrogate import SurrogateModelTrainer
            self._surrogate_trainer = SurrogateModelTrainer()
            result = self._surrogate_trainer.prepare_data(
                use_synthetic_if_empty=True,
                n_synthetic=n_synthetic
            )
            if result:
                training_result = self._surrogate_trainer.train(epochs=epochs)
                self._surrogate_model = self._surrogate_trainer
                self.config.use_surrogate = True
                return training_result
        except Exception as e:
            logger.error(f"Failed to train surrogate model: {e}")
            return {"error": str(e)}

    def _cached_objective(self, params: Dict[str, float], fidelity: str = "high") -> float:
        cache_key = json.dumps({**params, "fidelity": fidelity}, sort_keys=True)
        if cache_key in self._cache:
            return self._cache[cache_key]

        score = self._evaluate_with_timeout(params, fidelity)
        self._cache[cache_key] = score
        return score

    def _evaluate_with_timeout(self, params: Dict[str, float], fidelity: str = "high") -> float:
        params = enforce_physical_constraints(params)

        valid, msg = validate_params(params)
        if not valid:
            logger.debug(f"参数校验失败: {msg}")
            return 1e9

        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(
                    self._single_evaluation,
                    params,
                    fidelity
                )
                result = future.result(timeout=self._timeout_seconds)
                return result
        except FutureTimeoutError:
            logger.warning(f"FEM计算超时 (>{self._timeout_seconds}s)，参数: {params}")
            return 1e8
        except Exception as e:
            logger.error(f"目标函数异常: {e}")
            return 1e7

    def _single_evaluation(self, params: Dict[str, float], fidelity: str = "high") -> float:
        num_bands = 12 if fidelity == "low" else 15
        k_res = 10 if fidelity == "low" else 15

        result = self.fem_client.compute(
            params,
            compute_band_structure=True,
            compute_transmission_loss=False
        )

        if result.get("status") != "completed":
            logger.warning(f"Compute failed: {result.get('error')}")
            return 1e6

        eigenvalues = result.get("band_structure", {}).get("eigenvalues", [])
        band_gaps = FEMClient.extract_band_gaps(eigenvalues)

        score = self._calculate_objective_score(band_gaps)

        if fidelity == "high":
            self.iteration_count += 1
            history_entry = {
                "iteration": self.iteration_count,
                "params": params,
                "band_gaps": band_gaps,
                "objective_score": score,
                "fidelity": fidelity,
                "timestamp": datetime.now().isoformat()
            }
            self.optimization_history.append(history_entry)

            if self._on_iteration_callback:
                self._on_iteration_callback(history_entry)

            logger.info(f"Iteration {self.iteration_count}: score={score:.2f}, gaps={len(band_gaps)}")

        return score

    def _calculate_objective_score(self, band_gaps: List[Dict]) -> float:
        if not band_gaps:
            return 1e5

        target_start = self.config.target_band_gap_start
        target_end = self.config.target_band_gap_end
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

    def _generate_warm_start_points(self) -> List[Dict[str, float]]:
        points = []
        a_min, a_max = self.config.param_limits["lattice_constant"]
        r_min, r_max = self.config.param_limits["cylinder_radius"]

        for i in range(self.config.warm_start_samples):
            a = a_min + (a_max - a_min) * (i + 1) / (self.config.warm_start_samples + 1)
            r_max_allowed = a / 2 * 0.85
            r = r_min + (min(r_max, r_max_allowed) - r_min) * (i + 1) / (self.config.warm_start_samples + 1)

            base_params = {
                "lattice_constant": a,
                "cylinder_radius": r,
                "cylinder_height": self.config.param_limits["cylinder_height"][0] +
                (self.config.param_limits["cylinder_height"][1] - self.config.param_limits["cylinder_height"][0]) * 0.5,
                "matrix_density": 1200.0,
                "matrix_speed_of_sound": 2500.0,
                "scatterer_density": 7800.0,
                "scatterer_speed_of_sound": 5000.0,
                "filling_fraction": math.pi * (r ** 2) / (a ** 2)
            }
            points.append(enforce_physical_constraints(base_params))

        return points

    def optimize(self) -> OptimizationResult:
        parametrization = ng.p.Dict()

        for param_name, (min_val, max_val) in self.config.param_limits.items():
            init_val = (min_val + max_val) / 2
            if param_name == "lattice_constant":
                init_val = 0.05
            elif param_name == "cylinder_radius":
                init_val = 0.015

            parametrization[param_name] = ng.p.Scalar(
                init=init_val,
                lower=min_val,
                upper=max_val
            )

        parametrization.set_name("params")

        optimizer_name = self.config.optimizer
        if optimizer_name == "BO":
            optimizer_class = ng.optimizers.BO
        elif optimizer_name == "TwoPointsDE":
            optimizer_class = ng.optimizers.TwoPointsDE
        elif optimizer_name == "CMA":
            optimizer_class = ng.optimizers.CMA
        elif optimizer_name == "PSO":
            optimizer_class = ng.optimizers.PSO
        else:
            optimizer_class = ng.optimizers.registry.get(optimizer_name, ng.optimizers.TwoPointsDE)

        logger.info(f"Starting optimization with {optimizer_name.__name__}, budget={self.config.budget}")

        if self.config.use_multi_fidelity and self.config.warm_start_samples > 0:
            logger.info(f"Generating {self.config.warm_start_samples} warm-start points (low-fidelity)...")
            warm_points = self._generate_warm_start_points()
            for i, point in enumerate(warm_points):
                low_score = self._cached_objective(point, fidelity="low")
                logger.info(f"Warm-start {i+1}/{len(warm_points)}: low_score={low_score:.2f}")

        budget = self.config.budget
        effective_budget = max(budget - len(self.optimization_history), 10)

        optimizer = optimizer_class(
            parametrization=parametrization,
            budget=effective_budget,
            num_workers=self.config.num_workers,
            noisy=True
        )

        if hasattr(optimizer, 'tell') and self.optimization_history:
            for entry in self.optimization_history:
                try:
                    params_ng = ng.p.Dict()
                    for k, v in entry["params"].items():
                        mn, mx = self.config.param_limits[k]
                        params_ng[k] = ng.p.Scalar(init=v, lower=mn, upper=mx)
                    optimizer.tell(params_ng, entry["objective_score"])
                except:
                    pass

        recommendation = optimizer.minimize(self.objective_function)

        best_params_raw = {k: float(v) for k, v in recommendation.value.items()}
        best_params = enforce_physical_constraints(best_params_raw)

        logger.info(f"Optimization complete. Best score: {recommendation.loss:.4f}")
        logger.info("Computing final high-fidelity result...")

        final_result = self.fem_client.compute(
            best_params,
            compute_band_structure=True,
            compute_transmission_loss=True
        )

        eigenvalues = final_result.get("band_structure", {}).get("eigenvalues", [])
        best_band_gaps = FEMClient.extract_band_gaps(eigenvalues)

        return OptimizationResult(
            best_params=best_params,
            best_objective=recommendation.loss,
            best_band_gaps=best_band_gaps,
            optimization_history=self.optimization_history,
            config=self.config
        )

    def objective_function(self, **kwargs) -> float:
        params = {k: float(v) for k, v in kwargs.items()}
        return self._cached_objective(params, fidelity="high")

    def save_result(self, result: OptimizationResult, filepath: str):
        with open(filepath, 'w') as f:
            json.dump({
                "best_params": result.best_params,
                "best_objective": result.best_objective,
                "best_band_gaps": result.best_band_gaps,
                "config": {
                    "target_band_gap_start": result.config.target_band_gap_start,
                    "target_band_gap_end": result.config.target_band_gap_end,
                    "budget": result.config.budget,
                    "num_workers": result.config.num_workers,
                    "optimizer": result.config.optimizer,
                    "param_limits": result.config.param_limits
                },
                "optimization_history": result.optimization_history
            }, f, indent=2)
