"""Configuration settings for the Quantum Simulator API."""

import os
from typing import Optional


class Settings:
    """Application settings."""
    
    APP_NAME: str = "Quantum Circuit Simulator API"
    API_V1_PREFIX: str = "/api/v1"
    
    MAX_QUBITS: int = 25
    DEFAULT_SHOTS: int = 1024
    MAX_SHOTS: int = 100000
    
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", 6379))
    REDIS_DB: int = int(os.getenv("REDIS_DB", 0))
    CACHE_TTL: int = int(os.getenv("CACHE_TTL", 300))
    
    CELERY_BROKER_URL: str = os.getenv(
        "CELERY_BROKER_URL",
        f"redis://{REDIS_HOST}:{REDIS_PORT}/0"
    )
    CELERY_RESULT_BACKEND: str = os.getenv(
        "CELERY_RESULT_BACKEND",
        f"redis://{REDIS_HOST}:{REDIS_PORT}/0"
    )
    
    GPU_ENABLED: bool = os.getenv("GPU_ENABLED", "True").lower() == "true"


settings = Settings()
