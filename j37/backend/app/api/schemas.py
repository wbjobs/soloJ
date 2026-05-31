from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime


class VibrationUploadRequest(BaseModel):
    sensor_id: str = Field(..., description="Sensor identifier")
    data: List[List[float]] = Field(..., description="24-channel vibration data, shape [N, 24]")
    timestamp: Optional[str] = Field(None, description="ISO format timestamp")
    sampling_rate: int = Field(50000, description="Sampling rate in Hz")
    channel_names: Optional[List[str]] = Field(None, description="Channel names")


class VibrationUploadResponse(BaseModel):
    status: str
    sensor_id: str
    samples_received: int
    channels: int
    message: str


class FeatureRequest(BaseModel):
    sensor_id: str
    start_time: str
    end_time: str
    channel: str = "ch_0"


class SpectrumRequest(BaseModel):
    sensor_id: str
    start_time: str
    end_time: str
    channel: str = "ch_0"
    nperseg: int = 4096


class CWTRequest(BaseModel):
    sensor_id: str
    start_time: str
    end_time: str
    channel: str = "ch_0"
    wavelet: str = "morl"
    max_scale: int = 128


class DiagnosticsRequest(BaseModel):
    sensor_id: str
    start_time: str
    end_time: str


class RegionCompareRequest(BaseModel):
    sensor_id: str
    region_start: str
    region_end: str
    channel: str = "ch_0"
    baseline_start: Optional[str] = None
    baseline_end: Optional[str] = None


class FaultProbabilityResponse(BaseModel):
    fault_probabilities: Dict[str, float]
    feature_deltas: Dict[str, float]
    overall_deviation: float
    region_features: Dict[str, float]
    baseline_features: Optional[Dict[str, float]] = None


class DiagnosticsResponse(BaseModel):
    diagnostics: List[Dict]


class FeatureResponse(BaseModel):
    features: List[Dict]


class AnomalyDetectRequest(BaseModel):
    sensor_id: str
    features: Dict[str, float]


class AnomalyDetectResponse(BaseModel):
    anomaly_label: str
    anomaly_score: float
    fault_probabilities: Dict[str, float]


class TrainRequest(BaseModel):
    sensor_id: str
    start_time: str
    end_time: str


class TrainResponse(BaseModel):
    status: str
    message: str
    samples_used: int


class CausalInferenceRequest(BaseModel):
    sensor_id: str
    start_time: str
    end_time: str
    channels: List[str] = Field(default_factory=lambda: [f"ch_{i}" for i in range(6)])
    sample_rate: int = 50000
    te_k: int = 2
    te_bins: int = 8
    gc_max_lag: int = 10


class CausalEdge(BaseModel):
    source: str
    target: str
    strength: float
    normalized_strength: float
    delay_samples: int
    delay_ms: float
    te_net: float
    gc_f_stat: float
    gc_p_value: float
    significant: bool


class CausalNode(BaseModel):
    id: str
    index: int
    rms: float
    energy: float
    kurtosis: float


class CausalPath(BaseModel):
    path: List[str]
    total_delay: float
    avg_strength: float
    hops: int


class CausalInferenceResponse(BaseModel):
    nodes: List[CausalNode]
    edges: List[CausalEdge]
    sample_rate: int
    max_delay_ms: float
    propagation_paths: List[CausalPath]


class LabelSampleRequest(BaseModel):
    sensor_id: str
    diagnostic_id: Optional[int] = None
    timestamp: str
    features: Dict[str, float]
    original_prediction: str
    corrected_label: str
    confidence: Optional[float] = None
    annotator: Optional[str] = None
    notes: Optional[str] = None


class LabelSampleResponse(BaseModel):
    status: str
    sample_id: int
    message: str


class LabeledSamplesResponse(BaseModel):
    samples: List[Dict]
    total: int


class IncrementalTrainRequest(BaseModel):
    sensor_id: str
    triggered_by: str = "manual"
    auto_confirm: bool = True


class IncrementalTrainResponse(BaseModel):
    status: str
    message: str
    new_model_version: Optional[str] = None
    samples_added: int
    duration_seconds: Optional[float] = None


class ModelVersionInfo(BaseModel):
    version: str
    created_at: str
    training_samples: int
    incremental_samples: int
    parent_version: Optional[str] = None
    is_active: bool = True


class ModelHistoryResponse(BaseModel):
    active_version: Optional[ModelVersionInfo] = None
    history: List[ModelVersionInfo]


class TrainingLogResponse(BaseModel):
    logs: List[Dict]
