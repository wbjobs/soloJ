import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from contextlib import asynccontextmanager

from app.config import settings
from app.api import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Multimodal Depression Screening System...")

    try:
        from app.database import MongoDB, RedisCache
        mongodb = MongoDB()
        redis_cache = RedisCache()
        logger.info("Database connections initialized")
    except Exception as e:
        logger.warning(f"Database initialization failed (continuing without DB): {e}")

    try:
        from app.modules import (
            VisualAnalyzer, AudioAnalyzer, TextAnalyzer,
            MultimodalFusion, ExplainabilityEngine
        )
        app.state.visual_analyzer = VisualAnalyzer()
        app.state.audio_analyzer = AudioAnalyzer()
        app.state.text_analyzer = TextAnalyzer()
        app.state.multimodal_fusion = MultimodalFusion()
        app.state.explainability_engine = ExplainabilityEngine()
        logger.info("AI models initialized")
    except Exception as e:
        logger.warning(f"Model initialization failed: {e}")

    yield

    logger.info("Shutting down system...")
    logger.info("System shutdown complete")


app = FastAPI(
    title="多模态抑郁倾向筛查系统 API",
    description="基于视觉、语音、文本三模态融合的抑郁倾向分析系统（仅供研究使用）",
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

app.include_router(router)


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def root():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>多模态抑郁倾向筛查系统</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 40px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
            }
            .container {
                background: white;
                border-radius: 20px;
                padding: 40px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            h1 {
                color: #333;
                margin-bottom: 10px;
            }
            .subtitle {
                color: #666;
                margin-bottom: 30px;
            }
            .warning {
                background: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 15px;
                margin-bottom: 30px;
                border-radius: 8px;
            }
            .features {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin-bottom: 30px;
            }
            .feature-card {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 12px;
                border-left: 4px solid #667eea;
            }
            .feature-card h3 {
                margin: 0 0 10px 0;
                color: #333;
            }
            .feature-card p {
                margin: 0;
                color: #666;
                font-size: 14px;
            }
            .btn {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 30px;
                border-radius: 30px;
                text-decoration: none;
                font-weight: 600;
                margin-right: 15px;
                transition: transform 0.2s;
            }
            .btn:hover {
                transform: translateY(-2px);
            }
            .tech-stack {
                background: #f1f3f5;
                padding: 20px;
                border-radius: 12px;
                margin-top: 30px;
            }
            .tech-stack h4 {
                margin-top: 0;
                color: #333;
            }
            .tech-tags {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            .tag {
                background: white;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 13px;
                color: #667eea;
                font-weight: 500;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🧠 多模态抑郁倾向筛查系统</h1>
            <p class="subtitle">Multimodal Depression Screening System v1.0</p>

            <div class="warning">
                <strong>⚠️ 免责声明：</strong>本系统仅供学术研究使用，不构成任何医疗建议。
                如有抑郁相关症状，请及时咨询专业医疗机构。
            </div>

            <div class="features">
                <div class="feature-card">
                    <h3>👁️ 视觉模态</h3>
                    <p>面部动作单元、眼神回避、微笑频率分析</p>
                </div>
                <div class="feature-card">
                    <h3>🎤 语音模态</h3>
                    <p>语速、基频范围、停顿模式分析</p>
                </div>
                <div class="feature-card">
                    <h3>📝 文本模态</h3>
                    <p>用词倾向、情感分析、第一人称频率</p>
                </div>
                <div class="feature-card">
                    <h3>🔗 多模态融合</h3>
                    <p>多头注意力机制，输出抑郁倾向评分</p>
                </div>
            </div>

            <a href="/docs" class="btn">📚 API 文档</a>
            <a href="/redoc" class="btn" style="background: #495057;">🔍 ReDoc</a>

            <div class="tech-stack">
                <h4>🛠️ 技术栈</h4>
                <div class="tech-tags">
                    <span class="tag">FastAPI</span>
                    <span class="tag">PyTorch</span>
                    <span class="tag">OpenFace</span>
                    <span class="tag">Wav2Vec 2.0</span>
                    <span class="tag">BERT</span>
                    <span class="tag">MongoDB</span>
                    <span class="tag">Redis</span>
                    <span class="tag">Flower (FL)</span>
                    <span class="tag">SHAP</span>
                </div>
            </div>
        </div>
    </body>
    </html>
    """


@app.get("/health", summary="系统健康检查")
async def health_check():
    return {
        "status": "healthy",
        "service": "Multimodal Depression Screening System",
        "version": "1.0.0",
        "mode": "research"
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True,
        log_level="info"
    )
