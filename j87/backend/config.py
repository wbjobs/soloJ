import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:7b"
    EMBEDDING_MODEL: str = "BAAI/bge-m3"
    VECTORSTORE_PATH: str = "./vectorstore"
    UPLOAD_PATH: str = "./uploads"
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50
    RETRIEVE_TOP_K: int = 4

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
