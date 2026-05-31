"""配置模块"""

import os
from dataclasses import dataclass
from typing import Optional

# 已声明的依赖
from dotenv import load_dotenv
import jwt
from cryptography.fernet import Fernet

# 标准库
from pathlib import Path
import logging

load_dotenv()


@dataclass
class Settings:
    """应用配置"""
    APP_NAME: str = os.getenv('APP_NAME', 'demo-app')
    DEBUG: bool = os.getenv('DEBUG', 'False').lower() == 'true'
    SECRET_KEY: str = os.getenv('SECRET_KEY', 'default-secret-key-change-me')
    DATABASE_URL: str = os.getenv('DATABASE_URL', 'sqlite:///app.db')
    REDIS_URL: str = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    JWT_ALGORITHM: str = os.getenv('JWT_ALGORITHM', 'HS256')
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')

    @property
    def log_level(self) -> int:
        """获取日志级别"""
        return getattr(logging, self.LOG_LEVEL.upper(), logging.INFO)


settings = Settings()


def encrypt_data(data: str, key: bytes) -> bytes:
    """使用 cryptography 加密数据"""
    fernet = Fernet(key)
    return fernet.encrypt(data.encode())


def decrypt_data(token: bytes, key: bytes) -> str:
    """使用 cryptography 解密数据"""
    fernet = Fernet(key)
    return fernet.decrypt(token).decode()
