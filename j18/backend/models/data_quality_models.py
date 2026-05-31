from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum
from datetime import datetime


class QualityMetricType(Enum):
    NULL_RATE = "null_rate"
    DUPLICATE_RATE = "duplicate_rate"
    OUTLIER_RATE = "outlier_rate"
    INVALID_FORMAT_RATE = "invalid_format_rate"
    VALUE_RANGE_VIOLATION = "value_range_violation"
    UNIQUENESS_VIOLATION = "uniqueness_violation"


class AlertLevel(Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    FATAL = "fatal"


class PropagationType(Enum):
    DIRECT = "direct"
    AGGREGATE = "aggregate"
    JOIN = "join"
    TRANSFORM = "transform"
    FILTER = "filter"


@dataclass
class QualityThreshold:
    metric_type: QualityMetricType
    warning_threshold: float
    critical_threshold: float
    description: Optional[str] = None


@dataclass
class ColumnQualityMetrics:
    table_name: str
    column_name: str
    null_rate: float = 0.0
    duplicate_rate: float = 0.0
    outlier_rate: float = 0.0
    invalid_format_rate: float = 0.0
    value_range_violation: float = 0.0
    uniqueness_violation: float = 0.0
    row_count: int = 0
    sample_size: int = 0
    last_updated: str = field(default_factory=lambda: datetime.now().isoformat())

    @property
    def overall_quality_score(self) -> float:
        weights = {
            'null_rate': 0.3,
            'duplicate_rate': 0.2,
            'outlier_rate': 0.2,
            'invalid_format_rate': 0.15,
            'value_range_violation': 0.1,
            'uniqueness_violation': 0.05,
        }
        score = 1.0
        score -= self.null_rate * weights['null_rate']
        score -= self.duplicate_rate * weights['duplicate_rate']
        score -= self.outlier_rate * weights['outlier_rate']
        score -= self.invalid_format_rate * weights['invalid_format_rate']
        score -= self.value_range_violation * weights['value_range_violation']
        score -= self.uniqueness_violation * weights['uniqueness_violation']
        return max(0.0, score)

    def get_alert_level(self, thresholds: List[QualityThreshold]) -> AlertLevel:
        max_level = AlertLevel.INFO
        for threshold in thresholds:
            metric_value = getattr(self, threshold.metric_type.value, 0)
            if metric_value >= threshold.critical_threshold:
                return AlertLevel.FATAL
            elif metric_value >= threshold.warning_threshold:
                max_level = AlertLevel.CRITICAL if max_level == AlertLevel.FATAL else AlertLevel.WARNING
        return max_level


@dataclass
class TableQualityMetrics:
    table_name: str
    columns: Dict[str, ColumnQualityMetrics] = field(default_factory=dict)
    row_count: int = 0
    last_updated: str = field(default_factory=lambda: datetime.now().isoformat())

    @property
    def overall_quality_score(self) -> float:
        if not self.columns:
            return 1.0
        return sum(col.overall_quality_score for col in self.columns.values()) / len(self.columns)


@dataclass
class QualityAlert:
    alert_id: str
    table_name: str
    column_name: str
    metric_type: QualityMetricType
    metric_value: float
    threshold: float
    alert_level: AlertLevel
    message: str
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    resolved: bool = False


@dataclass
class PropagationNode:
    column_id: str
    table_name: str
    column_name: str
    propagation_type: PropagationType
    input_anomaly_rate: float
    output_anomaly_rate: float
    confidence: float
    transformation_logic: str = ""


@dataclass
class AnomalyPropagationResult:
    source_column_id: str
    source_table: str
    source_column: str
    source_anomaly_rate: float
    propagation_chain: List[PropagationNode]
    affected_columns: List[str]
    affected_tables: List[str]
    propagation_path: List[Dict[str, Any]]
    estimated_impact: Dict[str, float]
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class DataQualityReport:
    report_id: str
    tables: Dict[str, TableQualityMetrics] = field(default_factory=dict)
    alerts: List[QualityAlert] = field(default_factory=list)
    propagations: List[AnomalyPropagationResult] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    @property
    def overall_quality_score(self) -> float:
        if not self.tables:
            return 1.0
        return sum(t.overall_quality_score for t in self.tables.values()) / len(self.tables)

    @property
    def critical_alerts_count(self) -> int:
        return sum(1 for a in self.alerts if a.alert_level in [AlertLevel.CRITICAL, AlertLevel.FATAL])


DEFAULT_THRESHOLDS = [
    QualityThreshold(QualityMetricType.NULL_RATE, 0.05, 0.15, "空值率"),
    QualityThreshold(QualityMetricType.DUPLICATE_RATE, 0.02, 0.10, "重复率"),
    QualityThreshold(QualityMetricType.OUTLIER_RATE, 0.03, 0.10, "异常值率"),
    QualityThreshold(QualityMetricType.INVALID_FORMAT_RATE, 0.02, 0.08, "格式错误率"),
    QualityThreshold(QualityMetricType.VALUE_RANGE_VIOLATION, 0.02, 0.08, "值域违规率"),
    QualityThreshold(QualityMetricType.UNIQUENESS_VIOLATION, 0.01, 0.05, "唯一性违规率"),
]
