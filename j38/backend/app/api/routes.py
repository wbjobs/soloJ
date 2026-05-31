import uuid
import logging
import numpy as np
from typing import Optional
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form
from fastapi.responses import JSONResponse
from datetime import datetime

from ..models import (
    MultimodalRequest, MultimodalResponse,
    VisualFeatures, AudioFeatures, TextFeatures,
    UserRecord, FederatedUpdateRequest,
    DepressionSeverity, PredictionRequest,
    InterventionConfig
)
from ..database import MongoDB, RedisCache
from ..modules import (
    VisualAnalyzer, AudioAnalyzer, TextAnalyzer,
    MultimodalFusion, ExplainabilityEngine,
    FederatedLearningClient
)
from ..modules.trend_prediction import TrendPredictor
from ..modules.intervention import InterventionEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Multimodal Depression Screening"])

visual_analyzer = VisualAnalyzer()
audio_analyzer = AudioAnalyzer()
text_analyzer = TextAnalyzer()
multimodal_fusion = MultimodalFusion()
explainability_engine = ExplainabilityEngine()
federated_client = FederatedLearningClient()
mongodb = MongoDB()
redis_cache = RedisCache()
trend_predictor = TrendPredictor(mongodb)
intervention_engine = InterventionEngine(mongodb, trend_predictor)


@router.get("/health", summary="健康检查")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }


@router.post("/analyze/visual", response_model=VisualFeatures, summary="分析视觉特征")
async def analyze_visual(
    session_id: str = Form(...),
    video_file: Optional[UploadFile] = File(None),
    video_data: Optional[str] = Form(None)
):
    try:
        if video_file:
            contents = await video_file.read()
            import base64
            video_data = base64.b64encode(contents).decode("utf-8")
            video_data = f"data:video/webm;base64,{video_data}"

        if not video_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No video data provided"
            )

        features = visual_analyzer.analyze(video_data)
        redis_cache.set_model_features(session_id, "visual", features.model_dump())

        return features

    except Exception as e:
        logger.error(f"Visual analysis error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Visual analysis failed: {str(e)}"
        )


@router.post("/analyze/audio", response_model=AudioFeatures, summary="分析语音特征")
async def analyze_audio(
    session_id: str = Form(...),
    audio_file: Optional[UploadFile] = File(None),
    audio_data: Optional[str] = Form(None)
):
    try:
        if audio_file:
            contents = await audio_file.read()
            import base64
            audio_data = base64.b64encode(contents).decode("utf-8")
            audio_data = f"data:audio/webm;base64,{audio_data}"

        if not audio_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No audio data provided"
            )

        features = audio_analyzer.analyze(audio_data)
        redis_cache.set_model_features(session_id, "audio", features.model_dump())

        return features

    except Exception as e:
        logger.error(f"Audio analysis error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Audio analysis failed: {str(e)}"
        )


@router.post("/analyze/text", response_model=TextFeatures, summary="分析文本特征")
async def analyze_text(
    session_id: str = Form(...),
    text_data: str = Form(...)
):
    try:
        if not text_data or len(text_data.strip()) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Text data is too short (minimum 10 characters)"
            )

        features = text_analyzer.analyze(text_data)
        redis_cache.set_model_features(session_id, "text", features.model_dump())

        return features

    except Exception as e:
        logger.error(f"Text analysis error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Text analysis failed: {str(e)}"
        )


@router.post("/fuse", summary="多模态融合分析")
async def fuse_modalities(session_id: str):
    try:
        session_data = redis_cache.get_session_data(session_id)
        if not session_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No session data found. Please analyze modalities first."
            )

        visual_features = None
        audio_features = None
        text_features = None

        if "visual" in session_data:
            visual_features = VisualFeatures(**session_data["visual"])
        if "audio" in session_data:
            audio_features = AudioFeatures(**session_data["audio"])
        if "text" in session_data:
            text_features = TextFeatures(**session_data["text"])

        if not any([visual_features, audio_features, text_features]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one modality must be analyzed"
            )

        fusion_result = multimodal_fusion.fuse(visual_features, audio_features, text_features)
        redis_cache.cache_fusion_result(session_id, fusion_result.model_dump())

        return fusion_result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fusion error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Multimodal fusion failed: {str(e)}"
        )


