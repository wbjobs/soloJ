import os
import numpy as np
from typing import Dict, List, Tuple, Optional, Callable
from dataclasses import dataclass, field
import logging
from datetime import datetime
import json

from .utils import enforce_physical_constraints, validate_params, calculate_objective_score

logger = logging.getLogger(__name__)

PARAM_NAMES_CN = {
    'lattice_constant': '晶格常数',
    'cylinder_radius': '柱体半径',
    'cylinder_height': '柱体高度',
    'matrix_density': '基体密度',
    'matrix_speed_of_sound': '基体声速',
    'scatterer_density': '散射体密度',
    'scatterer_speed_of_sound': '散射体声速',
    'filling_fraction': '填充率'
}


@dataclass
class SensitivityResult:
    param_names: List[str]
    first_order: np.ndarray
    total_order: np.ndarray
    second_order: Optional[np.ndarray] = None
    confidence_intervals: Optional[Dict] = None
    sample_count: int = 0
    target_start: float = 500.0
    target_end: float = 800.0
    model_used: str = 'surrogate'

    def to_dict(self) -> Dict:
        result = {
            'param_names': self.param_names,
            'param_names_cn': [PARAM_NAMES_CN.get(p, p) for p in self.param_names],
            'first_order': self.first_order.tolist(),
            'total_order': self.total_order.tolist(),
            'sample_count': self.sample_count,
            'target_range': [self.target_start, self.target_end],
            'model_used': self.model_used,
            'ranking': self._get_ranking()
        }
        if self.second_order is not None:
            result['second_order'] = self.second_order.tolist()
        return result

    def _get_ranking(self) -> List[Dict]:
        indices = np.argsort(-self.total_order)
        ranking = []
        for i, idx in enumerate(indices):
            ranking.append({
                'rank': i + 1,
                'param_name': self.param_names[idx],
                'param_name_cn': PARAM_NAMES_CN.get(self.param_names[idx], self.param_names[idx]),
                'first_order': float(self.first_order[idx]),
                'total_order': float(self.total_order[idx]),
                'contribution_pct': float(self.total_order[idx] / max(self.total_order.sum(), 1e-8) * 100)
            })
        return ranking


