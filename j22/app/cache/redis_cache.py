"""Redis cache implementation for circuit results."""

import json
import redis
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

CACHE_TTL = 300


class RedisCache:
    """Redis cache manager for quantum circuit results."""
    
    def __init__(self, host: str = "localhost", port: int = 6379, db: int = 0):
        """Initialize Redis connection.
        
        Args:
            host: Redis host
            port: Redis port
            db: Redis database number
        """
        self.host = host
        self.port = port
        self.db = db
        self._client: Optional[redis.Redis] = None
        self._connect()
    
    def _connect(self) -> None:
        """Connect to Redis server."""
        try:
            self._client = redis.Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                decode_responses=True
            )
            self._client.ping()
            logger.info("Connected to Redis successfully")
        except redis.ConnectionError as e:
            logger.warning(f"Failed to connect to Redis: {e}")
            self._client = None
    
    def is_connected(self) -> bool:
        """Check if Redis is connected."""
        if self._client is None:
            return False
        try:
            self._client.ping()
            return True
        except Exception:
            return False
    
    def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Get cached result.
        
        Args:
            key: Cache key
            
        Returns:
            Cached data or None
        """
        if not self.is_connected():
            return None
        
        try:
            data = self._client.get(key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.error(f"Error getting from cache: {e}")
        
        return None
    
    def set(self, key: str, value: Dict[str, Any], ttl: int = CACHE_TTL) -> bool:
        """Cache a result.
        
        Args:
            key: Cache key
            value: Data to cache
            ttl: Time to live in seconds
            
        Returns:
            True if successful
        """
        if not self.is_connected():
            return False
        
        try:
            self._client.setex(key, ttl, json.dumps(value))
            return True
        except Exception as e:
            logger.error(f"Error setting cache: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete a cached entry.
        
        Args:
            key: Cache key
            
        Returns:
            True if successful
        """
        if not self.is_connected():
            return False
        
        try:
            self._client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Error deleting from cache: {e}")
            return False
    
    def clear_all(self) -> bool:
        """Clear all cache entries.
        
        Returns:
            True if successful
        """
        if not self.is_connected():
            return False
        
        try:
            self._client.flushdb()
            return True
        except Exception as e:
            logger.error(f"Error clearing cache: {e}")
            return False


_cache_instance: Optional[RedisCache] = None


def get_cache() -> RedisCache:
    """Get or create the global cache instance.
    
    Returns:
        RedisCache instance
    """
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = RedisCache()
    return _cache_instance
