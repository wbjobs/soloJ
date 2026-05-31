from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://admin:admin123@localhost:27017/mds_db"
    REDIS_URL: str = "redis://:redis123@localhost:6379/0"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    MODEL_CACHE_DIR: str = "./models"
    MAX_UPLOAD_SIZE: str = "50MB"
    SESSION_TIMEOUT: int = 3600
    VISUAL_MODEL_PATH: Optional[str] = None
    AUDIO_MODEL_PATH: Optional[str] = None
    TEXT_MODEL_PATH: Optional[str] = None
    FUSION_MODEL_PATH: Optional[str] = None
    ENABLE_FEDERATED_LEARNING: bool = True
    FLOWER_SERVER_ADDRESS: str = "localhost:8080"
    ENABLE_EXPLAINABILITY: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
