from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


class ModalityType(str, Enum):
    VISUAL = "visual"
    AUDIO = "audio"
    TEXT = "text"
    FUSION = "fusion"


class DepressionSeverity(str, Enum):
    NONE = "none"
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"


class TypingFeature(BaseModel):
    key: str
    press_time: float
    release_time: float
    hold_time: float
    next_key_interval: Optional[float] = None


class TypingFeatures(BaseModel):
    features: List[TypingFeature]
    avg_hold_time: float
    avg_interval: float
    variance_hold_time: float
    variance_interval: float
    backspace_rate: float
    error_rate: float
    total_chars: int
    duration_seconds: float


class VisualFeatures(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    au_scores: Dict[str, float] = Field(default_factory=dict, description="面部动作单元得分")
    gaze_avoidance_duration: float = Field(0.0, description="眼神回避时长(秒)")
    gaze_avoidance_ratio: float = Field(0.0, description="眼神回避占比")
    smile_frequency: float = Field(0.0, description="微笑频率(次/分钟)")
    smile_duration_ratio: float = Field(0.0, description="微笑时长占比")
    head_pitch: float = Field(0.0, description="头部俯仰角")
    head_yaw: float = Field(0.0, description="头部偏航角")
    head_roll: float = Field(0.0, description="头部翻滚角")
    blink_rate: float = Field(0.0, description="眨眼频率")
    eyebrow_raise_frequency: float = Field(0.0, description="抬眉频率")
    frowning_frequency: float = Field(0.0, description="皱眉频率")
    preprocessing_info: Dict[str, Any] = Field(default_factory=dict, description="图像预处理信息")
    feature_vector: List[float] = Field(default_factory=list)
    processing_time_ms: float = 0.0


class AudioFeatures(BaseModel):
    speech_rate: float = Field(0.0, description="语速(词/分钟)")
    pitch_mean: float = Field(0.0, description="基频均值(Hz)")
    pitch_std: float = Field(0.0, description="基频标准差")
    pitch_min: float = Field(0.0, description="基频最小值")
    pitch_max: float = Field(0.0, description="基频最大值")
    pitch_range: float = Field(0.0, description="基频范围")
    pause_count: int = Field(0, description="停顿次数")
    pause_duration_mean: float = Field(0.0, description="平均停顿时长(秒)")
    pause_duration_total: float = Field(0.0, description="总停顿时长(秒)")
    pause_ratio: float = Field(0.0, description="停顿占比")
    jitter: float = Field(0.0, description="基频微扰")
    shimmer: float = Field(0.0, description="振幅微扰")
    hnr: float = Field(0.0, description="谐波噪声比")
    energy_mean: float = Field(0.0, description="能量均值")
    energy_std: float = Field(0.0, description="能量标准差")
    voice_quality: Dict[str, float] = Field(default_factory=dict)
    preprocessing_info: Dict[str, Any] = Field(default_factory=dict, description="音频预处理信息")
    feature_vector: List[float] = Field(default_factory=list)
    processing_time_ms: float = 0.0


class TextFeatures(BaseModel):
    negative_word_count: int = Field(0, description="消极词汇数量")
    negative_word_ratio: float = Field(0.0, description="消极词汇占比")
    first_person_singular_count: int = Field(0, description="第一人称单数数量")
    first_person_singular_ratio: float = Field(0.0, description="第一人称单数占比")
    first_person_plural_count: int = Field(0, description="第一人称复数数量")
    third_person_count: int = Field(0, description="第三人称数量")
    sentiment_score: float = Field(0.0, description="情感得分(-1到1)")
    sentiment_label: str = Field("", description="情感标签")
    emotion_scores: Dict[str, float] = Field(default_factory=dict)
    avg_sentence_length: float = Field(0.0, description="平均句长")
    avg_word_length: float = Field(0.0, description="平均词长")
    vocabulary_richness: float = Field(0.0, description="词汇丰富度")
    past_tense_ratio: float = Field(0.0, description="过去时态占比")
    present_tense_ratio: float = Field(0.0, description="现在时态占比")
    death_related_words: int = Field(0, description="死亡相关词汇数量")
    hopelessness_words: int = Field(0, description="绝望相关词汇数量")
    feature_vector: List[float] = Field(default_factory=list)
    processing_time_ms: float = 0.0


class ModalityContribution(BaseModel):
    modality: ModalityType
    weight: float
    contribution_score: float
    normalized_weight: float
    top_features: List[Dict[str, Any]] = Field(default_factory=list)


class FusionResult(BaseModel):
    depression_score: float = Field(..., ge=0.0, le=100.0, description="抑郁倾向评分(0-100)")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="置信度")
    confidence_interval: Tuple[float, float] = Field(..., description="置信区间")
    severity: DepressionSeverity
    modality_contributions: List[ModalityContribution]
    attention_weights: Dict[str, float] = Field(default_factory=dict)
    risk_factors: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    processing_time_ms: float = 0.0


