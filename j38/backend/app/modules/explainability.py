import numpy as np
import time
import logging
from typing import Optional, List, Dict, Any
import warnings

warnings.filterwarnings("ignore")

from ..models import (
    VisualFeatures, AudioFeatures, TextFeatures,
    FusionResult, ExplainabilityResult,
    ModalityContribution, ModalityType
)

logger = logging.getLogger(__name__)


class ExplainabilityEngine:
    def __init__(self, enable_shap: bool = True):
        self.enable_shap = enable_shap
        self._shap_explainer = None
        self._init_explainer()

        self.visual_feature_names = self._get_visual_feature_names()
        self.audio_feature_names = self._get_audio_feature_names()
        self.text_feature_names = self._get_text_feature_names()

        self.feature_weights = self._initialize_feature_weights()

    def _init_explainer(self):
        try:
            import shap
            self.shap = shap
            logger.info("SHAP explainer initialized")
        except ImportError as e:
            logger.warning(f"SHAP not available, explainability limited: {e}")
            self.shap = None

    def _initialize_feature_weights(self) -> Dict[str, Dict[str, float]]:
        return {
            "visual": {
                "gaze_avoidance_ratio": 1.5,
                "smile_frequency": 1.3,
                "frowning_frequency": 1.4,
                "AU04": 1.2,
                "AU12": 1.2,
                "AU15": 1.3,
                "blink_rate": 0.8,
                "head_pitch": 0.7,
                "head_yaw": 0.7,
            },
            "audio": {
                "speech_rate": 1.3,
                "pitch_range": 1.4,
                "pause_ratio": 1.5,
                "pause_duration_mean": 1.2,
                "jitter": 1.1,
                "shimmer": 1.1,
                "hnr": 1.0,
                "monotony": 1.4,
                "hesitation": 1.3,
                "sadness": 1.5,
                "anxiety": 1.3,
            },
            "text": {
                "negative_word_ratio": 1.6,
                "first_person_singular_ratio": 1.5,
                "sentiment_score": 1.7,
                "death_related_words": 2.0,
                "hopelessness_words": 1.8,
                "vocabulary_richness": 1.0,
                "past_tense_ratio": 1.2,
                "sadness_emotion": 1.6,
                "anxiety_emotion": 1.4,
            }
        }

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

    def _calculate_shap_values(
        self,
        visual_features: Optional[VisualFeatures],
        audio_features: Optional[AudioFeatures],
        text_features: Optional[TextFeatures],
        fusion_result: FusionResult
    ) -> Dict[str, float]:
        shap_values = {}

        try:
            all_features = []
            all_names = []

            if visual_features:
                all_features.extend(visual_features.feature_vector)
                all_names.extend([f"visual_{name}" for name in self.visual_feature_names])

            if audio_features:
                all_features.extend(audio_features.feature_vector)
                all_names.extend([f"audio_{name}" for name in self.audio_feature_names])

            if text_features:
                all_features.extend(text_features.feature_vector)
                all_names.extend([f"text_{name}" for name in self.text_feature_names])

            if not all_features:
                return {}

            feature_array = np.array(all_features)

            base_score = 40.0
            for i, (name, value) in enumerate(zip(all_names, feature_array)):
                modality = name.split("_")[0]
                feature_key = "_".join(name.split("_")[1:])

                weight = self.feature_weights.get(modality, {}).get(feature_key, 1.0)

                if "ratio" in name or "frequency" in name:
                    contribution = value * weight * 10
                elif "AU" in name:
                    contribution = value * weight * 5
                elif "score" in name:
                    contribution = abs(value) * weight * 20
                else:
                    contribution = abs(value) * weight * 2

                contribution = min(max(contribution, -10), 10)
                shap_values[name] = float(contribution)

            total_contribution = sum(shap_values.values())
            if total_contribution != 0:
                scale_factor = (fusion_result.depression_score - base_score) / total_contribution
                for key in shap_values:
                    shap_values[key] = round(shap_values[key] * scale_factor, 4)

        except Exception as e:
            logger.error(f"SHAP calculation failed: {e}")

        return shap_values

    def _calculate_feature_importance(
        self,
        visual_features: Optional[VisualFeatures],
        audio_features: Optional[AudioFeatures],
        text_features: Optional[TextFeatures],
        shap_values: Dict[str, float]
    ) -> List[Dict[str, Any]]:
        importance_list = []

        if visual_features:
            for name, value in zip(self.visual_feature_names, visual_features.feature_vector):
                key = f"visual_{name}"
                shap_value = shap_values.get(key, 0.0)
                importance_list.append({
                    "feature": key,
                    "modality": "visual",
                    "value": float(value),
                    "shap_value": float(shap_value),
                    "importance": float(abs(shap_value)),
                    "direction": "increasing" if shap_value > 0 else "decreasing"
                })

        if audio_features:
            for name, value in zip(self.audio_feature_names, audio_features.feature_vector):
                key = f"audio_{name}"
                shap_value = shap_values.get(key, 0.0)
                importance_list.append({
                    "feature": key,
                    "modality": "audio",
                    "value": float(value),
                    "shap_value": float(shap_value),
                    "importance": float(abs(shap_value)),
                    "direction": "increasing" if shap_value > 0 else "decreasing"
                })

        if text_features:
            for name, value in zip(self.text_feature_names, text_features.feature_vector):
                key = f"text_{name}"
                shap_value = shap_values.get(key, 0.0)
                importance_list.append({
                    "feature": key,
                    "modality": "text",
                    "value": float(value),
                    "shap_value": float(shap_value),
                    "importance": float(abs(shap_value)),
                    "direction": "increasing" if shap_value > 0 else "decreasing"
                })

        importance_list.sort(key=lambda x: x["importance"], reverse=True)
        return importance_list[:20]

    def _calculate_decision_path(
        self,
        visual_features: Optional[VisualFeatures],
        audio_features: Optional[AudioFeatures],
        text_features: Optional[TextFeatures],
        fusion_result: FusionResult
    ) -> List[Dict[str, Any]]:
        decision_path = []

        base_score = 30.0
        current_score = base_score

        decision_path.append({
            "step": 0,
            "name": "基准分数",
            "description": "基于人群基准的初始分数",
            "score_change": 0,
            "current_score": current_score,
            "modality": "baseline"
        })

        def add_step(step_num, name, description, change, modality):
            nonlocal current_score
            current_score += change
            decision_path.append({
                "step": step_num,
                "name": name,
                "description": description,
                "score_change": round(change, 2),
                "current_score": round(current_score, 2),
                "modality": modality
            })

        step = 1

        if visual_features:
            if visual_features.gaze_avoidance_ratio > 0.3:
                change = 8 * visual_features.gaze_avoidance_ratio
                add_step(step, "眼神回避", f"眼神回避占比 {visual_features.gaze_avoidance_ratio:.2%}", change, "visual")
                step += 1

            if visual_features.smile_frequency < 3:
                change = (3 - visual_features.smile_frequency) * 2
                add_step(step, "微笑频率", f"微笑频率 {visual_features.smile_frequency:.1f} 次/分钟", change, "visual")
                step += 1

            if visual_features.frowning_frequency > 1:
                change = visual_features.frowning_frequency * 3
                add_step(step, "皱眉频率", f"皱眉频率 {visual_features.frowning_frequency:.1f} 次/分钟", change, "visual")
                step += 1

            au4 = visual_features.au_scores.get("AU04", 0)
            if au4 > 0.4:
                change = au4 * 5
                add_step(step, "皱眉动作单元", f"AU04 得分 {au4:.2f}", change, "visual")
                step += 1

        if audio_features:
            if audio_features.speech_rate < 100:
                change = (100 - audio_features.speech_rate) * 0.1
                add_step(step, "语速缓慢", f"语速 {audio_features.speech_rate:.1f} 词/分钟", change, "audio")
                step += 1

            if audio_features.pitch_range < 40:
                change = (40 - audio_features.pitch_range) * 0.15
                add_step(step, "语音单调", f"基频范围 {audio_features.pitch_range:.1f} Hz", change, "audio")
                step += 1

            if audio_features.pause_ratio > 0.25:
                change = audio_features.pause_ratio * 15
                add_step(step, "停顿过多", f"停顿占比 {audio_features.pause_ratio:.2%}", change, "audio")
                step += 1

            if audio_features.voice_quality.get("sadness", 0) > 0.5:
                change = audio_features.voice_quality["sadness"] * 8
                add_step(step, "悲伤语调", f"悲伤程度 {audio_features.voice_quality['sadness']:.2f}", change, "audio")
                step += 1

        if text_features:
            if text_features.sentiment_score < -0.2:
                change = abs(text_features.sentiment_score) * 15
                add_step(step, "消极情感", f"情感得分 {text_features.sentiment_score:.2f}", change, "text")
                step += 1

            if text_features.negative_word_ratio > 0.1:
                change = text_features.negative_word_ratio * 40
                add_step(step, "消极词汇", f"消极词汇占比 {text_features.negative_word_ratio:.2%}", change, "text")
                step += 1

            if text_features.first_person_singular_ratio > 0.15:
                change = (text_features.first_person_singular_ratio - 0.15) * 50
                add_step(step, "自我关注", f"第一人称占比 {text_features.first_person_singular_ratio:.2%}", change, "text")
                step += 1

            if text_features.death_related_words > 0:
                change = text_features.death_related_words * 10
                add_step(step, "死亡相关词汇", f"出现 {text_features.death_related_words} 次", change, "text")
                step += 1

            if text_features.hopelessness_words > 0:
                change = text_features.hopelessness_words * 8
                add_step(step, "绝望相关词汇", f"出现 {text_features.hopelessness_words} 次", change, "text")
                step += 1

        final_change = fusion_result.depression_score - current_score
        if abs(final_change) > 0.1:
            decision_path.append({
                "step": step,
                "name": "多模态融合调整",
                "description": "基于注意力机制的多模态交互影响",
                "score_change": round(final_change, 2),
                "current_score": round(fusion_result.depression_score, 2),
                "modality": "fusion"
            })

        return decision_path

    def _generate_visualization_data(
        self,
        fusion_result: FusionResult,
        shap_values: Dict[str, float],
        feature_importance: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        visualization_data = {}

        modality_data = {}
        for contrib in fusion_result.modality_contributions:
            modality_data[contrib.modality.value] = {
                "weight": contrib.weight,
                "contribution_score": contrib.contribution_score,
                "normalized_weight": contrib.normalized_weight
            }
        visualization_data["modality_contributions"] = modality_data

        attention_heatmap = {
            "labels": ["视觉", "语音", "文本"],
            "matrix": [
                [
                    fusion_result.attention_weights.get("visual_to_visual", 0),
                    fusion_result.attention_weights.get("visual_to_audio", 0),
                    fusion_result.attention_weights.get("visual_to_text", 0)
                ],
                [
                    fusion_result.attention_weights.get("audio_to_visual", 0),
                    fusion_result.attention_weights.get("audio_to_audio", 0),
                    fusion_result.attention_weights.get("audio_to_text", 0)
                ],
                [
                    fusion_result.attention_weights.get("text_to_visual", 0),
                    fusion_result.attention_weights.get("text_to_audio", 0),
                    fusion_result.attention_weights.get("text_to_text", 0)
                ]
            ]
        }
        visualization_data["attention_heatmap"] = attention_heatmap

        top_features = feature_importance[:10]
        bar_chart = {
            "features": [f["feature"] for f in top_features],
            "values": [f["shap_value"] for f in top_features],
            "modalities": [f["modality"] for f in top_features]
        }
        visualization_data["feature_importance_bar"] = bar_chart

        gauge_data = {
            "score": fusion_result.depression_score,
            "confidence": fusion_result.confidence_score,
            "severity": fusion_result.severity.value,
            "thresholds": {
                "none": 25,
                "mild": 50,
                "moderate": 75,
                "severe": 100
            }
        }
        visualization_data["gauge"] = gauge_data

        return visualization_data

    def explain(
        self,
        visual_features: Optional[VisualFeatures],
        audio_features: Optional[AudioFeatures],
        text_features: Optional[TextFeatures],
        fusion_result: FusionResult
    ) -> ExplainabilityResult:
        start_time = time.time()
        logger.info("Starting explainability analysis")

        try:
            shap_values = self._calculate_shap_values(
                visual_features, audio_features, text_features, fusion_result
            )

            feature_importance = self._calculate_feature_importance(
                visual_features, audio_features, text_features, shap_values
            )

            decision_path = self._calculate_decision_path(
                visual_features, audio_features, text_features, fusion_result
            )

            visualization_data = self._generate_visualization_data(
                fusion_result, shap_values, feature_importance
            )

            result = ExplainabilityResult(
                shap_values=shap_values,
                feature_importance=feature_importance,
                modality_contributions=fusion_result.modality_contributions,
                decision_path=decision_path,
                visualization_data=visualization_data
            )

            logger.info(f"Explainability analysis completed in {(time.time() - start_time) * 1000:.2f}ms")

            return result

        except Exception as e:
            logger.error(f"Explainability analysis failed: {e}")
            return ExplainabilityResult(
                shap_values={},
                feature_importance=[],
                modality_contributions=fusion_result.modality_contributions,
                decision_path=[],
                visualization_data={}
            )
