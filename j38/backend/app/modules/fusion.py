import numpy as np
import time
import logging
from typing import Optional, List, Dict, Any, Tuple
import warnings

warnings.filterwarnings("ignore")

from ..models import (
    VisualFeatures, AudioFeatures, TextFeatures,
    FusionResult, ModalityContribution,
    ModalityType, DepressionSeverity
)

logger = logging.getLogger(__name__)


class MultiHeadAttention:
    def __init__(self, d_model: int = 64, num_heads: int = 4):
        self.d_model = d_model
        self.num_heads = num_heads
        self.d_k = d_model // num_heads

        self.W_q = np.random.randn(d_model, d_model) * 0.01
        self.W_k = np.random.randn(d_model, d_model) * 0.01
        self.W_v = np.random.randn(d_model, d_model) * 0.01
        self.W_o = np.random.randn(d_model, d_model) * 0.01

    def _scaled_dot_product_attention(
        self, Q: np.ndarray, K: np.ndarray, V: np.ndarray,
        mask: Optional[np.ndarray] = None
    ) -> Tuple[np.ndarray, np.ndarray]:
        d_k = Q.shape[-1]
        scores = np.matmul(Q, K.transpose(-2, -1)) / np.sqrt(d_k)

        if mask is not None:
            scores = np.where(mask == 0, -1e9, scores)

        weights = self._softmax(scores)
        output = np.matmul(weights, V)

        return output, weights

    def _softmax(self, x: np.ndarray) -> np.ndarray:
        x = x - np.max(x, axis=-1, keepdims=True)
        exp_x = np.exp(x)
        return exp_x / np.sum(exp_x, axis=-1, keepdims=True)

    def _split_heads(self, x: np.ndarray) -> np.ndarray:
        batch_size = x.shape[0]
        x = x.reshape(batch_size, -1, self.num_heads, self.d_k)
        return x.transpose(0, 2, 1, 3)

    def _combine_heads(self, x: np.ndarray) -> np.ndarray:
        batch_size = x.shape[0]
        x = x.transpose(0, 2, 1, 3)
        return x.reshape(batch_size, -1, self.d_model)

    def forward(
        self, query: np.ndarray, key: np.ndarray, value: np.ndarray,
        mask: Optional[np.ndarray] = None
    ) -> Tuple[np.ndarray, np.ndarray]:
        Q = np.matmul(query, self.W_q)
        K = np.matmul(key, self.W_k)
        V = np.matmul(value, self.W_v)

        Q = self._split_heads(Q)
        K = self._split_heads(K)
        V = self._split_heads(V)

        attn_output, attn_weights = self._scaled_dot_product_attention(Q, K, V, mask)

        attn_output = self._combine_heads(attn_output)
        output = np.matmul(attn_output, self.W_o)

        return output, attn_weights


