import os
import json
import numpy as np
import logging
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
from collections import defaultdict

logger = logging.getLogger(__name__)


@dataclass
class CorrectionSample:
    subtitle_index: int
    original_start: float
    original_end: float
    corrected_start: float
    corrected_end: float
    vad_start: Optional[float]
    vad_end: Optional[float]
    metadata: Dict[str, Any]


@dataclass
class TrainedModel:
    version: str
    name: str
    model_type: str
    feature_weights: Dict[str, float]
    bias_terms: Dict[str, float]
    threshold_adjustments: Dict[str, float]
    training_sample_count: int
    validation_metrics: Dict[str, float]
    trained_at: str
    description: str = ""


class ModelTrainingService:
    def __init__(self):
        self.default_weights = {
            'energy': 0.3,
            'spectral_centroid': 0.25,
            'zero_crossing_rate': 0.2,
            'band_energy_ratio': 0.25
        }
        self.min_training_samples = int(os.getenv('MIN_TRAINING_SAMPLES', '50'))
        self.models_dir = os.getenv('MODELS_DIR', '/app/models')
        os.makedirs(self.models_dir, exist_ok=True)

    def load_corrections(self, corrections_data: List[Dict[str, Any]]) -> List[CorrectionSample]:
        samples = []
        for data in corrections_data:
            try:
                sample = CorrectionSample(
                    subtitle_index=data.get('subtitle_index', 0),
                    original_start=float(data.get('original_start', 0)),
                    original_end=float(data.get('original_end', 0)),
                    corrected_start=float(data.get('corrected_start', 0)),
                    corrected_end=float(data.get('corrected_end', 0)),
                    vad_start=float(data['vad_start']) if data.get('vad_start') is not None else None,
                    vad_end=float(data['vad_end']) if data.get('vad_end') is not None else None,
                    metadata=data.get('metadata', {})
                )
                samples.append(sample)
            except (KeyError, ValueError, TypeError) as e:
                logger.warning(f"Skipping invalid correction sample: {e}")
                continue
        return samples

    def analyze_correction_patterns(self, samples: List[CorrectionSample]) -> Dict[str, Any]:
        if not samples:
            return {}

        start_errors = []
        end_errors = []
        duration_errors = []
        vad_alignment_errors = []

        for s in samples:
            start_error = s.corrected_start - s.original_start
            end_error = s.corrected_end - s.original_end
            duration_error = (s.corrected_end - s.corrected_start) - (s.original_end - s.original_start)

            start_errors.append(start_error)
            end_errors.append(end_error)
            duration_errors.append(duration_error)

            if s.vad_start is not None:
                vad_alignment_errors.append(s.corrected_start - s.vad_start)

        analysis = {
            'sample_count': len(samples),
            'start_error': {
                'mean': float(np.mean(start_errors)),
                'median': float(np.median(start_errors)),
                'std': float(np.std(start_errors)),
                'min': float(np.min(start_errors)),
                'max': float(np.max(start_errors))
            },
            'end_error': {
                'mean': float(np.mean(end_errors)),
                'median': float(np.median(end_errors)),
                'std': float(np.std(end_errors))
            },
            'duration_error': {
                'mean': float(np.mean(duration_errors)),
                'std': float(np.std(duration_errors))
            },
            'direction_bias': 'positive' if np.mean(start_errors) > 0 else 'negative',
            'abs_mean_start_error': float(np.mean(np.abs(start_errors)))
        }

        if vad_alignment_errors:
            analysis['vad_alignment_error'] = {
                'mean': float(np.mean(vad_alignment_errors)),
                'median': float(np.median(vad_alignment_errors)),
                'std': float(np.std(vad_alignment_errors))
            }

        return analysis

    def extract_features(self, samples: List[CorrectionSample]) -> Tuple[np.ndarray, np.ndarray]:
        features = []
        targets = []

        for s in samples:
            duration = s.original_end - s.original_start
            target_start = s.corrected_start - s.original_start

            feature_vec = [
                duration,
                s.original_start,
                s.subtitle_index / 1000.0,
            ]

            if s.vad_start is not None and s.vad_end is not None:
                vad_duration = s.vad_end - s.vad_start
                vad_overlap = max(0, min(s.original_end, s.vad_end) - max(s.original_start, s.vad_start))
                vad_overlap_ratio = vad_overlap / max(duration, 0.001)

                feature_vec.extend([
                    s.vad_start,
                    s.original_start - s.vad_start,
                    vad_duration,
                    vad_overlap_ratio
                ])
            else:
                feature_vec.extend([0.0, 0.0, 0.0, 0.0])

            features.append(feature_vec)
            targets.append(target_start)

        return np.array(features), np.array(targets)

    def train_linear_model(self, X: np.ndarray, y: np.ndarray) -> Dict[str, float]:
        try:
            X_bias = np.column_stack([X, np.ones(len(X))])
            weights = np.linalg.lstsq(X_bias, y, rcond=None)[0]

            return {
                'feature_weights': weights[:-1].tolist(),
                'bias': float(weights[-1])
            }
        except Exception as e:
            logger.error(f"Linear model training failed: {e}")
            return {
                'feature_weights': np.zeros(X.shape[1]).tolist(),
                'bias': 0.0
            }

    def calculate_feature_importance(self, samples: List[CorrectionSample]) -> Dict[str, float]:
        if len(samples) < 2:
            return self.default_weights.copy()

        corrections = np.array([abs(s.corrected_start - s.original_start) for s in samples])
        durations = np.array([s.original_end - s.original_start for s in samples])
        positions = np.array([s.original_start for s in samples])

        corr_duration = abs(np.corrcoef(corrections, durations)[0, 1]) if len(samples) > 2 else 0.3
        corr_position = abs(np.corrcoef(corrections, positions)[0, 1]) if len(samples) > 2 else 0.3

        vad_samples = [s for s in samples if s.vad_start is not None]
        if len(vad_samples) >= 2:
            vad_diffs = np.array([abs(s.original_start - s.vad_start) for s in vad_samples])
            vad_corrections = np.array([abs(s.corrected_start - s.original_start) for s in vad_samples])
            corr_vad = abs(np.corrcoef(vad_diffs, vad_corrections)[0, 1])
        else:
            corr_vad = 0.25

        total = corr_duration + corr_position + corr_vad + 0.2
        if total > 0:
            weights = {
                'energy': max(0.2, corr_duration / total),
                'spectral_centroid': max(0.15, corr_position / total),
                'zero_crossing_rate': 0.2,
                'band_energy_ratio': max(0.15, corr_vad / total)
            }
            s = sum(weights.values())
            weights = {k: v / s for k, v in weights.items()}
        else:
            weights = self.default_weights.copy()

        return weights

    def validate_model(
        self,
        model: Dict[str, Any],
        samples: List[CorrectionSample],
        test_ratio: float = 0.2
    ) -> Dict[str, float]:
        if len(samples) < 5:
            return {
                'test_accuracy': 0.0,
                'validation_accuracy': 0.0,
                'avg_offset_error': 0.5,
                'error_within_100ms': 0.0,
                'error_within_500ms': 0.0
            }

        np.random.seed(42)
        indices = np.random.permutation(len(samples))
        split = int(len(samples) * (1 - test_ratio))
        train_indices = indices[:split]
        test_indices = indices[split:]

        train_samples = [samples[i] for i in train_indices]
        test_samples = [samples[i] for i in test_indices]

        train_errors = []
        for s in train_samples:
            pred_offset = self.predict_offset(model, s)
            actual_offset = s.corrected_start - s.original_start
            train_errors.append(abs(pred_offset - actual_offset))

        test_errors = []
        for s in test_samples:
            pred_offset = self.predict_offset(model, s)
            actual_offset = s.corrected_start - s.original_start
            test_errors.append(abs(pred_offset - actual_offset))

        train_errors = np.array(train_errors)
        test_errors = np.array(test_errors)

        return {
            'train_avg_error': float(np.mean(train_errors)),
            'test_avg_error': float(np.mean(test_errors)),
            'test_median_error': float(np.median(test_errors)),
            'test_std_error': float(np.std(test_errors)),
            'error_within_100ms': float(np.mean(test_errors < 0.1)),
            'error_within_500ms': float(np.mean(test_errors < 0.5)),
            'test_accuracy': float(np.mean(test_errors < 0.3)),
            'validation_accuracy': float(np.mean(train_errors < 0.3))
        }

    def predict_offset(self, model: Dict[str, Any], sample: CorrectionSample) -> float:
        weights = model.get('feature_weights', [])
        bias = model.get('bias', 0.0)

        if not weights:
            return 0.0

        duration = sample.original_end - sample.original_start
        features = [
            duration,
            sample.original_start,
            sample.subtitle_index / 1000.0,
        ]

        if sample.vad_start is not None and sample.vad_end is not None:
            vad_duration = sample.vad_end - sample.vad_start
            vad_overlap = max(0, min(sample.original_end, sample.vad_end) - max(sample.original_start, sample.vad_start))
            vad_overlap_ratio = vad_overlap / max(duration, 0.001)

            features.extend([
                sample.vad_start,
                sample.original_start - sample.vad_start,
                vad_duration,
                vad_overlap_ratio
            ])
        else:
            features.extend([0.0, 0.0, 0.0, 0.0])

        while len(features) < len(weights):
            features.append(0.0)

        features = features[:len(weights)]

        prediction = float(np.dot(weights, features) + bias)
        prediction = max(-10.0, min(10.0, prediction))

        return prediction

    def train_model(
        self,
        corrections_data: List[Dict[str, Any]],
        version: str,
        name: str
    ) -> TrainedModel:
        logger.info(f"Starting model training with {len(corrections_data)} samples")

        samples = self.load_corrections(corrections_data)
        if len(samples) < self.min_training_samples:
            raise ValueError(
                f"Insufficient training samples: {len(samples)}. "
                f"Minimum required: {self.min_training_samples}"
            )

        pattern_analysis = self.analyze_correction_patterns(samples)
        feature_importance = self.calculate_feature_importance(samples)

        X, y = self.extract_features(samples)
        linear_model = self.train_linear_model(X, y)

        threshold_adjustments = {
            'vad_threshold': max(0.3, 0.5 - pattern_analysis.get('abs_mean_start_error', 0) * 0.5),
            'min_segment_duration': max(0.1, 0.2 - pattern_analysis.get('duration_error', {}).get('mean', 0) * 0.5),
            'alignment_confidence_threshold': max(0.2, 0.5 - pattern_analysis.get('start_error', {}).get('std', 0) * 0.3)
        }

        model_data = {
            'version': version,
            'name': name,
            'model_type': 'linear_regression',
            'feature_weights': feature_importance,
            'linear_weights': linear_model['feature_weights'],
            'linear_bias': linear_model['bias'],
            'bias_terms': {
                'start_bias': pattern_analysis.get('start_error', {}).get('mean', 0),
                'end_bias': pattern_analysis.get('end_error', {}).get('mean', 0),
                'vad_alignment_bias': pattern_analysis.get('vad_alignment_error', {}).get('mean', 0)
            },
            'threshold_adjustments': threshold_adjustments,
            'pattern_analysis': pattern_analysis,
            'training_sample_count': len(samples)
        }

        validation_metrics = self.validate_model(model_data, samples)
        model_data['validation_metrics'] = validation_metrics

        model = TrainedModel(
            version=version,
            name=name,
            model_type='linear_regression',
            feature_weights=feature_importance,
            bias_terms=model_data['bias_terms'],
            threshold_adjustments=threshold_adjustments,
            training_sample_count=len(samples),
            validation_metrics=validation_metrics,
            trained_at=json.dumps(np.datetime64('now').tolist()).strip('"'),
            description=f"Trained on {len(samples)} samples. "
                       f"Test accuracy: {validation_metrics.get('test_accuracy', 0):.1%}, "
                       f"Avg error: {validation_metrics.get('test_avg_error', 0)*1000:.0f}ms"
        )

        self._save_model(model, model_data)

        logger.info(
            f"Model training complete. Version: {version}, "
            f"Test accuracy: {validation_metrics.get('test_accuracy', 0):.1%}, "
            f"Avg error: {validation_metrics.get('test_avg_error', 0)*1000:.0f}ms"
        )

        return model

    def _save_model(self, model: TrainedModel, model_data: Dict[str, Any]) -> str:
        model_path = os.path.join(self.models_dir, f"model_{model.version}.json")
        with open(model_path, 'w') as f:
            json.dump(model_data, f, indent=2, default=str)
        logger.info(f"Model saved to {model_path}")
        return model_path

    def load_model(self, version: str) -> Optional[Dict[str, Any]]:
        model_path = os.path.join(self.models_dir, f"model_{version}.json")
        if not os.path.exists(model_path):
            logger.warning(f"Model {version} not found at {model_path}")
            return None
        try:
            with open(model_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load model {version}: {e}")
            return None

    def list_models(self) -> List[Dict[str, Any]]:
        models = []
        for filename in os.listdir(self.models_dir):
            if filename.startswith('model_') and filename.endswith('.json'):
                try:
                    with open(os.path.join(self.models_dir, filename), 'r') as f:
                        data = json.load(f)
                    models.append({
                        'version': data.get('version', 'unknown'),
                        'name': data.get('name', 'Unknown'),
                        'sample_count': data.get('training_sample_count', 0),
                        'accuracy': data.get('validation_metrics', {}).get('test_accuracy', 0),
                        'avg_error': data.get('validation_metrics', {}).get('test_avg_error', 0)
                    })
                except Exception as e:
                    logger.warning(f"Skipping invalid model file {filename}: {e}")
        return models

    def apply_model_to_alignment(
        self,
        model_version: str,
        vad_segments: List[Dict[str, float]],
        subtitle_segments: List[Dict[str, Any]],
        base_offset: float
    ) -> float:
        model_data = self.load_model(model_version)
        if not model_data:
            logger.warning(f"Model {model_version} not found, using base offset")
            return base_offset

        bias_terms = model_data.get('bias_terms', {})
        adjustments = []

        for sub in subtitle_segments[:5]:
            sub_start = sub.get('start', 0)
            sub_end = sub.get('end', sub_start + 1)

            matched_vad = None
            for vad in vad_segments:
                vad_start = vad.get('start', 0)
                vad_end = vad.get('end', 0)
                overlap = max(0, min(sub_end, vad_end) - max(sub_start, vad_start))
                if overlap > 0:
                    matched_vad = vad
                    break

            sample = CorrectionSample(
                subtitle_index=sub.get('index', 0),
                original_start=sub_start,
                original_end=sub_end,
                corrected_start=sub_start,
                corrected_end=sub_end,
                vad_start=matched_vad.get('start') if matched_vad else None,
                vad_end=matched_vad.get('end') if matched_vad else None,
                metadata={}
            )

            pred_offset = self.predict_offset(model_data, sample)
            adjustments.append(pred_offset)

        if adjustments:
            model_adjustment = float(np.median(adjustments))
            vad_bias = bias_terms.get('vad_alignment_bias', 0)
            final_offset = base_offset + model_adjustment * 0.3 + vad_bias * 0.5
            logger.info(
                f"Model {model_version} applied: base={base_offset:.3f}s, "
                f"adjustment={model_adjustment:.3f}s, vad_bias={vad_bias:.3f}s, "
                f"final={final_offset:.3f}s"
            )
            return final_offset

        return base_offset
