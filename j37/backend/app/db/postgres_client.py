from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Float, DateTime, Integer, Text, JSON, select, and_
from datetime import datetime
from typing import Optional, List, Dict
import json

from app.config import POSTGRES_DSN


class Base(DeclarativeBase):
    pass


engine = create_async_engine(POSTGRES_DSN, echo=False, pool_size=20, max_overflow=10)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class FeatureRecord(Base):
    __tablename__ = "feature_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[str] = mapped_column(String(64), index=True)
    channel: Mapped[str] = mapped_column(String(32), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, index=True)
    sample_entropy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    fuzzy_entropy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    permutation_entropy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    kurtosis: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    skewness: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    crest_factor: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    shape_factor: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    impulse_factor: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    margin_factor: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    mse_values: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class DiagnosticRecord(Base):
    __tablename__ = "diagnostic_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[str] = mapped_column(String(64), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, index=True)
    anomaly_label: Mapped[str] = mapped_column(String(32))
    anomaly_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    fault_probabilities: Mapped[str] = mapped_column(Text)
    feature_snapshot: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class BaselineProfile(Base):
    __tablename__ = "baseline_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[str] = mapped_column(String(64), index=True)
    profile_name: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime)
    features: Mapped[str] = mapped_column(Text)


class LabeledSample(Base):
    __tablename__ = "labeled_samples"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[str] = mapped_column(String(64), index=True)
    original_diagnostic_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, index=True)
    features: Mapped[str] = mapped_column(Text)
    original_prediction: Mapped[str] = mapped_column(String(64))
    corrected_label: Mapped[str] = mapped_column(String(64))
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    annotator: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    labeled_at: Mapped[datetime] = mapped_column(DateTime)
    used_for_training: Mapped[bool] = mapped_column(default=False)


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[str] = mapped_column(String(64), index=True)
    version: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime)
    training_samples: Mapped[int] = mapped_column(default=0)
    incremental_samples: Mapped[int] = mapped_column(default=0)
    parent_version: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    performance_metrics: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    model_path: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)


class TrainingLog(Base):
    __tablename__ = "training_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[str] = mapped_column(String(64), index=True)
    triggered_by: Mapped[str] = mapped_column(String(32))
    triggered_at: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(32))
    samples_added: Mapped[int] = mapped_column(default=0)
    new_model_version: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def save_feature_record(
    sensor_id: str,
    channel: str,
    timestamp: datetime,
    features: Dict[str, float],
    mse_values: Optional[List[float]] = None,
):
    async with async_session() as session:
        record = FeatureRecord(
            sensor_id=sensor_id,
            channel=channel,
            timestamp=timestamp,
            sample_entropy=features.get("sample_entropy"),
            fuzzy_entropy=features.get("fuzzy_entropy"),
            permutation_entropy=features.get("permutation_entropy"),
            rms=features.get("rms"),
            kurtosis=features.get("kurtosis"),
            skewness=features.get("skewness"),
            crest_factor=features.get("crest_factor"),
            shape_factor=features.get("shape_factor"),
            impulse_factor=features.get("impulse_factor"),
            margin_factor=features.get("margin_factor"),
            mse_values=json.dumps(mse_values) if mse_values else None,
        )
        session.add(record)
        await session.commit()


async def save_diagnostic_record(
    sensor_id: str,
    timestamp: datetime,
    anomaly_label: str,
    fault_probabilities: Dict[str, float],
    anomaly_score: Optional[float] = None,
    feature_snapshot: Optional[Dict] = None,
):
    async with async_session() as session:
        record = DiagnosticRecord(
            sensor_id=sensor_id,
            timestamp=timestamp,
            anomaly_label=anomaly_label,
            anomaly_score=anomaly_score,
            fault_probabilities=json.dumps(fault_probabilities),
            feature_snapshot=json.dumps(feature_snapshot) if feature_snapshot else None,
        )
        session.add(record)
        await session.commit()