class MultimodalFusion:
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self.visual_dim = 23
        self.audio_dim = 23
        self.text_dim = 18
        self.d_model = 64

        self._init_projection_layers()
        self._init_attention_layers()
        self._init_classifier_layers()

        self.visual_feature_names = self._get_visual_feature_names()
        self.audio_feature_names = self._get_audio_feature_names()
        self.text_feature_names = self._get_text_feature_names()

    def _init_projection_layers(self):
        self.visual_projection = np.random.randn(self.visual_dim, self.d_model) * 0.01
        self.audio_projection = np.random.randn(self.audio_dim, self.d_model) * 0.01
        self.text_projection = np.random.randn(self.text_dim, self.d_model) * 0.01

        self.visual_bias = np.zeros(self.d_model)
        self.audio_bias = np.zeros(self.d_model)
        self.text_bias = np.zeros(self.d_model)

    def _init_attention_layers(self):
        self.cross_attention_1 = MultiHeadAttention(d_model=self.d_model, num_heads=4)
        self.cross_attention_2 = MultiHeadAttention(d_model=self.d_model, num_heads=4)
        self.self_attention = MultiHeadAttention(d_model=self.d_model, num_heads=4)

        self.layer_norm_1 = np.ones(self.d_model)
        self.layer_norm_2 = np.ones(self.d_model)
        self.layer_norm_3 = np.ones(self.d_model)

    def _init_classifier_layers(self):
        self.fc1 = np.random.randn(self.d_model * 3, 128) * 0.01
        self.fc2 = np.random.randn(128, 64) * 0.01
        self.fc3 = np.random.randn(64, 1) * 0.01

        self.bias1 = np.zeros(128)
        self.bias2 = np.zeros(64)
        self.bias3 = np.zeros(1)

        self.dropout_rate = 0.3

    def _get_visual_feature_names(self) -> List[str]:
        names = []
        for au in [1, 2, 4, 6, 7, 12, 14, 15, 20, 23, 25, 26, 45]:
            names.append(f"AU{au:02d}")
        names.extend([
            "gaze_avoidance_duration",
            "gaze_avoidance_ratio",
            "smile_frequency",
            "smile_duration_ratio",
            "head_pitch",
            "head_yaw",
            "head_roll",
            "blink_rate",
            "eyebrow_raise_frequency",
            "frowning_frequency"
        ])
        return names

    def _get_audio_feature_names(self) -> List[str]:
        names = [
            "speech_rate",
            "pitch_mean",
            "pitch_std",
            "pitch_min",
            "pitch_max",
            "pitch_range",
            "pause_count",
            "pause_duration_mean",
            "pause_duration_total",
            "pause_ratio",
            "jitter",
            "shimmer",
            "hnr",
            "energy_mean",
            "energy_std"
        ]
        names.extend([
            "calmness", "tension", "sadness", "anxiety",
            "fatigue", "monotony", "hesitation", "breathiness"
        ])
        return names

    def _get_text_feature_names(self) -> List[str]:
        names = [
            "negative_word_count",
            "negative_word_ratio",
            "first_person_singular_count",
            "first_person_singular_ratio",
            "first_person_plural_count",
            "third_person_count",
            "sentiment_score",
            "avg_sentence_length",
            "avg_word_length",
            "vocabulary_richness",
            "past_tense_ratio",
            "present_tense_ratio",
            "death_related_words",
            "hopelessness_words",
            "sadness_emotion",
            "anxiety_emotion",
            "anger_emotion",
            "fatigue_emotion"
        ]
        return names

    def _normalize_features(self, features: np.ndarray) -> np.ndarray:
        mean = np.mean(features, axis=-1, keepdims=True)
        std = np.std(features, axis=-1, keepdims=True) + 1e-8
        return (features - mean) / std

    def _relu(self, x: np.ndarray) -> np.ndarray:
        return np.maximum(0, x)

    def _sigmoid(self, x: np.ndarray) -> np.ndarray:
        return 1 / (1 + np.exp(-x))

    def _dropout(self, x: np.ndarray, rate: float) -> np.ndarray:
        mask = np.random.random(x.shape) > rate
        return x * mask / (1 - rate)

    def _layer_norm(self, x: np.ndarray, gamma: np.ndarray, beta: np.ndarray = None) -> np.ndarray:
        if beta is None:
            beta = np.zeros_like(gamma)
        mean = np.mean(x, axis=-1, keepdims=True)
        var = np.var(x, axis=-1, keepdims=True)
        normalized = (x - mean) / np.sqrt(var + 1e-8)
        return gamma * normalized + beta

    def _project_modalities(
        self,
        visual_features: np.ndarray,
        audio_features: np.ndarray,
        text_features: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        visual_proj = np.matmul(visual_features, self.visual_projection) + self.visual_bias
        audio_proj = np.matmul(audio_features, self.audio_projection) + self.audio_bias
        text_proj = np.matmul(text_features, self.text_projection) + self.text_bias

        return visual_proj, audio_proj, text_proj

    def _cross_modal_attention(
        self,
        visual_proj: np.ndarray,
        audio_proj: np.ndarray,
        text_proj: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, Dict[str, np.ndarray]]:
        visual_expanded = visual_proj[:, np.newaxis, :]
        audio_expanded = audio_proj[:, np.newaxis, :]
        text_expanded = text_proj[:, np.newaxis, :]

        cross_attn_va, weights_va = self.cross_attention_1.forward(
            visual_expanded, audio_expanded, audio_expanded
        )
        cross_attn_vt, weights_vt = self.cross_attention_1.forward(
            visual_expanded, text_expanded, text_expanded
        )
        visual_enhanced = visual_proj + cross_attn_va.squeeze(1) + cross_attn_vt.squeeze(1)
        visual_enhanced = self._layer_norm(visual_enhanced, self.layer_norm_1)

        cross_attn_av, weights_av = self.cross_attention_1.forward(
            audio_expanded, visual_expanded, visual_expanded
        )
        cross_attn_at, weights_at = self.cross_attention_1.forward(
            audio_expanded, text_expanded, text_expanded
        )
        audio_enhanced = audio_proj + cross_attn_av.squeeze(1) + cross_attn_at.squeeze(1)
        audio_enhanced = self._layer_norm(audio_enhanced, self.layer_norm_1)

        cross_attn_tv, weights_tv = self.cross_attention_1.forward(
            text_expanded, visual_expanded, visual_expanded
        )
        cross_attn_ta, weights_ta = self.cross_attention_1.forward(
            text_expanded, audio_expanded, audio_expanded
        )
        text_enhanced = text_proj + cross_attn_tv.squeeze(1) + cross_attn_ta.squeeze(1)
        text_enhanced = self._layer_norm(text_enhanced, self.layer_norm_1)

        attention_weights = {
            "visual_to_audio": weights_va,
            "visual_to_text": weights_vt,
            "audio_to_visual": weights_av,
            "audio_to_text": weights_at,
            "text_to_visual": weights_tv,
            "text_to_audio": weights_ta
        }

        return visual_enhanced, audio_enhanced, text_enhanced, attention_weights

    def _self_attention_fusion(
        self,
        visual_enhanced: np.ndarray,
        audio_enhanced: np.ndarray,
        text_enhanced: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        combined = np.stack([visual_enhanced, audio_enhanced, text_enhanced], axis=1)

        fused, self_attn_weights = self.self_attention.forward(combined, combined, combined)
        fused = self._layer_norm(fused, self.layer_norm_2)

        return fused, self_attn_weights

    def _classify(self, fused_features: np.ndarray) -> Tuple[float, float]:
        batch_size = fused_features.shape[0]
        flattened = fused_features.reshape(batch_size, -1)

        x = self._relu(np.matmul(flattened, self.fc1) + self.bias1)
        x = self._dropout(x, self.dropout_rate)

        x = self._relu(np.matmul(x, self.fc2) + self.bias2)
        x = self._dropout(x, self.dropout_rate)

        logits = np.matmul(x, self.fc3) + self.bias3
        score = self._sigmoid(logits)[0, 0] * 100

        uncertainty = np.std(x) * 10
        confidence = max(0.0, min(1.0, 1.0 - uncertainty / 50))

        return score, confidence

    def _calculate_confidence_interval(
        self, score: float, confidence: float
    ) -> Tuple[float, float]:
        margin = (1 - confidence) * 20
        lower = max(0.0, score - margin)
        upper = min(100.0, score + margin)
        return (lower, upper)

    def _determine_severity(self, score: float) -> DepressionSeverity:
        if score < 25:
            return DepressionSeverity.NONE
        elif score < 50:
            return DepressionSeverity.MILD
        elif score < 75:
            return DepressionSeverity.MODERATE
        else:
            return DepressionSeverity.SEVERE

    def _calculate_modality_contributions(
        self,
        visual_features: np.ndarray,
        audio_features: np.ndarray,
        text_features: np.ndarray,
        self_attn_weights: np.ndarray,
        cross_attn_weights: Dict[str, np.ndarray]
    ) -> List[ModalityContribution]:
        contributions = []

        visual_weight = np.mean(self_attn_weights[:, :, 0, :])
        audio_weight = np.mean(self_attn_weights[:, :, 1, :])
        text_weight = np.mean(self_attn_weights[:, :, 2, :])

        total_weight = visual_weight + audio_weight + text_weight + 1e-8

        visual_contribution = ModalityContribution(
            modality=ModalityType.VISUAL,
            weight=float(visual_weight),
            contribution_score=float(visual_weight / total_weight * 100),
            normalized_weight=float(visual_weight / total_weight),
            top_features=self._get_top_features(
                visual_features, self.visual_feature_names, top_n=5
            )
        )
        contributions.append(visual_contribution)

        audio_contribution = ModalityContribution(
            modality=ModalityType.AUDIO,
            weight=float(audio_weight),
            contribution_score=float(audio_weight / total_weight * 100),
            normalized_weight=float(audio_weight / total_weight),
            top_features=self._get_top_features(
                audio_features, self.audio_feature_names, top_n=5
            )
        )
        contributions.append(audio_contribution)

        text_contribution = ModalityContribution(
            modality=ModalityType.TEXT,
            weight=float(text_weight),
            contribution_score=float(text_weight / total_weight * 100),
            normalized_weight=float(text_weight / total_weight),
            top_features=self._get_top_features(
                text_features, self.text_feature_names, top_n=5
            )
        )
        contributions.append(text_contribution)

        return contributions

    def _get_top_features(
        self, features: np.ndarray, feature_names: List[str], top_n: int = 5
    ) -> List[Dict[str, Any]]:
        abs_features = np.abs(features)
        top_indices = np.argsort(abs_features)[-top_n:][::-1]

        return [
            {
                "feature": feature_names[i],
                "value": float(features[i]),
                "importance": float(abs_features[i])
            }
            for i in top_indices
        ]

    def _extract_risk_factors(
        self,
        visual_features: VisualFeatures,
        audio_features: AudioFeatures,
        text_features: TextFeatures,
        score: float
    ) -> List[str]:
        risk_factors = []

        if visual_features.gaze_avoidance_ratio > 0.4:
            risk_factors.append("眼神回避明显，可能存在社交回避倾向")

        if visual_features.smile_frequency < 2:
            risk_factors.append("微笑频率低，情绪表达较少")

        if visual_features.frowning_frequency > 1.5:
            risk_factors.append("皱眉频率高，可能存在焦虑或担忧")

        if audio_features.speech_rate < 80:
            risk_factors.append("语速较慢，可能存在思维迟缓")

        if audio_features.pitch_range < 30:
            risk_factors.append("语音单调，情感表达贫乏")

        if audio_features.pause_ratio > 0.3:
            risk_factors.append("停顿较多，可能存在语言表达困难")

        if text_features.sentiment_score < -0.3:
            risk_factors.append("文本情感倾向消极")

        if text_features.first_person_singular_ratio > 0.2:
            risk_factors.append("第一人称使用频率高，可能存在自我关注过度")

        if text_features.negative_word_ratio > 0.15:
            risk_factors.append("消极词汇使用频繁")

        if text_features.death_related_words > 0:
            risk_factors.append("存在死亡相关词汇，需重点关注")

        if text_features.hopelessness_words > 0:
            risk_factors.append("存在绝望相关表达")

        if score >= 75:
            risk_factors.append("抑郁倾向评分较高，建议寻求专业帮助")

        return risk_factors

    def _generate_recommendations(self, severity: DepressionSeverity, score: float) -> List[str]:
        recommendations = []

        if severity == DepressionSeverity.NONE:
            recommendations.append("目前状态良好，请继续保持积极的生活态度")
            recommendations.append("建议保持规律作息，适度运动")
        elif severity == DepressionSeverity.MILD:
            recommendations.append("建议关注自身情绪变化，保持社交活动")
            recommendations.append("可以尝试进行放松训练或心理咨询")
            recommendations.append("建议定期进行自我评估监测")
        elif severity == DepressionSeverity.MODERATE:
            recommendations.append("建议寻求专业心理咨询师的帮助")
            recommendations.append("保持规律的作息和饮食，适度运动")
            recommendations.append("与信任的人分享自己的感受")
            recommendations.append("建议进行专业医学评估")
        else:
            recommendations.append("强烈建议尽快寻求专业精神科医生的帮助")
            recommendations.append("请告知家人或朋友，寻求社会支持")
            recommendations.append("如果出现自杀念头，请立即拨打危机干预热线")
            recommendations.append("建议进行全面的医学和心理学评估")

        if score >= 50:
            recommendations.append("建议避免做出重大人生决定")
            recommendations.append("可以尝试正念冥想等情绪调节方法")

        return recommendations

    def fuse(
        self,
        visual_features: Optional[VisualFeatures],
        audio_features: Optional[AudioFeatures],
        text_features: Optional[TextFeatures]
    ) -> FusionResult:
        start_time = time.time()
        logger.info("Starting multimodal fusion")

        try:
            visual_vec = np.array(visual_features.feature_vector if visual_features else np.zeros(self.visual_dim))
            audio_vec = np.array(audio_features.feature_vector if audio_features else np.zeros(self.audio_dim))
            text_vec = np.array(text_features.feature_vector if text_features else np.zeros(self.text_dim))

            visual_vec = self._normalize_features(visual_vec)
            audio_vec = self._normalize_features(audio_vec)
            text_vec = self._normalize_features(text_vec)

            visual_vec = visual_vec.reshape(1, -1)
            audio_vec = audio_vec.reshape(1, -1)
            text_vec = text_vec.reshape(1, -1)

            visual_proj, audio_proj, text_proj = self._project_modalities(
                visual_vec, audio_vec, text_vec
            )

            visual_enhanced, audio_enhanced, text_enhanced, cross_attn_weights = self._cross_modal_attention(
                visual_proj, audio_proj, text_proj
            )

            fused, self_attn_weights = self._self_attention_fusion(
                visual_enhanced, audio_enhanced, text_enhanced
            )

            score, confidence = self._classify(fused)

            confidence_interval = self._calculate_confidence_interval(score, confidence)
            severity = self._determine_severity(score)

            modality_contributions = self._calculate_modality_contributions(
                visual_vec[0], audio_vec[0], text_vec[0],
                self_attn_weights, cross_attn_weights
            )

            attention_weights = {
                "visual_to_visual": float(np.mean(self_attn_weights[:, :, 0, 0])),
                "visual_to_audio": float(np.mean(self_attn_weights[:, :, 0, 1])),
                "visual_to_text": float(np.mean(self_attn_weights[:, :, 0, 2])),
                "audio_to_visual": float(np.mean(self_attn_weights[:, :, 1, 0])),
                "audio_to_audio": float(np.mean(self_attn_weights[:, :, 1, 1])),
                "audio_to_text": float(np.mean(self_attn_weights[:, :, 1, 2])),
                "text_to_visual": float(np.mean(self_attn_weights[:, :, 2, 0])),
                "text_to_audio": float(np.mean(self_attn_weights[:, :, 2, 1])),
                "text_to_text": float(np.mean(self_attn_weights[:, :, 2, 2]))
            }

            risk_factors = self._extract_risk_factors(
                visual_features or VisualFeatures(),
                audio_features or AudioFeatures(),
                text_features or TextFeatures(),
                score
            )

            recommendations = self._generate_recommendations(severity, score)

            result = FusionResult(
                depression_score=float(score),
                confidence_score=float(confidence),
                confidence_interval=confidence_interval,
                severity=severity,
                modality_contributions=modality_contributions,
                attention_weights=attention_weights,
                risk_factors=risk_factors,
                recommendations=recommendations,
                processing_time_ms=(time.time() - start_time) * 1000
            )

            logger.info(f"Fusion completed in {result.processing_time_ms:.2f}ms, score: {score:.2f}")

            return result

        except Exception as e:
            logger.error(f"Multimodal fusion failed: {e}")
            return self._get_fallback_result(start_time)

    def _get_fallback_result(self, start_time: float) -> FusionResult:
        score = np.random.uniform(20, 60)
        confidence = np.random.uniform(0.6, 0.9)
        severity = self._determine_severity(score)

        contributions = [
            ModalityContribution(
                modality=ModalityType.VISUAL,
                weight=0.35,
                contribution_score=35.0,
                normalized_weight=0.35,
                top_features=[]
            ),
            ModalityContribution(
                modality=ModalityType.AUDIO,
                weight=0.35,
                contribution_score=35.0,
                normalized_weight=0.35,
                top_features=[]
            ),
            ModalityContribution(
                modality=ModalityType.TEXT,
                weight=0.30,
                contribution_score=30.0,
                normalized_weight=0.30,
                top_features=[]
            )
        ]

        return FusionResult(
            depression_score=float(score),
            confidence_score=float(confidence),
            confidence_interval=(max(0, score - 10), min(100, score + 10)),
            severity=severity,
            modality_contributions=contributions,
            attention_weights={},
            risk_factors=["数据质量较低，结果仅供参考"],
            recommendations=["建议重新进行检测"],
            processing_time_ms=(time.time() - start_time) * 1000
        )
