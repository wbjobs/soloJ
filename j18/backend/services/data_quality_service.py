from typing import List, Dict, Optional, Any, Tuple
from dataclasses import asdict, dataclass
import json
import uuid
from datetime import datetime

try:
    import great_expectations as ge
    from great_expectations.dataset import PandasDataset
    GE_AVAILABLE = True
except ImportError:
    GE_AVAILABLE = False

import pandas as pd
import numpy as np

from ..models.data_quality_models import (
    ColumnQualityMetrics,
    TableQualityMetrics,
    QualityAlert,
    QualityThreshold,
    QualityMetricType,
    AlertLevel,
    DEFAULT_THRESHOLDS,
)


class DataQualityService:
    def __init__(self, thresholds: List[QualityThreshold] = None):
        self.thresholds = thresholds or DEFAULT_THRESHOLDS
        self.ge_context = None
        self._init_ge_context()

    def _init_ge_context(self):
        if not GE_AVAILABLE:
            return
        try:
            pass
        except Exception:
            pass

    def analyze_column_quality(
        self,
        df: pd.DataFrame,
        table_name: str,
        column_name: str,
        custom_rules: Optional[List[Dict[str, Any]]] = None,
    ) -> ColumnQualityMetrics:
        metrics = ColumnQualityMetrics(
            table_name=table_name,
            column_name=column_name,
            row_count=len(df),
            sample_size=min(len(df), 10000),
        )

        if column_name not in df.columns:
            return metrics

        series = df[column_name]

        metrics.null_rate = float(series.isnull().sum() / len(series))
        metrics.duplicate_rate = float(series.duplicated().sum() / len(series)) if len(series) > 0 else 0.0

        if pd.api.types.is_numeric_dtype(series):
            metrics.outlier_rate = self._calculate_outlier_rate(series)
        else:
            metrics.outlier_rate = 0.0

        if GE_AVAILABLE:
            ge_metrics = self._get_ge_metrics(df, column_name)
            metrics.invalid_format_rate = ge_metrics.get('invalid_format_rate', 0.0)
            metrics.value_range_violation = ge_metrics.get('value_range_violation', 0.0)
        else:
            metrics.invalid_format_rate = 0.0
            metrics.value_range_violation = self._calculate_range_violation(series)

        metrics.uniqueness_violation = metrics.duplicate_rate

        return metrics

    def analyze_table_quality(
        self,
        df: pd.DataFrame,
        table_name: str,
        custom_rules: Optional[Dict[str, List[Dict[str, Any]]]] = None,
    ) -> TableQualityMetrics:
        table_metrics = TableQualityMetrics(
            table_name=table_name,
            row_count=len(df),
        )

        for column_name in df.columns:
            column_rules = custom_rules.get(column_name) if custom_rules else None
            column_metrics = self.analyze_column_quality(
                df, table_name, column_name, column_rules
            )
            table_metrics.columns[column_name] = column_metrics

        return table_metrics

    def _calculate_outlier_rate(self, series: pd.Series) -> float:
        if len(series) < 4:
            return 0.0

        series_clean = series.dropna()
        if len(series_clean) == 0:
            return 0.0

        q1 = series_clean.quantile(0.25)
        q3 = series_clean.quantile(0.75)
        iqr = q3 - q1

        if iqr == 0:
            return 0.0

        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr

        outliers = series_clean[(series_clean < lower_bound) | (series_clean > upper_bound)]
        return float(len(outliers) / len(series))

    def _calculate_range_violation(self, series: pd.Series) -> float:
        if not pd.api.types.is_numeric_dtype(series):
            return 0.0

        series_clean = series.dropna()
        if len(series_clean) < 10:
            return 0.0

        mean = series_clean.mean()
        std = series_clean.std()

        if std == 0:
            return 0.0

        z_scores = np.abs((series_clean - mean) / std)
        violations = (z_scores > 3).sum()
        return float(violations / len(series))

    def _get_ge_metrics(self, df: pd.DataFrame, column_name: str) -> Dict[str, float]:
        if not GE_AVAILABLE:
            return {}

        try:
            dataset = PandasDataset(df)
            metrics = {}

            format_result = dataset.expect_column_values_to_match_regex(
                column=column_name,
                regex=r'^[A-Za-z0-9_.]+$',
                catch_exceptions=True,
            )
            if format_result.success:
                metrics['invalid_format_rate'] = 0.0
            else:
                unexpected_count = format_result.result.get('unexpected_count', 0)
                element_count = format_result.result.get('element_count', len(df))
                metrics['invalid_format_rate'] = unexpected_count / element_count if element_count > 0 else 0.0

            return metrics
        except Exception:
            return {}

    def generate_alerts(
        self,
        metrics: TableQualityMetrics,
    ) -> List[QualityAlert]:
        alerts = []

        for column_name, column_metrics in metrics.columns.items():
            for threshold in self.thresholds:
                metric_value = getattr(column_metrics, threshold.metric_type.value, 0)

                if metric_value >= threshold.critical_threshold:
                    alert = QualityAlert(
                        alert_id=str(uuid.uuid4()),
                        table_name=metrics.table_name,
                        column_name=column_name,
                        metric_type=threshold.metric_type,
                        metric_value=metric_value,
                        threshold=threshold.critical_threshold,
                        alert_level=AlertLevel.CRITICAL,
                        message=f"{threshold.description} 严重超标: {metric_value:.2%} (阈值: {threshold.critical_threshold:.2%})",
                    )
                    alerts.append(alert)
                elif metric_value >= threshold.warning_threshold:
                    alert = QualityAlert(
                        alert_id=str(uuid.uuid4()),
                        table_name=metrics.table_name,
                        column_name=column_name,
                        metric_type=threshold.metric_type,
                        metric_value=metric_value,
                        threshold=threshold.warning_threshold,
                        alert_level=AlertLevel.WARNING,
                        message=f"{threshold.description} 警告: {metric_value:.2%} (阈值: {threshold.warning_threshold:.2%})",
                    )
                    alerts.append(alert)

        return alerts

    def get_quality_score_color(self, score: float) -> str:
        if score >= 0.9:
            return "#52c41a"
        elif score >= 0.7:
            return "#faad14"
        elif score >= 0.5:
            return "#fa8c16"
        else:
            return "#f5222d"

    def get_alert_level_color(self, level: AlertLevel) -> str:
        color_map = {
            AlertLevel.INFO: "#1890ff",
            AlertLevel.WARNING: "#faad14",
            AlertLevel.CRITICAL: "#fa8c16",
            AlertLevel.FATAL: "#f5222d",
        }
        return color_map.get(level, "#999")

    def simulate_quality_metrics(
        self,
        table_name: str,
        columns: List[str],
        anomaly_patterns: Optional[Dict[str, Dict[str, float]]] = None,
    ) -> TableQualityMetrics:
        table_metrics = TableQualityMetrics(
            table_name=table_name,
            row_count=10000,
        )

        for column_name in columns:
            column_metrics = ColumnQualityMetrics(
                table_name=table_name,
                column_name=column_name,
                row_count=10000,
                sample_size=10000,
            )

            if anomaly_patterns and column_name in anomaly_patterns:
                pattern = anomaly_patterns[column_name]
                column_metrics.null_rate = pattern.get('null_rate', np.random.uniform(0, 0.03))
                column_metrics.duplicate_rate = pattern.get('duplicate_rate', np.random.uniform(0, 0.02))
                column_metrics.outlier_rate = pattern.get('outlier_rate', np.random.uniform(0, 0.03))
                column_metrics.invalid_format_rate = pattern.get('invalid_format_rate', np.random.uniform(0, 0.01))
            else:
                column_metrics.null_rate = np.random.uniform(0, 0.05)
                column_metrics.duplicate_rate = np.random.uniform(0, 0.02)
                column_metrics.outlier_rate = np.random.uniform(0, 0.03)
                column_metrics.invalid_format_rate = np.random.uniform(0, 0.02)
                column_metrics.value_range_violation = np.random.uniform(0, 0.02)
                column_metrics.uniqueness_violation = np.random.uniform(0, 0.01)

            table_metrics.columns[column_name] = column_metrics

        return table_metrics
