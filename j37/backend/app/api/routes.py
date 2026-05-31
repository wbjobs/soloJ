import numpy as np
from fastapi import APIRouter, HTTPException
from datetime import datetime
from typing import Dict, List

from app.api.schemas import (
    VibrationUploadRequest,
    VibrationUploadResponse,
    FeatureRequest,
    FeatureResponse,
    SpectrumRequest,
    CWTRequest,
    DiagnosticsRequest,
    DiagnosticsResponse,
    RegionCompareRequest,
    FaultProbabilityResponse,
    AnomalyDetectRequest,
    AnomalyDetectResponse,
    TrainRequest,
    TrainResponse,
    CausalInferenceRequest,
    CausalInferenceResponse,
    LabelSampleRequest,
    LabelSampleResponse,
    LabeledSamplesResponse,
    IncrementalTrainRequest,
    IncrementalTrainResponse,
    ModelHistoryResponse,
    ModelVersionInfo,
    TrainingLogResponse,
)
from app.features.entropy import (
    compute_features_for_channel,
    compute_features_multichannel,
    compute_spectrum,
    compute_cwt,
    compute_multiscale_entropy_for_channel,
)
from app.models.detector import EnsembleAnomalyDetector, FaultClassifier
from app.db.postgres_client import (
    save_feature_record,
    get_features_range,
    get_baseline_features,
    save_diagnostic_record,
    save_baseline_profile,
    get_diagnostics_range,
    save_labeled_sample,
    get_labeled_samples,
    mark_samples_used,
    save_model_version,
    get_active_model_version,
    get_model_history,
    save_training_log,
    get_training_logs,
)
from app.db.influx_client import influx_manager
from app.config import SAMPLING_RATE, NUM_CHANNELS, FEATURE_NAMES
from app.features.causal_network import CausalInferenceEngine
import time

router = APIRouter()

_detector = EnsembleAnomalyDetector()
_classifier = FaultClassifier()


@router.post("/upload", response_model=VibrationUploadResponse)
async def upload_vibration(req: VibrationUploadRequest):
    data = np.array(req.data, dtype=np.float64)
    if data.ndim == 1:
        data = data.reshape(-1, 1)
    num_samples, num_channels = data.shape

    ts = datetime.fromisoformat(req.timestamp) if req.timestamp else datetime.utcnow()
    channel_names = req.channel_names or [f"ch_{i}" for i in range(num_channels)]

    try:
        await influx_manager.write_signal(
            sensor_id=req.sensor_id,
            data=data,
            timestamp=ts,
            channel_names=channel_names,
            sampling_rate=req.sampling_rate,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"InfluxDB write error: {e}")

    features = compute_features_multichannel(data, channel_names)
    for feat in features:
        ch = feat.pop("channel")
        await save_feature_record(
            sensor_id=req.sensor_id,
            channel=ch,
            timestamp=ts,
            features=feat,
        )

    return VibrationUploadResponse(
        status="ok",
        sensor_id=req.sensor_id,
        samples_received=num_samples,
        channels=num_channels,
        message="Data uploaded, features computed and stored",
    )


@router.post("/features", response_model=FeatureResponse)
async def get_features(req: FeatureRequest):
    start = datetime.fromisoformat(req.start_time)
    end = datetime.fromisoformat(req.end_time)
    features = await get_features_range(req.sensor_id, start, end, req.channel)
    if not features:
        raise HTTPException(status_code=404, detail="No features found for the given range")
    return FeatureResponse(features=features)


@router.post("/spectrum")
async def get_spectrum(req: SpectrumRequest):
    start = datetime.fromisoformat(req.start_time)
    end = datetime.fromisoformat(req.end_time)
    try:
        df = influx_manager.query_signal_raw(req.sensor_id, start, end, req.channel)
        if df.empty:
            raise HTTPException(status_code=404, detail="No signal data found")
        signal = df["_value"].values.astype(np.float64)
        result = compute_spectrum(signal, fs=SAMPLING_RATE, nperseg=req.nperseg)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Spectrum computation error: {e}")


@router.post("/cwt")
async def get_cwt(req: CWTRequest):
    start = datetime.fromisoformat(req.start_time)
    end = datetime.fromisoformat(req.end_time)
    try:
        df = influx_manager.query_signal_raw(req.sensor_id, start, end, req.channel)
        if df.empty:
            raise HTTPException(status_code=404, detail="No signal data found")
        signal = df["_value"].values.astype(np.float64)
        scales = np.arange(1, req.max_scale + 1)
        result = compute_cwt(signal, fs=SAMPLING_RATE, wavelet=req.wavelet, scales=scales)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CWT computation error: {e}")


@router.post("/diagnostics", response_model=DiagnosticsResponse)
async def get_diagnostics(req: DiagnosticsRequest):
    start = datetime.fromisoformat(req.start_time)
    end = datetime.fromisoformat(req.end_time)
    diagnostics = await get_diagnostics_range(req.sensor_id, start, end)
    if not diagnostics:
        raise HTTPException(status_code=404, detail="No diagnostics found for the given range")
    return DiagnosticsResponse(diagnostics=diagnostics)