async def get_features_range(
    sensor_id: str, start_time: datetime, end_time: datetime, channel: str = "ch_0"
) -> List[Dict]:
    async with async_session() as session:
        stmt = select(FeatureRecord).where(
            and_(
                FeatureRecord.sensor_id == sensor_id,
                FeatureRecord.channel == channel,
                FeatureRecord.timestamp >= start_time,
                FeatureRecord.timestamp <= end_time,
            )
        ).order_by(FeatureRecord.timestamp)
        result = await session.execute(stmt)
        records = result.scalars().all()
        return [
            {
                "timestamp": r.timestamp.isoformat(),
                "sample_entropy": r.sample_entropy,
                "fuzzy_entropy": r.fuzzy_entropy,
                "permutation_entropy": r.permutation_entropy,
                "rms": r.rms,
                "kurtosis": r.kurtosis,
                "skewness": r.skewness,
                "crest_factor": r.crest_factor,
                "shape_factor": r.shape_factor,
                "impulse_factor": r.impulse_factor,
                "margin_factor": r.margin_factor,
                "mse_values": json.loads(r.mse_values) if r.mse_values else None,
            }
            for r in records
        ]


async def get_baseline_features(sensor_id: str) -> Optional[Dict]:
    async with async_session() as session:
        stmt = (
            select(BaselineProfile)
            .where(BaselineProfile.sensor_id == sensor_id)
            .order_by(BaselineProfile.created_at.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        record = result.scalar_one_or_none()
        if record:
            return json.loads(record.features)
        return None


async def save_baseline_profile(
    sensor_id: str, profile_name: str, features: Dict[str, float]
):
    async with async_session() as session:
        record = BaselineProfile(
            sensor_id=sensor_id,
            profile_name=profile_name,
            created_at=datetime.utcnow(),
            features=json.dumps(features),
        )
        session.add(record)
        await session.commit()


async def get_diagnostics_range(
    sensor_id: str, start_time: datetime, end_time: datetime
) -> List[Dict]:
    async with async_session() as session:
        stmt = select(DiagnosticRecord).where(
            and_(
                DiagnosticRecord.sensor_id == sensor_id,
                DiagnosticRecord.timestamp >= start_time,
                DiagnosticRecord.timestamp <= end_time,
            )
        ).order_by(DiagnosticRecord.timestamp)
        result = await session.execute(stmt)
        records = result.scalars().all()
        return [
            {
                "id": r.id,
                "timestamp": r.timestamp.isoformat(),
                "anomaly_label": r.anomaly_label,
                "anomaly_score": r.anomaly_score,
                "fault_probabilities": json.loads(r.fault_probabilities),
                "feature_snapshot": json.loads(r.feature_snapshot)
                if r.feature_snapshot
                else None,
            }
            for r in records
        ]


async def save_labeled_sample(
    sensor_id: str,
    original_diagnostic_id: Optional[int],
    timestamp: datetime,
    features: Dict[str, float],
    original_prediction: str,
    corrected_label: str,
    confidence: Optional[float] = None,
    annotator: Optional[str] = None,
    notes: Optional[str] = None,
) -> int:
    async with async_session() as session:
        record = LabeledSample(
            sensor_id=sensor_id,
            original_diagnostic_id=original_diagnostic_id,
            timestamp=timestamp,
            features=json.dumps(features),
            original_prediction=original_prediction,
            corrected_label=corrected_label,
            confidence=confidence,
            annotator=annotator,
            notes=notes,
            labeled_at=datetime.utcnow(),
            used_for_training=False,
        )
        session.add(record)
        await session.commit()
        await session.refresh(record)
        return record.id


async def get_labeled_samples(
    sensor_id: str,
    include_used: bool = False,
    limit: int = 1000,
) -> List[Dict]:
    async with async_session() as session:
        conditions = [LabeledSample.sensor_id == sensor_id]
        if not include_used:
            conditions.append(LabeledSample.used_for_training == False)
        stmt = (
            select(LabeledSample)
            .where(*conditions)
            .order_by(LabeledSample.labeled_at.desc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        records = result.scalars().all()
        return [
            {
                "id": r.id,
                "timestamp": r.timestamp.isoformat(),
                "features": json.loads(r.features),
                "original_prediction": r.original_prediction,
                "corrected_label": r.corrected_label,
                "confidence": r.confidence,
                "annotator": r.annotator,
                "notes": r.notes,
                "labeled_at": r.labeled_at.isoformat(),
                "used_for_training": r.used_for_training,
            }
            for r in records
        ]


async def mark_samples_used(sample_ids: List[int]):
    async with async_session() as session:
        stmt = select(LabeledSample).where(LabeledSample.id.in_(sample_ids))
        result = await session.execute(stmt)
        records = result.scalars().all()
        for r in records:
            r.used_for_training = True
        await session.commit()


async def save_model_version(
    sensor_id: str,
    version: str,
    training_samples: int,
    incremental_samples: int = 0,
    parent_version: Optional[str] = None,
    performance_metrics: Optional[Dict] = None,
    model_path: Optional[str] = None,
) -> str:
    async with async_session() as session:
        record = ModelVersion(
            sensor_id=sensor_id,
            version=version,
            created_at=datetime.utcnow(),
            training_samples=training_samples,
            incremental_samples=incremental_samples,
            parent_version=parent_version,
            performance_metrics=json.dumps(performance_metrics) if performance_metrics else None,
            is_active=True,
            model_path=model_path,
        )
        session.add(record)
        await session.commit()
        return version


async def get_active_model_version(sensor_id: str) -> Optional[Dict]:
    async with async_session() as session:
        stmt = (
            select(ModelVersion)
            .where(
                and_(
                    ModelVersion.sensor_id == sensor_id,
                    ModelVersion.is_active == True,
                )
            )
            .order_by(ModelVersion.created_at.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        record = result.scalar_one_or_none()
        if record:
            return {
                "version": record.version,
                "created_at": record.created_at.isoformat(),
                "training_samples": record.training_samples,
                "incremental_samples": record.incremental_samples,
                "parent_version": record.parent_version,
                "performance_metrics": json.loads(record.performance_metrics)
                if record.performance_metrics
                else None,
                "model_path": record.model_path,
            }
        return None


async def get_model_history(sensor_id: str, limit: int = 50) -> List[Dict]:
    async with async_session() as session:
        stmt = (
            select(ModelVersion)
            .where(ModelVersion.sensor_id == sensor_id)
            .order_by(ModelVersion.created_at.desc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        records = result.scalars().all()
        return [
            {
                "version": r.version,
                "created_at": r.created_at.isoformat(),
                "training_samples": r.training_samples,
                "incremental_samples": r.incremental_samples,
                "parent_version": r.parent_version,
                "is_active": r.is_active,
            }
            for r in records
        ]


async def save_training_log(
    sensor_id: str,
    triggered_by: str,
    status: str,
    samples_added: int = 0,
    new_model_version: Optional[str] = None,
    error_message: Optional[str] = None,
    duration_seconds: Optional[float] = None,
) -> int:
    async with async_session() as session:
        record = TrainingLog(
            sensor_id=sensor_id,
            triggered_by=triggered_by,
            triggered_at=datetime.utcnow(),
            status=status,
            samples_added=samples_added,
            new_model_version=new_model_version,
            error_message=error_message,
            duration_seconds=duration_seconds,
        )
        session.add(record)
        await session.commit()
        await session.refresh(record)
        return record.id


async def get_training_logs(sensor_id: str, limit: int = 50) -> List[Dict]:
    async with async_session() as session:
        stmt = (
            select(TrainingLog)
            .where(TrainingLog.sensor_id == sensor_id)
            .order_by(TrainingLog.triggered_at.desc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        records = result.scalars().all()
        return [
            {
                "id": r.id,
                "triggered_by": r.triggered_by,
                "triggered_at": r.triggered_at.isoformat(),
                "status": r.status,
                "samples_added": r.samples_added,
                "new_model_version": r.new_model_version,
                "error_message": r.error_message,
                "duration_seconds": r.duration_seconds,
            }
            for r in records
        ]
