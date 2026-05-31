import numpy as np
import time
import logging
import uuid
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
import warnings

warnings.filterwarnings("ignore")

from ..models import (
    HistoryTrajectory, TrendPoint, TrendPredictionResult,
    SinglePrediction, DepressionSeverity
)
from ..database import MongoDB

logger = logging.getLogger(__name__)


class TrendPredictor:
    def __init__(self, db: Optional[MongoDB] = None):
        self.db = db or MongoDB()
        self._lstm_model = None
        self._scaler = None
        self._sequence_length = 5
        self._initialized = False
        self._init_model()

    def _init_model(self):
        try:
            self._lstm_model = self._build_simple_lstm()
            self._initialized = True
            logger.info("Trend predictor initialized with simple LSTM model")
        except Exception as e:
            logger.warning(f"Failed to initialize LSTM, using fallback: {e}")
            self._initialized = False

    def _build_simple_lstm(self):
        try:
            from tensorflow.keras.models import Sequential
            from tensorflow.keras.layers import LSTM, Dense, Dropout
            from tensorflow.keras.optimizers import Adam

            model = Sequential([
                LSTM(64, return_sequences=True, input_shape=(self._sequence_length, 4)),
                Dropout(0.2),
                LSTM(32, return_sequences=False),
                Dropout(0.2),
                Dense(16, activation='relu'),
                Dense(1, activation='sigmoid')
            ])

            model.compile(
                optimizer=Adam(learning_rate=0.001),
                loss='mse',
                metrics=['mae']
            )

            return model
        except ImportError:
            logger.warning("TensorFlow not available, using statistical prediction")
            return None
        except Exception as e:
            logger.warning(f"Failed to build LSTM: {e}")
            return None

    def get_user_history(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        try:
            records = self.db.get_user_records(user_id, limit=limit)
            sorted_records = sorted(records, key=lambda x: x.get("created_at", datetime.min))
            return sorted_records
        except Exception as e:
            logger.error(f"Failed to get user history: {e}")
            return []

    def build_history_trajectory(self, user_id: str) -> HistoryTrajectory:
        records = self.get_user_history(user_id)
        
        if not records:
            return HistoryTrajectory(
                user_id=user_id,
                record_count=0,
                score_trend=[]
            )

        trend_points = []
        scores = []

        for record in records:
            fusion_result = record.get("fusion_result", {})
            if not fusion_result:
                continue

            score = fusion_result.get("depression_score", 50.0)
            scores.append(score)

            modality_contribs = fusion_result.get("modality_contributions", [])
            visual_contrib = 0.0
            audio_contrib = 0.0
            text_contrib = 0.0

            for contrib in modality_contribs:
                mod_type = contrib.get("modality", "")
                weight = contrib.get("normalized_weight", 0.0)
                if mod_type == "visual":
                    visual_contrib = weight
                elif mod_type == "audio":
                    audio_contrib = weight
                elif mod_type == "text":
                    text_contrib = weight

            trend_points.append(TrendPoint(
                timestamp=record.get("created_at", datetime.utcnow()),
                depression_score=score,
                severity=fusion_result.get("severity", DepressionSeverity.MILD),
                visual_contribution=visual_contrib,
                audio_contribution=audio_contrib,
                text_contribution=text_contrib
            ))

        if not scores:
            return HistoryTrajectory(
                user_id=user_id,
                record_count=len(records),
                score_trend=[]
            )

        scores_arr = np.array(scores)
        avg_score = float(np.mean(scores_arr))
        min_score = float(np.min(scores_arr))
        max_score = float(np.max(scores_arr))
        score_std = float(np.std(scores_arr)) if len(scores_arr) > 1 else 0.0

        trend_slope = self._calculate_trend_slope(scores_arr)
        trend_direction = self._determine_trend_direction(trend_slope)

        return HistoryTrajectory(
            user_id=user_id,
            record_count=len(trend_points),
            first_assessment_date=trend_points[0].timestamp if trend_points else None,
            last_assessment_date=trend_points[-1].timestamp if trend_points else None,
            score_trend=trend_points,
            avg_score=avg_score,
            min_score=min_score,
            max_score=max_score,
            score_std=score_std,
            trend_direction=trend_direction,
            trend_slope=trend_slope
        )

    def _calculate_trend_slope(self, scores: np.ndarray) -> float:
        if len(scores) < 2:
            return 0.0

        x = np.arange(len(scores))
        slope, _ = np.polyfit(x, scores, 1)
        return float(slope)

    def _determine_trend_direction(self, slope: float) -> str:
        threshold = 2.0
        if slope > threshold:
            return "rising"
        elif slope < -threshold:
            return "falling"
        else:
            return "stable"

    def _prepare_sequences(self, trajectory: HistoryTrajectory) -> Tuple[np.ndarray, List[datetime]]:
        trend_points = trajectory.score_trend
        if len(trend_points) < 2:
            return np.array([]), []

        features = []
        timestamps = []

        for i, point in enumerate(trend_points):
            feat = [
                point.depression_score / 100.0,
                point.visual_contribution,
                point.audio_contribution,
                point.text_contribution
            ]
            features.append(feat)
            timestamps.append(point.timestamp)

        return np.array(features), timestamps

    def _predict_statistical(
        self,
        trajectory: HistoryTrajectory,
        prediction_horizon: int = 3
    ) -> Tuple[List[float], List[float], List[float]]:
        scores = [p.depression_score for p in trajectory.score_trend]
        
        if len(scores) == 0:
            scores = [50.0]
        if len(scores) == 1:
            scores = scores * 2

        n = len(scores)
        recent_scores = scores[-min(5, n):]
        
        weights = np.linspace(0.5, 2.0, len(recent_scores))
        weights = weights / np.sum(weights)
        weighted_avg = np.average(recent_scores, weights=weights)
        
        trend_slope = trajectory.trend_slope
        base_uncertainty = trajectory.score_std if trajectory.score_std > 0 else 5.0
        
        predictions = []
        lower_bounds = []
        upper_bounds = []

        current_score = scores[-1]
        
        for i in range(prediction_horizon):
            momentum = min(0.8, (i + 1) / prediction_horizon)
            predicted = weighted_avg + trend_slope * (i + 1) * momentum
            
            predicted = max(0.0, min(100.0, predicted))
            predictions.append(predicted)
            
            uncertainty = base_uncertainty * (1 + 0.3 * i)
            lower = max(0.0, predicted - uncertainty)
            upper = min(100.0, predicted + uncertainty)
            lower_bounds.append(lower)
            upper_bounds.append(upper)

        return predictions, lower_bounds, upper_bounds

    def _predict_with_lstm(
        self,
        trajectory: HistoryTrajectory,
        prediction_horizon: int = 3
    ) -> Tuple[List[float], List[float], List[float]]:
        if self._lstm_model is None:
            return self._predict_statistical(trajectory, prediction_horizon)

        features, timestamps = self._prepare_sequences(trajectory)
        
        if len(features) < 2:
            return self._predict_statistical(trajectory, prediction_horizon)

        try:
            if len(features) >= self._sequence_length:
                seq = features[-self._sequence_length:]
            else:
                pad_len = self._sequence_length - len(features)
                pad = np.zeros((pad_len, 4))
                seq = np.vstack([pad, features])

            predictions = []
            current_seq = seq.copy()

            for _ in range(prediction_horizon):
                pred = self._lstm_model.predict(
                    current_seq.reshape(1, self._sequence_length, 4),
                    verbose=0
                )[0][0]
                
                predictions.append(pred * 100.0)
                
                new_feat = np.array([[pred, 0.33, 0.33, 0.34]])
                current_seq = np.vstack([current_seq[1:], new_feat])

            base_scores = [p.depression_score for p in trajectory.score_trend]
            uncertainty = np.std(base_scores) if len(base_scores) > 1 else 5.0

            lower_bounds = [max(0.0, p - uncertainty) for p in predictions]
            upper_bounds = [min(100.0, p + uncertainty) for p in predictions]

            return predictions, lower_bounds, upper_bounds

        except Exception as e:
            logger.warning(f"LSTM prediction failed, falling back to statistical: {e}")
            return self._predict_statistical(trajectory, prediction_horizon)

    def _get_severity_from_score(self, score: float) -> DepressionSeverity:
        if score <= 25:
            return DepressionSeverity.NONE
        elif score <= 50:
            return DepressionSeverity.MILD
        elif score <= 75:
            return DepressionSeverity.MODERATE
        else:
            return DepressionSeverity.SEVERE

    def predict_trend(
        self,
        user_id: str,
        prediction_horizon: int = 3
    ) -> TrendPredictionResult:
        start_time = time.time()
        logger.info(f"Predicting trend for user {user_id}")

        trajectory = self.build_history_trajectory(user_id)

        if trajectory.record_count < 1:
            predictions = []
            overall_trend = "insufficient_data"
            risk_level = "unknown"
            model_confidence = 0.0
        else:
            pred_scores, lower_bounds, upper_bounds = self._predict_statistical(
                trajectory, prediction_horizon
            )

            last_date = trajectory.last_assessment_date or datetime.utcnow()
            
            predictions = []
            for i in range(prediction_horizon):
                pred_date = last_date + timedelta(days=i + 1)
                predictions.append(SinglePrediction(
                    predicted_date=pred_date,
                    predicted_score=round(pred_scores[i], 2),
                    lower_bound=round(lower_bounds[i], 2),
                    upper_bound=round(upper_bounds[i], 2),
                    predicted_severity=self._get_severity_from_score(pred_scores[i])
                ))

            overall_trend = trajectory.trend_direction
            final_pred_score = pred_scores[-1]
            
            if final_pred_score >= 85:
                risk_level = "critical"
            elif final_pred_score >= 70:
                risk_level = "high"
            elif final_pred_score >= 50:
                risk_level = "moderate"
            elif final_pred_score >= 30:
                risk_level = "low"
            else:
                risk_level = "minimal"

            model_confidence = max(0.3, min(0.9, 0.3 + 0.1 * trajectory.record_count))

        key_indicators = {
            "current_score": trajectory.score_trend[-1].depression_score if trajectory.score_trend else 50.0,
            "trend_direction": trajectory.trend_direction,
            "trend_slope": trajectory.trend_slope,
            "avg_score": trajectory.avg_score,
            "score_volatility": trajectory.score_std,
            "assessment_count": trajectory.record_count
        }

        result = TrendPredictionResult(
            user_id=user_id,
            prediction_timestamp=datetime.utcnow(),
            history_points=trajectory.record_count,
            prediction_horizon=prediction_horizon,
            predictions=predictions,
            overall_trend=overall_trend,
            risk_level=risk_level,
            key_indicators=key_indicators,
            model_confidence=round(model_confidence, 2)
        )

        logger.info(
            f"Trend prediction completed in {(time.time() - start_time)*1000:.2f}ms. "
            f"Risk: {risk_level}, Trend: {overall_trend}"
        )

        return result

    def detect_sustained_rise(self, user_id: str, threshold: float = 85.0, 
                               consecutive_count: int = 2) -> Dict[str, Any]:
        trajectory = self.build_history_trajectory(user_id)
        
        if trajectory.record_count < consecutive_count + 1:
            return {
                "detected": False,
                "message": "Insufficient data points",
                "current_score": None,
                "rise_count": 0,
                "history": []
            }

        recent_scores = [p.depression_score for p in trajectory.score_trend[-(consecutive_count + 1):]]
        
        sustained_rise = True
        for i in range(1, len(recent_scores)):
            if recent_scores[i] <= recent_scores[i - 1]:
                sustained_rise = False
                break

        current_score = recent_scores[-1]
        above_threshold = current_score >= threshold

        detected = sustained_rise and above_threshold

        return {
            "detected": detected,
            "message": "Crisis level detected with sustained rise" if detected else "No crisis detected",
            "current_score": current_score,
            "above_threshold": above_threshold,
            "sustained_rise": sustained_rise,
            "rise_count": consecutive_count if sustained_rise else 0,
            "history": recent_scores
        }