@router.post("/explain", summary="获取可解释性分析")
async def get_explainability(session_id: str):
    try:
        session_data = redis_cache.get_session_data(session_id)
        fusion_data = redis_cache.get_cached_fusion_result(session_id)

        if not fusion_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No fusion result found. Please run fusion first."
            )

        visual_features = None
        audio_features = None
        text_features = None

        if "visual" in session_data:
            visual_features = VisualFeatures(**session_data["visual"])
        if "audio" in session_data:
            audio_features = AudioFeatures(**session_data["audio"])
        if "text" in session_data:
            text_features = TextFeatures(**session_data["text"])

        from ..models import FusionResult
        fusion_result = FusionResult(**fusion_data)

        explainability = explainability_engine.explain(
            visual_features, audio_features, text_features, fusion_result
        )

        return explainability

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Explainability error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Explainability analysis failed: {str(e)}"
        )


@router.post("/analyze", response_model=MultimodalResponse, summary="完整多模态分析")
async def full_analysis(request: MultimodalRequest):
    try:
        request_id = str(uuid.uuid4())
        visual_features = None
        audio_features = None
        text_features = None

        if request.video_data:
            visual_features = visual_analyzer.analyze(request.video_data)
            redis_cache.set_model_features(request.session_id, "visual", visual_features.model_dump())

        if request.audio_data:
            audio_features = audio_analyzer.analyze(request.audio_data)
            redis_cache.set_model_features(request.session_id, "audio", audio_features.model_dump())

        if request.text_data:
            text_features = text_analyzer.analyze(request.text_data)
            redis_cache.set_model_features(request.session_id, "text", text_features.model_dump())

        if not any([visual_features, audio_features, text_features]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one modality data must be provided"
            )

        fusion_result = multimodal_fusion.fuse(visual_features, audio_features, text_features)
        redis_cache.cache_fusion_result(request.session_id, fusion_result.model_dump())

        explainability = None
        if hasattr(request.additional_metadata, "get"):
            if request.additional_metadata.get("include_explainability", True):
                explainability = explainability_engine.explain(
                    visual_features, audio_features, text_features, fusion_result
                )

        user_id = request.user_id or f"user_{uuid.uuid4().hex[:8]}"
        user_record = UserRecord(
            user_id=user_id,
            session_id=request.session_id,
            visual_features=visual_features,
            audio_features=audio_features,
            text_features=text_features,
            typing_features=request.typing_features,
            fusion_result=fusion_result
        )
        mongodb.insert_user_record(user_record.model_dump())

        response = MultimodalResponse(
            session_id=request.session_id,
            request_id=request_id,
            visual_features=visual_features,
            audio_features=audio_features,
            text_features=text_features,
            fusion_result=fusion_result,
            explainability=explainability,
            status="completed",
            message="Analysis completed successfully"
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Full analysis error: {e}")
        return MultimodalResponse(
            session_id=request.session_id,
            request_id=str(uuid.uuid4()),
            status="error",
            message=f"Analysis failed: {str(e)}"
        )


@router.get("/records/{user_id}", summary="获取用户历史记录")
async def get_user_records(user_id: str, limit: int = 10):
    try:
        records = mongodb.get_user_records(user_id, limit)
        return {
            "user_id": user_id,
            "count": len(records),
            "records": records
        }
    except Exception as e:
        logger.error(f"Get records error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user records: {str(e)}"
        )


@router.get("/session/{session_id}", summary="获取会话记录")
async def get_session_record(session_id: str):
    try:
        record = mongodb.get_session_record(session_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        return record
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get session error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get session record: {str(e)}"
        )


@router.post("/federated/train", summary="本地联邦学习训练")
async def federated_train():
    try:
        result = federated_client.train_local()
        return result
    except Exception as e:
        logger.error(f"Federated training error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Federated training failed: {str(e)}"
        )


@router.post("/federated/update", summary="上传联邦学习更新")
async def federated_update(update: FederatedUpdateRequest):
    try:
        result = mongodb.save_federated_update(update.model_dump())
        success = federated_client.update_global_weights(update.model_weights)
        return {
            "status": "success" if success else "partial",
            "update_id": result,
            "message": "Update received successfully"
        }
    except Exception as e:
        logger.error(f"Federated update error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Federated update failed: {str(e)}"
        )


@router.get("/federated/weights", summary="获取当前模型权重")
async def get_model_weights():
    try:
        weights = federated_client.get_model_weights_dict()
        return {
            "client_id": federated_client.client_id,
            "round_num": federated_client.round_num,
            "weights": weights
        }
    except Exception as e:
        logger.error(f"Get weights error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get model weights: {str(e)}"
        )


@router.get("/federated/stats", summary="获取联邦学习训练统计")
async def get_federated_stats():
    try:
        stats = federated_client.get_training_stats()
        return stats
    except Exception as e:
        logger.error(f"Get federated stats error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get training stats: {str(e)}"
        )


@router.post("/federated/aggregate", summary="安全聚合多个客户端梯度")
async def aggregate_gradients(request: dict):
    try:
        client_gradients_raw = request.get("client_gradients", [])
        client_weights = request.get("client_weights", None)

        if not client_gradients_raw:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No client gradients provided"
            )

        client_gradients = []
        for grad_dict in client_gradients_raw:
            converted = {
                key: np.array(value)
                for key, value in grad_dict.items()
            }
            client_gradients.append(converted)

        aggregated = federated_client._aggregate_gradients_safely(
            client_gradients, client_weights
        )

        aggregated_serializable = {
            key: value.tolist()
            for key, value in aggregated.items()
        }

        success = federated_client.update_global_weights(aggregated_serializable)

        return {
            "status": "success" if success else "partial",
            "aggregated_weights": aggregated_serializable,
            "client_count": len(client_gradients),
            "message": "Gradient aggregation completed successfully"
        }
    except Exception as e:
        logger.error(f"Gradient aggregation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gradient aggregation failed: {str(e)}"
        )


