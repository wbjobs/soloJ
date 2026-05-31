import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.svm import OneClassSVM
from sklearn.preprocessing import StandardScaler
from typing import Dict, List, Optional, Tuple
import joblib
import os

from app.config import FEATURE_NAMES, FAULT_TYPES


class EnsembleAnomalyDetector:
    def __init__(
        self,
        if_contamination: float = 0.05,
        if_n_estimators: int = 200,
        if_max_samples: str = "auto",
        svm_nu: float = 0.05,
        svm_kernel: str = "rbf",
        svm_gamma: str = "scale",
    ):
        self.if_contamination = if_contamination
        self.if_n_estimators = if_n_estimators
        self.if_max_samples = if_max_samples
        self.svm_nu = svm_nu
        self.svm_kernel = svm_kernel
        self.svm_gamma = svm_gamma
        self.if_model = IsolationForest(
            contamination=if_contamination,
            n_estimators=if_n_estimators,
            max_samples=if_max_samples,
            random_state=42,
            n_jobs=-1,
            warm_start=True,
        )
        self.svm_model = OneClassSVM(
            nu=svm_nu, kernel=svm_kernel, gamma=svm_gamma
        )
        self.scaler = StandardScaler()
        self.is_fitted = False
        self.if_weight = 0.5
        self.svm_weight = 0.5
        self._training_data: Optional[np.ndarray] = None
        self._total_samples = 0

    def fit(self, X: np.ndarray, y=None):
        self._training_data = X.copy()
        self._total_samples = len(X)
        X_scaled = self.scaler.fit_transform(X)
        self.if_model.fit(X_scaled)
        self.svm_model = OneClassSVM(
            nu=self.svm_nu, kernel=self.svm_kernel, gamma=self.svm_gamma
        )
        self.svm_model.fit(X_scaled)
        self.is_fitted = True
        return self

    def incremental_fit(
        self,
        X_new: np.ndarray,
        X_old: Optional[np.ndarray] = None,
        max_historical_samples: int = 10000,
    ):
        if X_old is None and self._training_data is not None:
            X_old = self._training_data

        if X_old is not None and len(X_old) > 0:
            keep_ratio = min(1.0, max_historical_samples / len(X_old))
            if keep_ratio < 1.0:
                indices = np.random.choice(
                    len(X_old), int(len(X_old) * keep_ratio), replace=False
                )
                X_old_sampled = X_old[indices]
            else:
                X_old_sampled = X_old

            X_combined = np.vstack([X_old_sampled, X_new])
        else:
            X_combined = X_new

        self._training_data = X_combined
        self._total_samples = len(X_combined)

        X_scaled = self.scaler.fit_transform(X_combined)

        self.if_model = IsolationForest(
            contamination=self.if_contamination,
            n_estimators=self.if_n_estimators,
            max_samples=self.if_max_samples,
            random_state=42,
            n_jobs=-1,
            warm_start=True,
        )
        self.if_model.fit(X_scaled)

        self.svm_model = OneClassSVM(
            nu=self.svm_nu, kernel=self.svm_kernel, gamma=self.svm_gamma
        )
        self.svm_model.fit(X_scaled)

        self.is_fitted = True
        return self

    def get_training_stats(self) -> Dict:
        return {
            "is_fitted": self.is_fitted,
            "total_training_samples": self._total_samples,
            "feature_count": len(FEATURE_NAMES),
            "if_weight": self.if_weight,
            "svm_weight": self.svm_weight,
        }

    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("Model not fitted. Call fit() first.")
        X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
        X_scaled = self.scaler.transform(X)
        X_scaled = np.nan_to_num(X_scaled, nan=0.0, posinf=0.0, neginf=0.0)
        if_scores = self.if_model.decision_function(X_scaled)
        svm_scores = self.svm_model.decision_function(X_scaled)
        combined = self.if_weight * if_scores + self.svm_weight * svm_scores
        combined = np.nan_to_num(combined, nan=0.0, posinf=0.0, neginf=0.0)
        return combined

    def predict_anomaly(self, X: np.ndarray) -> np.ndarray:
        scores = self.predict(X)
        return (scores < 0).astype(int)

    def predict_proba_fault(self, X: np.ndarray) -> Dict[str, List[float]]:
        scores = self.predict(X)
        anomaly_score = 1.0 / (1.0 + np.exp(scores))
        results = {}
        for fault in FAULT_TYPES:
            if fault == "normal":
                results[fault] = (1.0 - anomaly_score).tolist()
            else:
                results[fault] = (anomaly_score / (len(FAULT_TYPES) - 1)).tolist()
        return results

    def get_feature_importance(self) -> Dict[str, float]:
        if hasattr(self.if_model, "feature_importances_"):
            importances = self.if_model.feature_importances_
        else:
            importances = np.ones(len(FEATURE_NAMES)) / len(FEATURE_NAMES)
        return dict(zip(FEATURE_NAMES, importances.tolist()))

    def save(self, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump(
            {
                "if_model": self.if_model,
                "svm_model": self.svm_model,
                "scaler": self.scaler,
                "is_fitted": self.is_fitted,
                "if_weight": self.if_weight,
                "svm_weight": self.svm_weight,
            },
            path,
        )

    @classmethod
    def load(cls, path: str) -> "EnsembleAnomalyDetector":
        data = joblib.load(path)
        detector = cls()
        detector.if_model = data["if_model"]
        detector.svm_model = data["svm_model"]
        detector.scaler = data["scaler"]
        detector.is_fitted = data["is_fitted"]
        detector.if_weight = data.get("if_weight", 0.5)
        detector.svm_weight = data.get("svm_weight", 0.5)
        return detector


class FaultClassifier:
    FAULT_SIGNATURES = {
        "bearing_inner": {
            "sample_entropy": (0.8, 2.0),
            "kurtosis": (3.5, 15.0),
            "crest_factor": (4.0, 12.0),
            "rms": (0.5, 5.0),
        },
        "bearing_outer": {
            "sample_entropy": (0.7, 1.8),
            "kurtosis": (3.0, 12.0),
            "crest_factor": (3.5, 10.0),
            "rms": (0.4, 4.0),
        },
        "bearing_ball": {
            "sample_entropy": (0.6, 1.5),
            "kurtosis": (2.5, 10.0),
            "crest_factor": (3.0, 8.0),
            "rms": (0.3, 3.0),
        },
        "gear_wear": {
            "sample_entropy": (0.5, 1.3),
            "kurtosis": (2.0, 6.0),
            "crest_factor": (2.5, 6.0),
            "rms": (1.0, 8.0),
        },
        "misalignment": {
            "sample_entropy": (0.3, 1.0),
            "kurtosis": (1.5, 4.0),
            "crest_factor": (2.0, 5.0),
            "rms": (2.0, 10.0),
        },
    }

    def classify(self, features: Dict[str, float]) -> Dict[str, float]:
        import math
        features = {k: (v if isinstance(v, (int, float)) and math.isfinite(v) else 0.0) for k, v in features.items()}
        scores = {}
        for fault_type, signature in self.FAULT_SIGNATURES.items():
            match_score = 0.0
            total_weight = 0.0
            for feat_name, (low, high) in signature.items():
                val = features.get(feat_name, 0.0)
                mid = (low + high) / 2.0
                half_range = (high - low) / 2.0
                if half_range > 0:
                    dist = abs(val - mid) / half_range
                    match = max(0.0, 1.0 - dist)
                else:
                    match = 1.0 if abs(val - mid) < 0.01 else 0.0
                match_score += match
                total_weight += 1.0
            scores[fault_type] = match_score / total_weight if total_weight > 0 else 0.0

        normal_score = 1.0 - max(scores.values())
        scores["normal"] = max(0.0, normal_score)

        total = sum(scores.values())
        if total > 0:
            for k in scores:
                scores[k] /= total
        return scores

    def compare_with_baseline(
        self,
        current_features: Dict[str, float],
        baseline_features: Dict[str, float],
    ) -> Dict[str, float]:
        deltas = {}
        for key in baseline_features:
            if key in current_features:
                b = baseline_features[key]
                if abs(b) > 1e-9:
                    deltas[key] = (current_features[key] - b) / abs(b)
                else:
                    deltas[key] = 0.0

        fault_probs = self.classify(current_features)

        deviation_score = np.sqrt(np.mean([d ** 2 for d in deltas.values()])) if deltas else 0.0

        return {
            "fault_probabilities": fault_probs,
            "feature_deltas": deltas,
            "overall_deviation": float(deviation_score),
        }