@router.post("/region-compare", response_model=FaultProbabilityResponse)
async def compare_region(req: RegionCompareRequest):
    region_start = datetime.fromisoformat(req.region_start)
    region_end = datetime.fromisoformat(req.region_end)

    try:
        df = influx_manager.query_signal_raw(req.sensor_id, region_start, region_end, req.channel)
        if df.empty:
            raise HTTPException(status_code=404, detail="No signal data in selected region")
        region_signal = df["_value"].values.astype(np.float64)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Signal query error: {e}")

    region_features = compute_features_for_channel(region_signal)

    baseline_features = None
    if req.baseline_start and req.baseline_end:
        bl_start = datetime.fromisoformat(req.baseline_start)
        bl_end = datetime.fromisoformat(req.baseline_end)
        try:
            df_bl = influx_manager.query_signal_raw(req.sensor_id, bl_start, bl_end, req.channel)
            if not df_bl.empty:
                bl_signal = df_bl["_value"].values.astype(np.float64)
                baseline_features = compute_features_for_channel(bl_signal)
        except Exception:
            pass

    if baseline_features is None:
        baseline_features = await get_baseline_features(req.sensor_id)
        if baseline_features is None:
            bl_signal = np.random.randn(len(region_signal)) * 0.1
            baseline_features = compute_features_for_channel(bl_signal)

    comparison = _classifier.compare_with_baseline(region_features, baseline_features)

    return FaultProbabilityResponse(
        fault_probabilities=comparison["fault_probabilities"],
        feature_deltas=comparison["feature_deltas"],
        overall_deviation=comparison["overall_deviation"],
        region_features=region_features,
        baseline_features=baseline_features,
    )


@router.post("/detect", response_model=AnomalyDetectResponse)
async def detect_anomaly(req: AnomalyDetectRequest):
    feature_vector = np.array([req.features.get(k, 0.0) for k in FEATURE_NAMES]).reshape(1, -1)

    if _detector.is_fitted:
        anomaly = _detector.predict_anomaly(feature_vector)[0]
        score = float(_detector.predict(feature_vector)[0])
        fault_probs = _detector.predict_proba_fault(feature_vector)
    else:
        fault_probs = _classifier.classify(req.features)
        max_fault = max(fault_probs.values())
        anomaly = 1 if fault_probs.get("normal", 1.0) < 0.5 else 0
        score = -max_fault if anomaly else fault_probs.get("normal", 0.5)

    await save_diagnostic_record(
        sensor_id=req.sensor_id,
        timestamp=datetime.utcnow(),
        anomaly_label="anomaly" if anomaly else "normal",
        fault_probabilities={k: v[0] if isinstance(v, list) else v for k, v in fault_probs.items()},
        anomaly_score=float(score),
        feature_snapshot=req.features,
    )

    return AnomalyDetectResponse(
        anomaly_label="anomaly" if anomaly else "normal",
        anomaly_score=float(score),
        fault_probabilities={k: v[0] if isinstance(v, list) else v for k, v in fault_probs.items()},
    )


@router.post("/train", response_model=TrainResponse)
async def train_model(req: TrainRequest):
    start = datetime.fromisoformat(req.start_time)
    end = datetime.fromisoformat(req.end_time)
    features = await get_features_range(req.sensor_id, start, end)
    if not features:
        raise HTTPException(status_code=404, detail="No features found for training")

    X = []
    for f in features:
        row = [f.get(k, 0.0) for k in FEATURE_NAMES]
        X.append(row)
    X = np.array(X)

    _detector.fit(X)

    avg_features = {}
    for k in FEATURE_NAMES:
        vals = [f.get(k, 0.0) for f in features if f.get(k) is not None]
        avg_features[k] = float(np.mean(vals)) if vals else 0.0

    await save_baseline_profile(
        sensor_id=req.sensor_id,
        profile_name=f"baseline_{start.strftime('%Y%m%d')}_{end.strftime('%Y%m%d')}",
        features=avg_features,
    )

    return TrainResponse(
        status="ok",
        message="Model trained and baseline profile saved",
        samples_used=len(X),
    )


@router.post("/waveform")
async def get_waveform(req: FeatureRequest):
    start = datetime.fromisoformat(req.start_time)
    end = datetime.fromisoformat(req.end_time)
    try:
        df = influx_manager.query_signal_raw(req.sensor_id, start, end, req.channel)
        if df.empty:
            raise HTTPException(status_code=404, detail="No signal data found")
        signal = df["_value"].values.tolist()
        times = df["_time"].values.tolist()
        return {"times": times, "values": signal, "channel": req.channel}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Waveform query error: {e}")


_causal_engine = CausalInferenceEngine()


