import os
import json
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class BandGapDataset:
    PARAM_NAMES = [
        'lattice_constant',
        'cylinder_radius',
        'cylinder_height',
        'matrix_density',
        'matrix_speed_of_sound',
        'scatterer_density',
        'scatterer_speed_of_sound',
        'filling_fraction'
    ]

    def __init__(self, hdf5_base_path: str = None):
        if hdf5_base_path is None:
            hdf5_base_path = os.environ.get(
                'HDF5_BASE_PATH',
                os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'hdf5')
            )
        self.hdf5_base_path = hdf5_base_path
        self.X: np.ndarray = None
        self.y: np.ndarray = None
        self.param_ranges: Dict[str, Tuple[float, float]] = {}

    def load_from_hdf5(self, max_files: int = 100) -> Tuple[np.ndarray, np.ndarray]:
        X_list = []
        y_list = []

        if not os.path.exists(self.hdf5_base_path):
            logger.warning(f"HDF5 path not found: {self.hdf5_base_path}")
            return np.array([]), np.array([])

        files = sorted([f for f in os.listdir(self.hdf5_base_path) if f.endswith('.h5')])
        files = files[:max_files]

        logger.info(f"Loading data from {len(files)} HDF5 files...")

        for filename in files:
            filepath = os.path.join(self.hdf5_base_path, filename)
            try:
                import h5py
                with h5py.File(filepath, 'r') as f:
                    if 'best_parameters' not in f:
                        continue
                    if 'optimization_history' not in f:
                        continue

                    params_grp = f['best_parameters']
                    best_params = {k: float(params_grp.attrs[k]) for k in self.PARAM_NAMES if k in params_grp.attrs}

                    hist_grp = f['optimization_history']
                    if 'scores' in hist_grp:
                        scores = hist_grp['scores'][:]

                        for i in range(len(scores)):
                            params_vec = []
                            for name in self.PARAM_NAMES:
                                ds_name = f'param_{name}'
                                if ds_name in hist_grp:
                                    params_vec.append(float(hist_grp[ds_name][i]))
                                elif name in best_params:
                                    params_vec.append(best_params[name])
                                else:
                                    params_vec.append(0.0)

                            X_list.append(params_vec)
                            y_list.append(float(scores[i]))

            except Exception as e:
                logger.warning(f"Error loading {filename}: {e}")
                continue

        if len(X_list) == 0:
            logger.warning("No valid data loaded from HDF5 files")
            return np.array([]), np.array([])

        self.X = np.array(X_list, dtype=np.float32)
        self.y = np.array(y_list, dtype=np.float32).reshape(-1, 1)

        logger.info(f"Loaded {len(self.X)} samples")

        self._compute_param_ranges()
        return self.X, self.y

    def load_from_redis(self, redis_conn, max_samples: int = 500) -> Tuple[np.ndarray, np.ndarray]:
        X_list = []
        y_list = []

        keys = redis_conn.keys("optimization_result:*")
        logger.info(f"Found {len(keys)} optimization results in Redis")

        for key in keys[:max_samples]:
            try:
                data = json.loads(redis_conn.get(key))
                history = data.get('optimization_history', [])

                for entry in history:
                    params = entry.get('params', {})
                    score = entry.get('objective_score', 1e6)

                    if score >= 1e5:
                        continue

                    params_vec = [float(params.get(name, 0.0)) for name in self.PARAM_NAMES]
                    X_list.append(params_vec)
                    y_list.append(float(score))

            except Exception as e:
                logger.warning(f"Error loading {key}: {e}")
                continue

        if len(X_list) == 0:
            return np.array([]), np.array([])

        self.X = np.array(X_list, dtype=np.float32)
        self.y = np.array(y_list, dtype=np.float32).reshape(-1, 1)
        logger.info(f"Loaded {len(self.X)} samples from Redis")

        self._compute_param_ranges()
        return self.X, self.y

    def generate_synthetic_data(self, n_samples: int = 1000) -> Tuple[np.ndarray, np.ndarray]:
        logger.info(f"Generating {n_samples} synthetic training samples...")

        param_ranges = {
            'lattice_constant': (0.03, 0.08),
            'cylinder_radius': (0.008, 0.03),
            'cylinder_height': (0.02, 0.06),
            'matrix_density': (900, 1800),
            'matrix_speed_of_sound': (1800, 3500),
            'scatterer_density': (3000, 9000),
            'scatterer_speed_of_sound': (3500, 7000),
            'filling_fraction': (0.15, 0.5)
        }

        X = np.zeros((n_samples, 8), dtype=np.float32)
        y = np.zeros((n_samples, 1), dtype=np.float32)

        for i in range(n_samples):
            params = {}
            for j, name in enumerate(self.PARAM_NAMES):
                lo, hi = param_ranges[name]
                params[name] = float(lo + np.random.random() * (hi - lo))
                X[i, j] = params[name]

            a = params['lattice_constant']
            r = params['cylinder_radius']
            rho_m = params['matrix_density']
            rho_s = params['scatterer_density']
            c_m = params['matrix_speed_of_sound']
            c_s = params['scatterer_speed_of_sound']

            delta_rho = abs(rho_s - rho_m) / max(rho_m, rho_s)
            delta_c = abs(c_s - c_m) / max(c_m, c_s)
            impedance_contrast = delta_rho * delta_c

            ff = np.pi * r * r / (a * a)
            ff_penalty = max(0, ff - 0.6) * 100

            gap_width = 200 * impedance_contrast * np.sqrt(ff)
            center_freq = c_m / (4 * a) * np.sqrt(1 + 0.5 * impedance_contrast)

            target_center = 650
            target_width = 300

            center_error = abs(center_freq - target_center) / target_width * 50
            width_error = max(0, target_width - gap_width) / target_width * 30

            score = center_error + width_error + ff_penalty + 20 * (1 - impedance_contrast)
            score = max(0, score + np.random.normal(0, 5))

            y[i] = score

        self.X = X
        self.y = y
        self._compute_param_ranges()
        logger.info(f"Synthetic data generated: X={X.shape}, y={y.shape}")
        return X, y

    def _compute_param_ranges(self):
        if self.X is None or len(self.X) == 0:
            return
        for i, name in enumerate(self.PARAM_NAMES):
            self.param_ranges[name] = (float(self.X[:, i].min()), float(self.X[:, i].max()))

    def normalize_X(self, X: np.ndarray) -> np.ndarray:
        X_norm = np.zeros_like(X, dtype=np.float32)
        for i, name in enumerate(self.PARAM_NAMES):
            lo, hi = self.param_ranges.get(name, (0, 1))
            if hi > lo:
                X_norm[:, i] = (X[:, i] - lo) / (hi - lo)
        return X_norm

    def normalize_y(self, y: np.ndarray) -> np.ndarray:
        if self.y is None or len(self.y) == 0:
            return y
        self.y_mean = float(np.mean(self.y))
        self.y_std = float(np.std(self.y)) + 1e-8
        return (y - self.y_mean) / self.y_std

    def denormalize_y(self, y_norm: np.ndarray) -> np.ndarray:
        return y_norm * self.y_std + self.y_mean

    def train_test_split(self, test_ratio: float = 0.2) -> Tuple:
        if self.X is None:
            raise ValueError("No data loaded")

        n = len(self.X)
        indices = np.random.permutation(n)
        split = int(n * (1 - test_ratio))

        X_train, X_test = self.X[indices[:split]], self.X[indices[split:]]
        y_train, y_test = self.y[indices[:split]], self.y[indices[split:]]

        return X_train, X_test, y_train, y_test