class ExplainabilityResult(BaseModel):
    shap_values: Dict[str, float] = Field(default_factory=dict)
    feature_importance: List[Dict[str, Any]] = Field(default_factory=list)
    modality_contributions: List[ModalityContribution]
    decision_path: List[Dict[str, Any]] = Field(default_factory=list)
    visualization_data: Dict[str, Any] = Field(default_factory=dict)


class MultimodalRequest(BaseModel):
    session_id: str
    user_id: Optional[str] = None
    video_data: Optional[str] = None
    audio_data: Optional[str] = None
    text_data: Optional[str] = None
    typing_features: Optional[TypingFeatures] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    additional_metadata: Dict[str, Any] = Field(default_factory=dict)


class MultimodalResponse(BaseModel):
    session_id: str
    request_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    visual_features: Optional[VisualFeatures] = None
    audio_features: Optional[AudioFeatures] = None
    text_features: Optional[TextFeatures] = None
    fusion_result: Optional[FusionResult] = None
    explainability: Optional[ExplainabilityResult] = None
    status: str
    message: Optional[str] = None


class UserRecord(BaseModel):
    user_id: str
    session_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    visual_features: Optional[VisualFeatures] = None
    audio_features: Optional[AudioFeatures] = None
    text_features: Optional[TextFeatures] = None
    typing_features: Optional[TypingFeatures] = None
    fusion_result: Optional[FusionResult] = None
    is_used_for_training: bool = False
    federated_gradient_uploaded: bool = False


class FederatedUpdateRequest(BaseModel):
    client_id: str
    round_num: int
    model_weights: Dict[str, List[float]]
    sample_count: int
    metrics: Dict[str, float] = Field(default_factory=dict)


class TrendPoint(BaseModel):
    timestamp: datetime
    depression_score: float
    severity: DepressionSeverity
    visual_contribution: float = 0.0
    audio_contribution: float = 0.0
    text_contribution: float = 0.0


class HistoryTrajectory(BaseModel):
    user_id: str
    record_count: int
    first_assessment_date: Optional[datetime] = None
    last_assessment_date: Optional[datetime] = None
    score_trend: List[TrendPoint] = Field(default_factory=list)
    avg_score: float = 0.0
    min_score: float = 0.0
    max_score: float = 0.0
    score_std: float = 0.0
    trend_direction: str = "stable"
    trend_slope: float = 0.0


class PredictionRequest(BaseModel):
    user_id: str
    prediction_horizon: int = Field(3, ge=1, le=14, description="预测天数")
    include_confidence: bool = True


class SinglePrediction(BaseModel):
    predicted_date: datetime
    predicted_score: float
    lower_bound: float
    upper_bound: float
    predicted_severity: DepressionSeverity


class TrendPredictionResult(BaseModel):
    user_id: str
    prediction_timestamp: datetime
    history_points: int
    prediction_horizon: int
    predictions: List[SinglePrediction]
    overall_trend: str
    risk_level: str
    key_indicators: Dict[str, Any] = Field(default_factory=dict)
    model_confidence: float = 0.0


class CrisisLevel(str, Enum):
    NONE = "none"
    ELEVATED = "elevated"
    MODERATE = "moderate"
    SEVERE = "severe"
    CRITICAL = "critical"


class HotlineInfo(BaseModel):
    name: str
    phone: str
    service_hours: str = "24小时"
    description: Optional[str] = None
    website: Optional[str] = None
    is_crisis: bool = False


class InterventionRecommendation(BaseModel):
    priority: int
    category: str
    title: str
    description: str
    action_items: List[str] = Field(default_factory=list)
    timeframe: str = "immediate"


class InterventionReport(BaseModel):
    report_id: str
    user_id: str
    session_id: Optional[str] = None
    generated_at: datetime
    crisis_level: CrisisLevel
    current_score: float
    score_trend: str
    triggering_factors: List[str] = Field(default_factory=list)
    recommendations: List[InterventionRecommendation] = Field(default_factory=list)
    hotlines: List[HotlineInfo] = Field(default_factory=list)
    additional_resources: List[Dict[str, str]] = Field(default_factory=list)
    disclaimer: str = "本报告仅供研究参考，不构成医疗建议。如有紧急情况，请立即拨打急救电话或前往医院就诊。"


class InterventionConfig(BaseModel):
    crisis_threshold: float = 85.0
    sustained_rise_count: int = 2
    enable_auto_intervention: bool = True
    enable_hotline_push: bool = True
    notification_channels: List[str] = Field(default_factory=lambda: ["in_app"])
    custom_hotlines: List[HotlineInfo] = Field(default_factory=list)