@router.delete("/session/{session_id}", summary="清除会话数据")
async def clear_session(session_id: str):
    try:
        redis_cache.clear_session(session_id)
        return {
            "status": "success",
            "message": f"Session {session_id} cleared from cache"
        }
    except Exception as e:
        logger.error(f"Clear session error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear session: {str(e)}"
        )


@router.get("/statistics", summary="获取系统统计信息")
async def get_statistics():
    try:
        db = mongodb.get_db()
        total_records = db.user_records.count_documents({})
        records_severe = db.user_records.count_documents({
            "fusion_result.severity": DepressionSeverity.SEVERE
        })
        records_moderate = db.user_records.count_documents({
            "fusion_result.severity": DepressionSeverity.MODERATE
        })
        records_mild = db.user_records.count_documents({
            "fusion_result.severity": DepressionSeverity.MILD
        })
        records_none = db.user_records.count_documents({
            "fusion_result.severity": DepressionSeverity.NONE
        })

        avg_score = 0.0
        pipeline = [
            {"$group": {"_id": None, "avg_score": {"$avg": "$fusion_result.depression_score"}}}
        ]
        result = list(db.user_records.aggregate(pipeline))
        if result:
            avg_score = result[0]["avg_score"]

        return {
            "total_records": total_records,
            "severity_distribution": {
                "none": records_none,
                "mild": records_mild,
                "moderate": records_moderate,
                "severe": records_severe
            },
            "average_depression_score": round(avg_score, 2),
            "federated_round": federated_client.round_num,
            "client_id": federated_client.client_id
        }
    except Exception as e:
        logger.error(f"Get statistics error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get statistics: {str(e)}"
        )


@router.get("/trend/history/{user_id}", summary="获取用户历史轨迹")
async def get_user_history_trajectory(user_id: str, limit: int = 50):
    try:
        trajectory = trend_predictor.build_history_trajectory(user_id)
        return trajectory.model_dump()
    except Exception as e:
        logger.error(f"Get history trajectory error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get history trajectory: {str(e)}"
        )


