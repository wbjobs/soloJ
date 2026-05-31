"""Health check and performance monitoring utilities."""

import time
import threading
from typing import Dict, Any, Optional
import logging

try:
    import cupy as cp
    CUPY_AVAILABLE = True
except ImportError:
    CUPY_AVAILABLE = False

from ..cache.redis_cache import get_cache
from ..tasks.celery_worker import is_celery_available

logger = logging.getLogger(__name__)


class MetricsCollector:
    """Singleton metrics collector for performance monitoring."""
    
    _instance: Optional['MetricsCollector'] = None
    _lock = threading.Lock()
    
    def __new__(cls) -> 'MetricsCollector':
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        
        self.total_circuits_executed = 0
        self.cache_hits = 0
        self.cache_misses = 0
        self.execution_times: list = []
        self._max_execution_times = 1000
    
    def record_execution(self, execution_time_ms: float, from_cache: bool):
        """Record a circuit execution.
        
        Args:
            execution_time_ms: Execution time in milliseconds
            from_cache: Whether result came from cache
        """
        with self._lock:
            self.total_circuits_executed += 1
            if from_cache:
                self.cache_hits += 1
            else:
                self.cache_misses += 1
                self.execution_times.append(execution_time_ms)
                if len(self.execution_times) > self._max_execution_times:
                    self.execution_times.pop(0)
    
    def get_avg_execution_time(self) -> float:
        """Get average execution time.
        
        Returns:
            Average execution time in milliseconds
        """
        with self._lock:
            if not self.execution_times:
                return 0.0
            return sum(self.execution_times) / len(self.execution_times)
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get all metrics.
        
        Returns:
            Dictionary of metrics
        """
        with self._lock:
            metrics = {
                "total_circuits_executed": self.total_circuits_executed,
                "cache_hits": self.cache_hits,
                "cache_misses": self.cache_misses,
                "avg_execution_time_ms": self.get_avg_execution_time(),
            }
        return metrics


def check_gpu_available() -> bool:
    """Check if GPU is available.
    
    Returns:
        True if GPU is available
    """
    if not CUPY_AVAILABLE:
        return False
    try:
        cp.cuda.Device(0).compute_capability
        return True
    except Exception:
        return False


def get_gpu_metrics() -> Dict[str, Optional[float]]:
    """Get GPU utilization metrics.
    
    Returns:
        GPU memory and utilization metrics
    """
    if not CUPY_AVAILABLE:
        return {"gpu_memory_used_mb": None, "gpu_utilization": None}
    
    try:
        device = cp.cuda.Device(0)
        mempool = cp.get_default_memory_pool()
        used_bytes = mempool.used_bytes()
        used_mb = used_bytes / (1024 * 1024)
        
        return {
            "gpu_memory_used_mb": round(used_mb, 2),
            "gpu_utilization": None,
        }
    except Exception as e:
        logger.error(f"Error getting GPU metrics: {e}")
        return {"gpu_memory_used_mb": None, "gpu_utilization": None}


def get_health_status() -> Dict[str, Any]:
    """Get overall health status.
    
    Returns:
        Health status information
    """
    cache = get_cache()
    
    return {
        "status": "healthy",
        "gpu_available": check_gpu_available(),
        "redis_connected": cache.is_connected(),
        "celery_connected": is_celery_available(),
        "timestamp": time.time(),
    }


def get_active_tasks_count() -> int:
    """Get count of active Celery tasks.
    
    Returns:
        Number of active tasks
    """
    try:
        from ..tasks.celery_worker import celery_app
        inspect = celery_app.control.inspect()
        active = inspect.active()
        if active:
            return sum(len(tasks) for tasks in active.values())
        return 0
    except Exception:
        return 0


_metrics_collector: Optional[MetricsCollector] = None


def get_metrics_collector() -> MetricsCollector:
    """Get the global metrics collector.
    
    Returns:
        MetricsCollector instance
    """
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = MetricsCollector()
    return _metrics_collector
