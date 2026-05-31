import os
import asyncio
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import logging
from contextlib import asynccontextmanager

from .services.vad_service import VADService
from .services.srt_service import SRTService
from .services.alignment_service import AlignmentService
from .services.audio_extractor import AudioExtractor
from .services.model_training_service import ModelTrainingService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

task_progress: Dict[str, Dict[str, Any]] = {}
task_progress_lock = asyncio.Lock()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Algorithm service starting up...")
    yield
    logger.info("Algorithm service shutting down...")
    task_progress.clear()

app = FastAPI(
    title="Subtitle Alignment Algorithm Service", 
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AlignmentRequest(BaseModel):
    task_id: str
    video_path: str
    subtitle_path: str
    priority: int = 0
    model_version: Optional[str] = None
    model_params: Dict[str, Any] = {}

class AlignmentResponse(BaseModel):
    task_id: str
    offset: float
    confidence: float
    vad_segments: list
    subtitle_segments: list
    aligned_subtitle_path: str
    metadata: dict

class ProgressResponse(BaseModel):
    task_id: str
    status: str
    progress: float
    message: str
    timestamp: float

class HealthResponse(BaseModel):
    status: str
    version: str
    active_tasks: int

vad_service = VADService()
srt_service = SRTService()
alignment_service = AlignmentService()
audio_extractor = AudioExtractor()
model_training_service = ModelTrainingService()


class TrainingRequest(BaseModel):
    corrections: List[Dict[str, Any]]
    version: str
    name: str


class TrainingResponse(BaseModel):
    success: bool
    version: str
    name: str
    training_sample_count: int
    validation_accuracy: float
    avg_offset_error: float
    model_data: Dict[str, Any]


class ModelInfoResponse(BaseModel):
    version: str
    name: str
    model_type: str
    training_sample_count: int
    validation_accuracy: float
    avg_offset_error: float
    description: str
    trained_at: str

async def update_progress(task_id: str, status: str, progress: float, message: str):
    async with task_progress_lock:
        task_progress[task_id] = {
            "task_id": task_id,
            "status": status,
            "progress": progress,
            "message": message,
            "timestamp": asyncio.get_event_loop().time()
        }
    logger.info(f"[Progress] Task {task_id}: {progress:.0f}% - {message}")

async def clear_progress(task_id: str):
    async with task_progress_lock:
        task_progress.pop(task_id, None)

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="ok", 
        version="1.0.0",
        active_tasks=len(task_progress)
    )

@app.get("/api/v1/task/{task_id}/progress", response_model=ProgressResponse)
async def get_task_progress(task_id: str):
    async with task_progress_lock:
        progress = task_progress.get(task_id)
    
    if progress is None:
        raise HTTPException(
            status_code=404, 
            detail=f"Task {task_id} not found or completed"
        )
    
    return ProgressResponse(**progress)

@app.get("/api/v1/tasks")
async def list_active_tasks():
    async with task_progress_lock:
        tasks = list(task_progress.values())
    
    return {
        "success": True,
        "count": len(tasks),
        "tasks": tasks
    }

