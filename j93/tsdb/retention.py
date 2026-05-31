import os
import json
import time
import logging
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from pathlib import Path
import threading
from .storage import TimeSeriesStorage, Sample

logger = logging.getLogger("tsdb")


@dataclass
class DownsamplePolicy:
    after_seconds: int
    granularity_seconds: int
    aggregation: str = "avg"

    def to_dict(self) -> Dict:
        return {
            "after_seconds": self.after_seconds,
            "granularity_seconds": self.granularity_seconds,
            "aggregation": self.aggregation,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "DownsamplePolicy":
        return cls(
            after_seconds=data["after_seconds"],
            granularity_seconds=data["granularity_seconds"],
            aggregation=data.get("aggregation", "avg"),
        )


@dataclass
class RetentionPolicy:
    metric: str
    retention_seconds: int
    downsample: List[DownsamplePolicy] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "metric": self.metric,
            "retention_seconds": self.retention_seconds,
            "downsample": [d.to_dict() for d in self.downsample],
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "RetentionPolicy":
        downsample = [
            DownsamplePolicy.from_dict(d) for d in data.get("downsample", [])
        ]
        return cls(
            metric=data["metric"],
            retention_seconds=data["retention_seconds"],
            downsample=downsample,
        )

    def get_effective_policy(self, age_seconds: int) -> Optional[DownsamplePolicy]:
        best = None
        for ds in sorted(self.downsample, key=lambda d: d.after_seconds):
            if age_seconds >= ds.after_seconds:
                best = ds
        return best


class RetentionManager:
    def __init__(self, storage: TimeSeriesStorage, check_interval: float = 60.0):
        self.storage = storage
        self._policies: Dict[str, RetentionPolicy] = {}
        self._check_interval = check_interval
        self._running = True
        self._stop_event = threading.Event()
        self._lock = threading.RLock()
        self._policies_file = storage.data_dir / "retention_policies.json"
        self._load_policies()
        self._start_check_thread()

    def close(self):
        self._running = False
        self._stop_event.set()
        if hasattr(self, "_check_thread") and self._check_thread.is_alive():
            self._check_thread.join(timeout=10)

    def _load_policies(self):
        if self._policies_file.exists():
            try:
                with open(self._policies_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for item in data:
                    policy = RetentionPolicy.from_dict(item)
                    self._policies[policy.metric] = policy
                logger.info("Loaded %d retention policies", len(self._policies))
            except (json.JSONDecodeError, OSError) as e:
                logger.warning("Failed to load retention policies: %s", e)

    def _save_policies(self):
        data = [p.to_dict() for p in self._policies.values()]
        tmp_file = self._policies_file.with_suffix(".json.tmp")
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(str(tmp_file), str(self._policies_file))

    def _start_check_thread(self):
        self._check_thread = threading.Thread(
            target=self._check_loop, daemon=True
        )
        self._check_thread.start()

    def _check_loop(self):
        while self._running:
            if self._stop_event.wait(timeout=self._check_interval):
                break
            try:
                self.enforce_all_policies()
            except Exception as e:
                logger.error("Retention enforcement error: %s", e)

    def add_policy(self, policy: RetentionPolicy):
        with self._lock:
            self._policies[policy.metric] = policy
            self._save_policies()
        logger.info(
            "Added retention policy for %s: keep %ds, %d downsample levels",
            policy.metric,
            policy.retention_seconds,
            len(policy.downsample),
        )

    def remove_policy(self, metric: str) -> bool:
        with self._lock:
            if metric not in self._policies:
                return False
            del self._policies[metric]
            self._save_policies()
        logger.info("Removed retention policy for %s", metric)
        return True

    def get_policy(self, metric: str) -> Optional[RetentionPolicy]:
        with self._lock:
            return self._policies.get(metric)

    def list_policies(self) -> List[RetentionPolicy]:
        with self._lock:
            return list(self._policies.values())

    def enforce_all_policies(self):
        now = int(time.time())
        with self._lock:
            policies = list(self._policies.values())

        for policy in policies:
            try:
                self._enforce_policy(policy, now)
            except Exception as e:
                logger.error(
                    "Error enforcing policy for %s: %s", policy.metric, e
                )

    def _enforce_policy(self, policy: RetentionPolicy, now: int):
        series_list = self.storage.find_series(metric=policy.metric)

        for series_info in series_list:
            series_id = series_info["series_id"]
            cutoff_time = now - policy.retention_seconds

            if policy.downsample:
                sorted_policies = sorted(
                    policy.downsample, key=lambda d: d.after_seconds, reverse=True
                )
                for ds in sorted_policies:
                    boundary = now - ds.after_seconds
                    if boundary <= cutoff_time:
                        continue
                    self._downsample_series(
                        series_id, cutoff_time, boundary, ds
                    )

            if series_info.get("min_time", now) < cutoff_time:
                self.storage.delete_series_range(
                    series_id, end=cutoff_time
                )
                logger.debug(
                    "Pruned data older than %d for %s", cutoff_time, series_id
                )

    def _downsample_series(
        self,
        series_id: str,
        start: int,
        end: int,
        ds_policy: DownsamplePolicy,
    ):
        samples = self.storage._read_series_by_id(series_id, start, end)
        if not samples:
            return

        buckets: Dict[int, List[Sample]] = {}
        for sample in samples:
            bucket_key = (sample.timestamp // ds_policy.granularity_seconds) * ds_policy.granularity_seconds
            if bucket_key not in buckets:
                buckets[bucket_key] = []
            buckets[bucket_key].append(sample)

        aggregated: List[Sample] = []
        for bucket_time in sorted(buckets.keys()):
            bucket_samples = buckets[bucket_time]
            agg_value = self._aggregate(bucket_samples, ds_policy.aggregation)
            aggregated.append(Sample(timestamp=bucket_time, value=agg_value))

        if not aggregated:
            return

        self.storage.replace_series_range(
            series_id, start, end, aggregated
        )

    def _aggregate(self, samples: List[Sample], method: str) -> float:
        values = [s.value for s in samples]
        if method == "avg":
            return sum(values) / len(values)
        elif method == "sum":
            return sum(values)
        elif method == "min":
            return min(values)
        elif method == "max":
            return max(values)
        elif method == "count":
            return float(len(values))
        else:
            return sum(values) / len(values)

    def get_downsampled_series(
        self,
        series_id: str,
        start: Optional[int] = None,
        end: Optional[int] = None,
    ) -> List[Sample]:
        return self.storage._read_series_by_id(series_id, start, end)
