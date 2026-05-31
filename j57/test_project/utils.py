"""工具函数模块"""

import os
import json
import hashlib
from typing import Any, Optional

# 已声明的第三方库
import numpy as np
import pandas as pd

# 已声明的数据库相关库
import sqlalchemy
from sqlalchemy import create_engine, Column, String, Integer
from sqlalchemy.ext.declarative import declarative_base

# 未声明的依赖
import redis


def helper_function(data: Any) -> str:
    """辅助函数"""
    if isinstance(data, dict):
        return json.dumps(data, indent=2)
    return str(data)


def calculate_hash(content: str) -> str:
    """计算内容的哈希值 (使用标准库 hashlib)"""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


def process_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """处理 DataFrame (使用 pandas)"""
    df['processed'] = df.apply(lambda x: x.sum(), axis=1)
    return df


def get_redis_client() -> Optional[redis.Redis]:
    """获取 Redis 客户端 (未声明依赖)"""
    try:
        return redis.Redis(host='localhost', port=6379, db=0)
    except Exception:
        return None


# 标准库使用示例
Base = declarative_base()


class User(Base):
    """用户模型 (使用 SQLAlchemy)"""
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