@router.post("/causal-inference", response_model=CausalInferenceResponse)
async def causal_inference(req: CausalInferenceRequest):
    start = datetime.fromisoformat(req.start_time)
    end = datetime.fromisoformat(req.end_time)

    signals = {}
    try:
        for channel in req.channels:
            df = influx_manager.query_signal_raw(req.sensor_id, start, end, channel)
            if not df.empty:
                signal = df["_value"].values.astype(np.float64)
                if len(signal) > 100:
                    signals[channel] = signal
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Signal query error: {e}")

    if len(signals) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 channels with data for causal inference")

    engine = CausalInferenceEngine(
        te_k=req.te_k,
        te_bins=req.te_bins,
        gc_max_lag=req.gc_max_lag,
    )
    result = engine.infer_network(signals, sample_rate=req.sample_rate)
    return result


@router.post("/label-sample", response_model=LabelSampleResponse)
async def label_sample(req: LabelSampleRequest):
    try:
        ts = datetime.fromisoformat(req.timestamp)
        sample_id = await save_labeled_sample(
            sensor_id=req.sensor_id,
            original_diagnostic_id=req.diagnostic_id,
            timestamp=ts,
            features=req.features,
            original_prediction=req.original_prediction,
            corrected_label=req.corrected_label,
            confidence=req.confidence,
            annotator=req.annotator,
            notes=req.notes,
        )
        return LabelSampleResponse(
            status="ok",
            sample_id=sample_id,
            message="Sample labeled successfully",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving label: {e}")


@router.get("/labeled-samples/{sensor_id}", response_model=LabeledSamplesResponse)
async def get_labeled_samples_api(sensor_id: str, include_used: bool = False, limit: int = 100):
    samples = await get_labeled_samples(sensor_id, include_used=include_used, limit=limit)
    return LabeledSamplesResponse(samples=samples, total=len(samples))


@router.post("/incremental-train", response_model=IncrementalTrainResponse)
async def incremental_train(req: IncrementalTrainRequest):
    start_time = time.time()
    log_id = None

    try:
        log_id = await save_training_log(
            sensor_id=req.sensor_id,
            triggered_by=req.triggered_by,
            status="running",
        )

        labeled_samples = await get_labeled_samples(req.sensor_id, include_used=False)
        if not labeled_samples:
            await save_training_log(
                sensor_id=req.sensor_id,
                triggered_by=req.triggered_by,
                status="failed",
                error_message="No new labeled samples for training",
            )
            raise HTTPException(status_code=400, detail="No new labeled samples available for training")

        X_new = []
        for sample in labeled_samples:
            feats = sample["features"]
            row = [feats.get(k, 0.0) for k in FEATURE_NAMES]
            X_new.append(row)
        X_new = np.array(X_new)

        active_version = await get_active_model_version(req.sensor_id)
        parent_version = active_version["version"] if active_version else None

        if not _detector.is_fitted and active_version is None:
            _detector.fit(X_new)
        else:
            _detector.incremental_fit(X_new)

        sample_ids = [s["id"] for s in labeled_samples]
        await mark_samples_used(sample_ids)

        new_version = f"v{int(time.time())}"
        training_samples = _detector._total_samples if hasattr(_detector, '_total_samples') else len(X_new)

        await save_model_version(
            sensor_id=req.sensor_id,
            version=new_version,
            training_samples=training_samples,
            incremental_samples=len(X_new),
            parent_version=parent_version,
        )

        duration = time.time() - start_time
        await save_training_log(
            sensor_id=req.sensor_id,
            triggered_by=req.triggered_by,
            status="success",
            samples_added=len(X_new),
            new_model_version=new_version,
            duration_seconds=duration,
        )

        return IncrementalTrainResponse(
            status="ok",
            message=f"Incremental training completed. Added {len(X_new)} new samples.",
            new_model_version=new_version,
            samples_added=len(X_new),
            duration_seconds=round(duration, 3),
        )

    except HTTPException:
        raise
    except Exception as e:
        duration = time.time() - start_time
        await save_training_log(
            sensor_id=req.sensor_id,
            triggered_by=req.triggered_by,
            status="failed",
            error_message=str(e),
            duration_seconds=duration,
        )
        raise HTTPException(status_code=500, detail=f"Incremental training failed: {e}")


@router.get("/model-history/{sensor_id}", response_model=ModelHistoryResponse)
async def model_history(sensor_id: str):
    active = await get_active_model_version(sensor_id)
    history = await get_model_history(sensor_id)

    active_info = None
    if active:
        active_info = ModelVersionInfo(**active)

    history_info = [ModelVersionInfo(**h) for h in history]

    return ModelHistoryResponse(active_version=active_info, history=history_info)


@router.get("/training-logs/{sensor_id}", response_model=TrainingLogResponse)
async def training_logs(sensor_id: str, limit: int = 50):
    logs = await get_training_logs(sensor_id, limit=limit)
    return TrainingLogResponse(logs=logs)


@router.get("/model-stats/{sensor_id}")
async def model_stats(sensor_id: str):
    active_version = await get_active_model_version(sensor_id)
    labeled_pending = await get_labeled_samples(sensor_id, include_used=False, limit=1000)

    return {
        "active_version": active_version,
        "training_stats": _detector.get_training_stats(),
        "pending_labeled_samples": len(labeled_pending),
    }