class SobolSensitivityAnalysis:
    def __init__(self, surrogate_model=None):
        self.param_names = [
            'lattice_constant',
            'cylinder_radius',
            'cylinder_height',
            'matrix_density',
            'matrix_speed_of_sound',
            'scatterer_density',
            'scatterer_speed_of_sound',
            'filling_fraction'
        ]

        self.default_bounds = {
            'lattice_constant': [0.03, 0.08],
            'cylinder_radius': [0.008, 0.03],
            'cylinder_height': [0.02, 0.06],
            'matrix_density': [900.0, 1800.0],
            'matrix_speed_of_sound': [1800.0, 3500.0],
            'scatterer_density': [3000.0, 9000.0],
            'scatterer_speed_of_sound': [3500.0, 7000.0],
            'filling_fraction': [0.15, 0.5]
        }

        self.surrogate_model = surrogate_model
        self.fem_client = None

    def set_bounds(self, bounds: Dict[str, Tuple[float, float]]):
        for k, v in bounds.items():
            if k in self.default_bounds:
                self.default_bounds[k] = list(v)

    def _get_problem(self) -> Dict:
        return {
            'num_vars': len(self.param_names),
            'names': self.param_names,
            'bounds': [self.default_bounds[p] for p in self.param_names]
        }

    def _generate_samples(self, n_samples: int = 4096) -> Tuple[np.ndarray, np.ndarray]:
        try:
            from SALib.sample import saltelli
            problem = self._get_problem()
            param_values = saltelli.sample(problem, n_samples, calc_second_order=True)
            return param_values, problem
        except ImportError:
            logger.warning("SALib not available, using latin hypercube sampling")
            return self._generate_lhs_samples(n_samples)

    def _generate_lhs_samples(self, n_samples: int) -> Tuple[np.ndarray, Dict]:
        problem = self._get_problem()
        n_params = len(self.param_names)
        N = n_samples * (n_params + 2)

        lhs = np.zeros((N, n_params))
        for i in range(n_params):
            lo, hi = self.default_bounds[self.param_names[i]]
            perm = np.random.permutation(N)
            for j in range(N):
                lhs[perm[j], i] = lo + (j + np.random.random()) / N * (hi - lo)

        return lhs, problem

    def _evaluate_model(self, param_values: np.ndarray,
                        target_start: float, target_end: float,
                        use_surrogate: bool = True) -> np.ndarray:

        n_samples = len(param_values)
        y = np.zeros(n_samples)

        if use_surrogate and self.surrogate_model is not None:
            params_list = []
            valid_indices = []

            for i in range(n_samples):
                params = {self.param_names[j]: float(param_values[i, j]) for j in range(len(self.param_names))}
                params = enforce_physical_constraints(params)
                valid, _ = validate_params(params)

                if valid:
                    params_list.append(params)
                    valid_indices.append(i)
                else:
                    y[i] = 1e5

            if params_list:
                scores, _ = self.surrogate_model.predict_batch(params_list, return_std=False)
                for idx, valid_idx in enumerate(valid_indices):
                    y[valid_idx] = float(scores[idx])

            return y

        elif self.fem_client is not None:
            for i in range(n_samples):
                params = {self.param_names[j]: float(param_values[i, j]) for j in range(len(self.param_names))}
                params = enforce_physical_constraints(params)
                valid, _ = validate_params(params)

                if not valid:
                    y[i] = 1e5
                    continue

                try:
                    result = self.fem_client.compute(
                        params,
                        compute_band_structure=True,
                        compute_transmission_loss=False,
                        timeout=120
                    )

                    if result.get('status') == 'completed':
                        eigenvalues = result.get('band_structure', {}).get('eigenvalues', [])
                        band_gaps = self.fem_client.extract_band_gaps(eigenvalues)
                        y[i] = calculate_objective_score(band_gaps, target_start, target_end)
                    else:
                        y[i] = 1e5
                except:
                    y[i] = 1e5

            return y
        else:
            raise RuntimeError("No evaluation model available (neither surrogate nor FEM client)")

    def _calculate_objective(self, band_gaps: List[Dict], target_start: float, target_end: float) -> float:
        return calculate_objective_score(band_gaps, target_start, target_end)

    def analyze(self,
                n_samples: int = 4096,
                target_start: float = 500.0,
                target_end: float = 800.0,
                use_surrogate: bool = True,
                calc_second_order: bool = True) -> SensitivityResult:

        logger.info(f"Starting Sobol sensitivity analysis with {n_samples} samples...")
        logger.info(f"Target band gap: {target_start}-{target_end} Hz")
        logger.info(f"Using surrogate: {use_surrogate}")

        param_values, problem = self._generate_samples(n_samples)

        logger.info(f"Generated {len(param_values)} samples, evaluating...")
        y = self._evaluate_model(param_values, target_start, target_end, use_surrogate)

        valid_count = np.sum(y < 1e4)
        logger.info(f"Evaluation complete. Valid samples: {valid_count}/{len(y)}")

        try:
            from SALib.analyze import sobol
            Si = sobol.analyze(
                problem,
                y,
                calc_second_order=calc_second_order,
                print_to_console=False
            )

            result = SensitivityResult(
                param_names=self.param_names,
                first_order=np.nan_to_num(Si['S1'], nan=0.0, posinf=0.0, neginf=0.0),
                total_order=np.nan_to_num(Si['ST'], nan=0.0, posinf=0.0, neginf=0.0),
                second_order=np.nan_to_num(Si['S2'], nan=0.0, posinf=0.0, neginf=0.0) if calc_second_order else None,
                sample_count=valid_count,
                target_start=target_start,
                target_end=target_end,
                model_used='surrogate' if use_surrogate else 'fem'
            )

            total_sum = result.total_order.sum()
            if total_sum < 0.8:
                logger.warning(f"Total Sobol indices sum to {total_sum:.3f}, may indicate missing interactions")

            result.first_order = np.maximum(result.first_order, 0)
            result.total_order = np.maximum(result.total_order, 0)

            logger.info("Sensitivity analysis complete:")
            for item in result._get_ranking():
                logger.info(f"  {item['rank']}. {item['param_name_cn']}: ST={item['total_order']:.3f} ({item['contribution_pct']:.1f}%)")

            return result

        except ImportError:
            logger.error("SALib is required for Sobol analysis. Install with: pip install SALib")
            raise
        except Exception as e:
            logger.error(f"Sobol analysis failed: {e}")
            raise

    def analyze_with_fem(self, fem_client, n_samples: int = 128,
                         target_start: float = 500.0, target_end: float = 800.0):
        self.fem_client = fem_client
        return self.analyze(
            n_samples=n_samples,
            target_start=target_start,
            target_end=target_end,
            use_surrogate=False
        )


def run_sensitivity_analysis(
    n_samples: int = 4096,
    target_start: float = 500.0,
    target_end: float = 800.0,
    hdf5_path: str = None,
    train_if_needed: bool = True
) -> Dict:
    from .nn_surrogate import SurrogateModelTrainer
    surrogate = SurrogateModelTrainer(hdf5_path)
    if not surrogate.load() and train_if_needed:
        logger.info("Training surrogate model for sensitivity analysis...")
        surrogate.prepare_data(use_synthetic_if_empty=True, n_synthetic=2000)
        surrogate.train(epochs=150)

    analyzer = SobolSensitivityAnalysis(surrogate_model=surrogate)
    result = analyzer.analyze(
        n_samples=n_samples,
        target_start=target_start,
        target_end=target_end,
        use_surrogate=True
    )

    return result.to_dict()