@app.post("/api/v1/align", response_model=AlignmentResponse)
async def align_subtitles(request: AlignmentRequest):
    task_id = request.task_id
    
    try:
        logger.info(f"Starting alignment for task {task_id}")
        
        await update_progress(task_id, "processing", 5, "初始化处理...")
        
        if not os.path.exists(request.video_path):
            await update_progress(task_id, "failed", 0, f"Video file not found: {request.video_path}")
            raise HTTPException(status_code=404, detail=f"Video file not found: {request.video_path}")
        
        if not os.path.exists(request.subtitle_path):
            await update_progress(task_id, "failed", 0, f"Subtitle file not found: {request.subtitle_path}")
            raise HTTPException(status_code=404, detail=f"Subtitle file not found: {request.subtitle_path}")
        
        with tempfile.TemporaryDirectory() as temp_dir:
            await update_progress(task_id, "processing", 10, "提取音频...")
            
            audio_path = os.path.join(temp_dir, "audio.wav")
            try:
                audio_extractor.extract_audio(request.video_path, audio_path)
            except Exception as e:
                await update_progress(task_id, "failed", 0, f"音频提取失败: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Audio extraction failed: {str(e)}")
            
            if not os.path.exists(audio_path):
                await update_progress(task_id, "failed", 0, "音频文件未创建")
                raise HTTPException(status_code=500, detail="Failed to extract audio")
            
            await update_progress(task_id, "processing", 30, "语音活动检测...")
            
            try:
                vad_segments = vad_service.detect_voice_activity(audio_path)
            except Exception as e:
                await update_progress(task_id, "failed", 30, f"VAD检测失败: {str(e)}")
                raise HTTPException(status_code=500, detail=f"VAD detection failed: {str(e)}")
            
            logger.info(f"Found {len(vad_segments)} voice segments")
            await update_progress(task_id, "processing", 50, f"检测到 {len(vad_segments)} 个语音段")
            
            if len(vad_segments) == 0:
                await update_progress(task_id, "failed", 50, "未检测到语音活动")
                raise HTTPException(status_code=400, detail="No voice activity detected in audio")
            
            await update_progress(task_id, "processing", 60, "解析字幕文件...")
            
            try:
                subtitle_segments = srt_service.parse_srt(request.subtitle_path)
            except Exception as e:
                await update_progress(task_id, "failed", 60, f"字幕解析失败: {str(e)}")
                raise HTTPException(status_code=500, detail=f"SRT parsing failed: {str(e)}")
            
            logger.info(f"Found {len(subtitle_segments)} subtitle segments")
            await update_progress(task_id, "processing", 70, f"解析到 {len(subtitle_segments)} 条字幕")
            
            if len(subtitle_segments) == 0:
                await update_progress(task_id, "failed", 70, "字幕文件为空")
                raise HTTPException(status_code=400, detail="No subtitle segments found")
            
            await update_progress(task_id, "processing", 80, "计算字幕偏移量...")
            
            try:
                offset, confidence = alignment_service.calculate_offset(
                    vad_segments,
                    subtitle_segments
                )

                if request.model_version and request.model_version != 'v1.0.0':
                    model_adjusted_offset = model_training_service.apply_model_to_alignment(
                        request.model_version,
                        vad_segments,
                        subtitle_segments,
                        offset
                    )
                    if abs(model_adjusted_offset - offset) < 10:
                        offset = model_adjusted_offset
                        logger.info(f"Applied model {request.model_version} adjustment")
            except Exception as e:
                await update_progress(task_id, "failed", 80, f"偏移量计算失败: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Offset calculation failed: {str(e)}")
            
            logger.info(f"Calculated offset: {offset:.3f}s, confidence: {confidence:.2f}")
            await update_progress(task_id, "processing", 90, f"偏移量: {offset:.3f}s, 置信度: {confidence:.1%}")
            
            if confidence < 0.3:
                logger.warning(f"Low confidence for task {task_id}: {confidence:.3f}")
            
            await update_progress(task_id, "processing", 95, "生成校准字幕...")
            
            try:
                aligned_subtitle_path = request.subtitle_path.replace('.srt', f'_aligned_{task_id}.srt')
                aligned_subs = alignment_service.apply_offset(subtitle_segments, offset)
                srt_service.write_srt(aligned_subs, aligned_subtitle_path)
            except Exception as e:
                await update_progress(task_id, "failed", 95, f"字幕生成失败: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Aligned SRT generation failed: {str(e)}")
            
            try:
                alignment_report = alignment_service.get_alignment_report(
                    vad_segments,
                    subtitle_segments,
                    offset
                )
            except Exception as e:
                logger.warning(f"Failed to generate alignment report: {str(e)}")
                alignment_report = {}
            
            try:
                vad_stats = vad_service.get_segment_statistics(vad_segments)
            except Exception as e:
                logger.warning(f"Failed to generate VAD statistics: {str(e)}")
                vad_stats = {}
            
            try:
                alternative_offsets = alignment_service.get_alternative_offsets(
                    vad_segments,
                    subtitle_segments,
                    offset
                )
            except Exception as e:
                logger.warning(f"Failed to generate alternative offsets: {str(e)}")
                alternative_offsets = []
            
            await update_progress(task_id, "completed", 100, "字幕校准完成")
            await asyncio.sleep(0.5)
            await clear_progress(task_id)
            
            return AlignmentResponse(
                task_id=task_id,
                offset=offset,
                confidence=confidence,
                vad_segments=vad_segments,
                subtitle_segments=aligned_subs,
                aligned_subtitle_path=aligned_subtitle_path,
                metadata={
                    "vad_segment_count": len(vad_segments),
                    "subtitle_segment_count": len(subtitle_segments),
                    "alignment_report": alignment_report,
                    "vad_statistics": vad_stats,
                    "alternative_offsets": alternative_offsets,
                    "audio_path": audio_path
                }
            )
            
    except HTTPException:
        await clear_progress(task_id)
        raise
    except Exception as e:
        logger.error(f"Alignment failed for task {task_id}: {str(e)}", exc_info=True)
        await update_progress(task_id, "failed", 0, str(e))
        await clear_progress(task_id)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/vad")
async def detect_voice_activity(video_path: str):
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            audio_path = os.path.join(temp_dir, "audio.wav")
            audio_extractor.extract_audio(video_path, audio_path)
            vad_segments = vad_service.detect_voice_activity(audio_path)
            
            return {
                "success": True,
                "vad_segments": vad_segments,
                "count": len(vad_segments),
                "statistics": vad_service.get_segment_statistics(vad_segments)
            }
    except Exception as e:
        logger.error(f"VAD detection failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/parse-srt")
async def parse_srt_file(subtitle_path: str):
    try:
        segments = srt_service.parse_srt(subtitle_path)
        return {
            "success": True,
            "segments": segments,
            "count": len(segments)
        }
    except Exception as e:
        logger.error(f"SRT parsing failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/validate-alignment")