@router.post("/trend/predict", summary="预测病情发展趋势")
async def predict_trend(request: PredictionRequest):
    try:
        result = trend_predictor.predict_trend(
            user_id=request.user_id,
            prediction_horizon=request.prediction_horizon
        )
        return result.model_dump()
    except Exception as e:
        logger.error(f"Trend prediction error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Trend prediction failed: {str(e)}"
        )


@router.get("/trend/crisis/{user_id}", summary="检测用户危机水平")
async def detect_crisis(user_id: str, threshold: float = 85.0, consecutive_count: int = 2):
    try:
        result = trend_predictor.detect_sustained_rise(
            user_id=user_id,
            threshold=threshold,
            consecutive_count=consecutive_count
        )
        return result
    except Exception as e:
        logger.error(f"Crisis detection error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Crisis detection failed: {str(e)}"
        )


@router.post("/intervention/generate", summary="生成干预报告")
async def generate_intervention_report(
    user_id: str = Form(...),
    session_id: Optional[str] = Form(None)
):
    try:
        report = intervention_engine.generate_intervention_report(
            user_id=user_id,
            session_id=session_id
        )
        return report.model_dump()
    except Exception as e:
        logger.error(f"Generate intervention report error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate intervention report: {str(e)}"
        )


@router.post("/intervention/check", summary="检查并触发干预")
async def check_and_trigger_intervention(
    user_id: str = Form(...),
    session_id: Optional[str] = Form(None),
    force_generate: bool = Form(False)
):
    try:
        result = intervention_engine.check_and_trigger_intervention(
            user_id=user_id,
            session_id=session_id,
            force_generate=force_generate
        )
        
        if result.get("report"):
            result["report"] = result["report"].model_dump()
            
        return result
    except Exception as e:
        logger.error(f"Intervention check error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Intervention check failed: {str(e)}"
        )


@router.get("/intervention/hotlines", summary="获取心理援助热线列表")
async def get_hotlines(crisis_only: bool = False):
    try:
        hotlines = intervention_engine.get_all_hotlines(include_crisis_only=crisis_only)
        return {
            "hotlines": [h.model_dump() for h in hotlines],
            "count": len(hotlines)
        }
    except Exception as e:
        logger.error(f"Get hotlines error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get hotlines: {str(e)}"
        )


@router.get("/intervention/reports/{user_id}", summary="获取用户干预报告历史")
async def get_user_intervention_reports(user_id: str, limit: int = 10):
    try:
        reports = intervention_engine.get_user_intervention_reports(user_id, limit)
        return {
            "user_id": user_id,
            "reports": reports,
            "count": len(reports)
        }
    except Exception as e:
        logger.error(f"Get intervention reports error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get intervention reports: {str(e)}"
        )


@router.get("/intervention/config", summary="获取干预配置")
async def get_intervention_config():
    try:
        return intervention_engine.get_config()
    except Exception as e:
        logger.error(f"Get intervention config error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get intervention config: {str(e)}"
        )


@router.post("/intervention/config", summary="更新干预配置")
async def update_intervention_config(config: InterventionConfig):
    try:
        intervention_engine.update_config(config)
        return {
            "status": "success",
            "message": "Intervention config updated",
            "config": intervention_engine.get_config()
        }
    except Exception as e:
        logger.error(f"Update intervention config error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update intervention config: {str(e)}"
        )


@router.get("/notifications/{user_id}", summary="获取用户通知")
async def get_user_notifications(user_id: str, limit: int = 20):
    try:
        notifications = mongodb.get_user_notifications(user_id, limit)
        for notif in notifications:
            notif["_id"] = str(notif["_id"])
        return {
            "user_id": user_id,
            "notifications": notifications,
            "count": len(notifications)
        }
    except Exception as e:
        logger.error(f"Get notifications error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get notifications: {str(e)}"
        )


@router.post("/notifications/{notification_id}/read", summary="标记通知已读")
async def mark_notification_read(notification_id: str):
    try:
        success = mongodb.mark_notification_read(notification_id)
        return {
            "status": "success" if success else "not_found",
            "notification_id": notification_id
        }
    except Exception as e:
        logger.error(f"Mark notification read error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark notification read: {str(e)}"
        )
