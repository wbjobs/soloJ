from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ConnectionFailure
import redis
import json
import pickle
from typing import Optional, Any, Dict, List
from datetime import datetime, timedelta
import logging
import os

logger = logging.getLogger(__name__)


class MongoDB:
    _instance: Optional['MongoDB'] = None
    _client: Optional[MongoClient] = None
    _db = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, mongodb_url: Optional[str] = None):
        if self._client is None:
            self._connect(mongodb_url)
            self._create_indexes()

    def _connect(self, mongodb_url: Optional[str] = None):
        url = mongodb_url or os.environ.get(
            "MONGODB_URL",
            "mongodb://admin:admin123@localhost:27017/mds_db"
        )
        try:
            self._client = MongoClient(url)
            self._client.admin.command('ping')
            self._db = self._client.get_default_database()
            logger.info("MongoDB connected successfully")
        except ConnectionFailure as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise

    def _create_indexes(self):
        if self._db is None:
            return

        self._db.user_records.create_index([
            ("user_id", ASCENDING),
            ("created_at", DESCENDING)
        ])
        self._db.user_records.create_index("session_id", unique=True)
        self._db.user_records.create_index("created_at", expireAfterSeconds=31536000)

        self._db.federated_updates.create_index([
            ("client_id", ASCENDING),
            ("round_num", ASCENDING)
        ])

        self._db.model_versions.create_index("version", unique=True)

        self._db.intervention_reports.create_index([
            ("user_id", ASCENDING),
            ("generated_at", DESCENDING)
        ])
        self._db.intervention_reports.create_index("report_id", unique=True)
        self._db.intervention_reports.create_index("crisis_level")

        self._db.notifications.create_index([
            ("user_id", ASCENDING),
            ("timestamp", DESCENDING)
        ])
        self._db.notifications.create_index("read")

    def get_db(self):
        return self._db

    def insert_user_record(self, record: Dict[str, Any]) -> str:
        result = self._db.user_records.insert_one(record)
        return str(result.inserted_id)

    def get_user_records(self, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        cursor = self._db.user_records.find(
            {"user_id": user_id}
        ).sort("created_at", DESCENDING).limit(limit)
        return list(cursor)

    def get_session_record(self, session_id: str) -> Optional[Dict[str, Any]]:
        return self._db.user_records.find_one({"session_id": session_id})

    def update_record_training_status(self, session_id: str, used_for_training: bool = True):
        self._db.user_records.update_one(
            {"session_id": session_id},
            {"$set": {"is_used_for_training": used_for_training}}
        )

    def get_training_samples(self, limit: int = 1000) -> List[Dict[str, Any]]:
        cursor = self._db.user_records.find({
            "is_used_for_training": False,
            "fusion_result": {"$exists": True}
        }).limit(limit)
        return list(cursor)

    def save_federated_update(self, update: Dict[str, Any]) -> str:
        result = self._db.federated_updates.insert_one(update)
        return str(result.inserted_id)

    def get_latest_model_version(self) -> Optional[Dict[str, Any]]:
        return self._db.model_versions.find_one(
            sort=[("version", DESCENDING)]
        )

    def save_model_version(self, version_data: Dict[str, Any]) -> str:
        result = self._db.model_versions.insert_one(version_data)
        return str(result.inserted_id)

    def save_intervention_report(self, report: Dict[str, Any]) -> str:
        result = self._db.intervention_reports.insert_one(report)
        return str(result.inserted_id)

    def get_user_intervention_reports(self, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        cursor = self._db.intervention_reports.find(
            {"user_id": user_id}
        ).sort("generated_at", DESCENDING).limit(limit)
        return list(cursor)

    def get_latest_intervention_report(self, user_id: str) -> Optional[Dict[str, Any]]:
        return self._db.intervention_reports.find_one(
            {"user_id": user_id},
            sort=[("generated_at", DESCENDING)]
        )

    def save_notification(self, notification: Dict[str, Any]) -> str:
        result = self._db.notifications.insert_one(notification)
        return str(result.inserted_id)

    def get_user_notifications(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        cursor = self._db.notifications.find(
            {"user_id": user_id}
        ).sort("timestamp", DESCENDING).limit(limit)
        return list(cursor)

    def mark_notification_read(self, notification_id: str) -> bool:
        from bson import ObjectId
        result = self._db.notifications.update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": {"read": True}}
        )
        return result.modified_count > 0


class RedisCache:
    _instance: Optional['RedisCache'] = None
    _client: Optional[redis.Redis] = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, redis_url: Optional[str] = None):
        if self._client is None:
            self._connect(redis_url)

    def _connect(self, redis_url: Optional[str] = None):
        url = redis_url or os.environ.get(
            "REDIS_URL",
            "redis://:redis123@localhost:6379/0"
        )
        try:
            self._client = redis.Redis.from_url(url)
            self._client.ping()
            logger.info("Redis connected successfully")
        except redis.ConnectionError as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise

    def set(self, key: str, value: Any, expiration: Optional[int] = None) -> bool:
        try:
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            elif isinstance(value, (int, float, str)):
                value = str(value)
            else:
                value = pickle.dumps(value)

            if expiration:
                self._client.setex(key, expiration, value)
            else:
                self._client.set(key, value)
            return True
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            return False

    def get(self, key: str) -> Optional[Any]:
        try:
            value = self._client.get(key)
            if value is None:
                return None

            try:
                return json.loads(value)
            except (json.JSONDecodeError, UnicodeDecodeError):
                try:
                    return pickle.loads(value)
                except:
                    return value.decode('utf-8')
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None

    def delete(self, key: str) -> bool:
        try:
            self._client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
            return False

    def exists(self, key: str) -> bool:
        return self._client.exists(key) > 0

    def set_model_features(self, session_id: str, modality: str, features: Any):
        key = f"features:{modality}:{session_id}"
        self.set(key, features, expiration=3600)

    def get_model_features(self, session_id: str, modality: str) -> Optional[Any]:
        key = f"features:{modality}:{session_id}"
        return self.get(key)

    def cache_fusion_result(self, session_id: str, result: Any):
        key = f"fusion:{session_id}"
        self.set(key, result, expiration=7200)

    def get_cached_fusion_result(self, session_id: str) -> Optional[Any]:
        key = f"fusion:{session_id}"
        return self.get(key)

    def get_session_data(self, session_id: str) -> Dict[str, Any]:
        data = {}
        for modality in ["visual", "audio", "text"]:
            features = self.get_model_features(session_id, modality)
            if features:
                data[modality] = features
        return data

    def clear_session(self, session_id: str):
        for modality in ["visual", "audio", "text"]:
            self.delete(f"features:{modality}:{session_id}")
        self.delete(f"fusion:{session_id}")