async def validate_alignment(
    task_id: str,
    vad_segments: list,
    subtitle_segments: list,
    offset: float
):
    try:
        report = alignment_service.get_alignment_report(
            vad_segments,
            subtitle_segments,
            offset
        )
        
        alternatives = alignment_service.get_alternative_offsets(
            vad_segments,
            subtitle_segments,
            offset
        )
        
        return {
            "success": True,
            "task_id": task_id,
            "alignment_report": report,
            "alternative_offsets": alternatives
        }
    except Exception as e:
        logger.error(f"Validation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/train", response_model=TrainingResponse)
async def train_model(request: TrainingRequest, background_tasks: BackgroundTasks):
    try:
        if len(request.corrections) < 50:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient training samples: {len(request.corrections)}. Minimum required: 50"
            )

        trained_model = model_training_service.train_model(
            corrections_data=request.corrections,
            version=request.version,
            name=request.name
        )

        return TrainingResponse(
            success=True,
            version=trained_model.version,
            name=trained_model.name,
            training_sample_count=trained_model.training_sample_count,
            validation_accuracy=trained_model.validation_metrics.get('test_accuracy', 0),
            avg_offset_error=trained_model.validation_metrics.get('test_avg_error', 0),
            model_data={
                'feature_weights': trained_model.feature_weights,
                'bias_terms': trained_model.bias_terms,
                'threshold_adjustments': trained_model.threshold_adjustments,
                'description': trained_model.description
            }
        )
    except ValueError as e:
        logger.error(f"Training failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Training failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/models")
async def list_models():
    try:
        models = model_training_service.list_models()
        return {
            "success": True,
            "count": len(models),
            "models": models
        }
    except Exception as e:
        logger.error(f"Failed to list models: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/models/{version}", response_model=ModelInfoResponse)
async def get_model(version: str):
    try:
        model_data = model_training_service.load_model(version)
        if not model_data:
            raise HTTPException(status_code=404, detail=f"Model {version} not found")

        validation_metrics = model_data.get('validation_metrics', {})
        return ModelInfoResponse(
            version=model_data.get('version', version),
            name=model_data.get('name', 'Unknown'),
            model_type=model_data.get('model_type', 'unknown'),
            training_sample_count=model_data.get('training_sample_count', 0),
            validation_accuracy=validation_metrics.get('test_accuracy', 0),
            avg_offset_error=validation_metrics.get('test_avg_error', 0),
            description=model_data.get('description', ''),
            trained_at=str(model_data.get('trained_at', ''))
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get model {version}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/models/{version}/predict")
async def predict_with_model(
    version: str,
    vad_segments: List[Dict[str, float]],
    subtitle_segments: List[Dict[str, Any]],
    base_offset: float
):
    try:
        adjusted_offset = model_training_service.apply_model_to_alignment(
            version,
            vad_segments,
            subtitle_segments,
            base_offset
        )
        return {
            "success": True,
            "version": version,
            "base_offset": base_offset,
            "adjusted_offset": adjusted_offset,
            "adjustment": adjusted_offset - base_offset
        }
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/evaluate")
async def evaluate_alignment(
    vad_segments: List[Dict[str, float]],
    subtitle_segments: List[Dict[str, Any]],
    offset: float
):
    try:
        report = alignment_service.get_alignment_report(
            vad_segments,
            subtitle_segments,
            offset
        )

        before_offsets = []
        after_offsets = []

        for sub in subtitle_segments:
            sub_start = sub.get('start', 0)
            sub_end = sub.get('end', sub_start + 1)

            best_vad_overlap = 0
            best_vad_start = sub_start

            for vad in vad_segments:
                vad_start = vad.get('start', 0)
                vad_end = vad.get('end', 0)
                overlap = max(0, min(sub_end, vad_end) - max(sub_start, vad_start))
                if overlap > best_vad_overlap:
                    best_vad_overlap = overlap
                    best_vad_start = vad_start

            before_offsets.append(best_vad_start - sub_start)
            after_offsets.append(best_vad_start - (sub_start + offset))

        before_errors = np.abs(before_offsets)
        after_errors = np.abs(after_offsets)

        return {
            "success": True,
            "alignment_report": report,
            "metrics": {
                "avg_offset_before": float(np.mean(before_errors)),
                "avg_offset_after": float(np.mean(after_errors)),
                "median_offset_before": float(np.median(before_errors)),
                "median_offset_after": float(np.median(after_errors)),
                "error_within_100ms_before": float(np.mean(before_errors < 0.1)),
                "error_within_100ms_after": float(np.mean(after_errors < 0.1)),
                "error_within_500ms_before": float(np.mean(before_errors < 0.5)),
                "error_within_500ms_after": float(np.mean(after_errors < 0.5)),
                "improvement_percent": float(
                    (np.mean(before_errors) - np.mean(after_errors)) / max(np.mean(before_errors), 0.001) * 100
                )
            },
            "scatter_data": {
                "subtitle_indices": [s.get('index', i) for i, s in enumerate(subtitle_segments)],
                "offsets_before": before_offsets,
                "offsets_after": after_offsets
            }
        }
    except Exception as e:
        logger.error(f"Evaluation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
