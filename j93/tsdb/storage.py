import os
import struct
import hashlib
import json
import time
import logging
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from pathlib import Path
import threading

logger = logging.getLogger("tsdb")

MAGIC_NUMBER = b"TSDB"
VERSION = 1
HEADER_SIZE = 8
POINT_SIZE = 16


@dataclass
class Sample:
    timestamp: int
    value: float


@dataclass
class TimeSeries:
    metric: str
    labels: Dict[str, str]
    samples: List[Sample]


class TimeSeriesStorage:
    def __init__(self, data_dir: str = "./data", flush_interval: float = 5.0):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = self.data_dir / "index.json"
        self.wal_file = self.data_dir / "wal.log"
        self._lock = threading.RLock()
        self._index: Dict[str, Dict] = {}
        self._dirty = False
        self._flush_interval = flush_interval
        self._running = True
        self._stop_event = threading.Event()

        self._load_index_with_recovery()
        self._replay_wal()
        self._start_flush_thread()

    def close(self):
        self._running = False
        self._stop_event.set()
        if hasattr(self, "_flush_thread") and self._flush_thread.is_alive():
            self._flush_thread.join(timeout=10)
        self._flush_index()
        if not self._dirty:
            self._flush_wal()

    def _load_index_with_recovery(self):
        try:
            self._index = self._load_index_file(self.index_file)
            return
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("Index file corrupted: %s, attempting recovery", e)

        backup_file = self.data_dir / "index.json.bak"
        try:
            self._index = self._load_index_file(backup_file)
            logger.info("Recovered index from backup file")
            self._save_index_atomic(self._index, self.index_file)
            return
        except (json.JSONDecodeError, OSError):
            logger.warning("Backup index also corrupted, rebuilding from data files")

        self._index = self._rebuild_index_from_data_files()
        self._save_index_atomic(self._index, self.index_file)
        logger.info("Rebuilt index from %d data files", len(self._index))

    def _load_index_file(self, path: Path) -> Dict[str, Dict]:
        if not path.exists():
            return {}
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_index_atomic(self, index: Dict, target: Path):
        tmp_file = target.with_suffix(".json.tmp")
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(index, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        backup = target.with_suffix(".json.bak")
        if target.exists():
            try:
                os.replace(str(target), str(backup))
            except OSError:
                pass
        os.replace(str(tmp_file), str(target))

    def _rebuild_index_from_data_files(self) -> Dict[str, Dict]:
        index = {}
        for dat_file in self.data_dir.glob("*.dat"):
            series_id = dat_file.stem
            try:
                info = self._rebuild_series_info(dat_file)
                if info is not None:
                    index[series_id] = info
            except Exception as e:
                logger.error("Failed to rebuild index for %s: %s", dat_file, e)
        return index

    def _rebuild_series_info(self, dat_file: Path) -> Optional[Dict]:
        sample_count = 0
        min_time = None
        max_time = None

        with open(dat_file, "rb") as f:
            if not self._read_header(f):
                return None

            while True:
                sample = self._read_point(f)
                if sample is None:
                    break
                sample_count += 1
                if min_time is None or sample.timestamp < min_time:
                    min_time = sample.timestamp
                if max_time is None or sample.timestamp > max_time:
                    max_time = sample.timestamp

        if sample_count == 0:
            return None

        with open(dat_file, "rb") as f:
            f.seek(HEADER_SIZE)
            first_sample = self._read_point(f)

        metric, labels = self._extract_metric_labels_from_filename(dat_file.stem)
        if metric is None:
            metric_file = self.data_dir / f"{dat_file.stem}.meta"
            if metric_file.exists():
                try:
                    with open(metric_file, "r", encoding="utf-8") as mf:
                        meta = json.load(mf)
                        metric = meta.get("metric", "unknown")
                        labels = meta.get("labels", {})
                except (json.JSONDecodeError, OSError):
                    metric = "unknown"
                    labels = {}
            else:
                metric = "unknown"
                labels = {}

        return {
            "metric": metric,
            "labels": labels,
            "count": sample_count,
            "min_time": min_time,
            "max_time": max_time,
        }

    def _extract_metric_labels_from_filename(self, series_id: str) -> Tuple[Optional[str], Dict]:
        return None, {}

    def _replay_wal(self):
        if not self.wal_file.exists():
            return

        logger.info("Replaying WAL file...")
        replayed = 0
        try:
            with open(self.wal_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        self._apply_wal_entry(entry)
                        replayed += 1
                    except (json.JSONDecodeError, KeyError) as e:
                        logger.warning("Skipping corrupt WAL entry: %s", e)
        except OSError as e:
            logger.error("Failed to read WAL: %s", e)
            return

        logger.info("Replayed %d WAL entries", replayed)
        self._flush_index()
        try:
            self.wal_file.unlink()
        except OSError:
            pass

    def _apply_wal_entry(self, entry: Dict):
        series_id = entry.get("series_id")
        if not series_id:
            return

        metric = entry.get("metric", "unknown")
        labels = entry.get("labels", {})
        timestamp = entry.get("timestamp", 0)
        value = entry.get("value", 0.0)

        if series_id not in self._index:
            self._index[series_id] = {
                "metric": metric,
                "labels": labels,
                "count": 0,
                "min_time": timestamp,
                "max_time": timestamp,
            }

        idx = self._index[series_id]
        idx["count"] += 1
        idx["min_time"] = min(idx.get("min_time", timestamp), timestamp)
        idx["max_time"] = max(idx.get("max_time", timestamp), timestamp)

    def _start_flush_thread(self):
        self._flush_thread = threading.Thread(target=self._flush_loop, daemon=True)
        self._flush_thread.start()

    def _flush_loop(self):
        while self._running:
            if self._stop_event.wait(timeout=self._flush_interval):
                break
            try:
                self._flush_index()
                if not self._dirty:
                    self._flush_wal()
            except Exception as e:
                logger.error("Flush error: %s", e)

    def _flush_index(self):
        with self._lock:
            if not self._dirty:
                return
            self._save_index_atomic(self._index, self.index_file)
            self._dirty = False

    def _flush_wal(self):
        if self.wal_file.exists():
            try:
                self.wal_file.unlink()
            except OSError:
                pass

    def _get_series_id(self, metric: str, labels: Dict[str, str]) -> str:
        labels_str = json.dumps(labels, sort_keys=True)
        key = f"{metric}:{labels_str}"
        return hashlib.sha256(key.encode()).hexdigest()[:16]

    def _get_series_file(self, series_id: str) -> Path:
        return self.data_dir / f"{series_id}.dat"

    def _get_meta_file(self, series_id: str) -> Path:
        return self.data_dir / f"{series_id}.meta"

    def _write_header(self, f):
        f.write(MAGIC_NUMBER)
        f.write(struct.pack("<H", VERSION))
        f.write(struct.pack("<H", 0))

    def _read_header(self, f) -> bool:
        magic = f.read(4)
        if magic != MAGIC_NUMBER:
            return False
        version = struct.unpack("<H", f.read(2))[0]
        f.read(2)
        return version == VERSION

    def _write_point(self, f, timestamp: int, value: float):
        f.write(struct.pack("<Q", timestamp))
        f.write(struct.pack("<d", value))

    def _read_point(self, f) -> Optional[Sample]:
        data = f.read(POINT_SIZE)
        if len(data) < POINT_SIZE:
            return None
        timestamp = struct.unpack("<Q", data[:8])[0]
        value = struct.unpack("<d", data[8:])[0]
        return Sample(timestamp=timestamp, value=value)

    def _write_wal_entry(self, series_id: str, metric: str,
                         labels: Dict[str, str], timestamp: int, value: float):
        entry = {
            "series_id": series_id,
            "metric": metric,
            "labels": labels,
            "timestamp": timestamp,
            "value": value,
        }
        with open(self.wal_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, separators=(",", ":")) + "\n")
            f.flush()

    def write(self, metric: str, labels: Dict[str, str], timestamp: int, value: float):
        with self._lock:
            series_id = self._get_series_id(metric, labels)

            is_new_series = series_id not in self._index

            self._write_wal_entry(series_id, metric, labels, timestamp, value)

            series_file = self._get_series_file(series_id)
            file_exists = series_file.exists()

            with open(series_file, "ab") as f:
                if not file_exists:
                    self._write_header(f)
                self._write_point(f, timestamp, value)
                f.flush()

            if is_new_series:
                self._index[series_id] = {
                    "metric": metric,
                    "labels": labels,
                    "count": 0,
                    "min_time": timestamp,
                    "max_time": timestamp,
                }
                meta_file = self._get_meta_file(series_id)
                with open(meta_file, "w", encoding="utf-8") as mf:
                    json.dump({"metric": metric, "labels": labels}, mf)

            idx = self._index[series_id]
            idx["count"] += 1
            idx["min_time"] = min(idx["min_time"], timestamp)
            idx["max_time"] = max(idx["max_time"], timestamp)
            self._dirty = True

    def write_batch(self, points: List[Tuple[str, Dict[str, str], int, float]]):
        with self._lock:
            for metric, labels, ts, val in points:
                self.write(metric, labels, ts, val)

    def read_series(self, metric: str, labels: Dict[str, str],
                    start: Optional[int] = None,
                    end: Optional[int] = None) -> List[Sample]:
        series_id = self._get_series_id(metric, labels)
        return self._read_series_by_id(series_id, start, end)

    def _read_series_by_id(self, series_id: str,
                           start: Optional[int] = None,
                           end: Optional[int] = None) -> List[Sample]:
        if series_id not in self._index:
            return []

        series_file = self._get_series_file(series_id)
        if not series_file.exists():
            return []

        samples = []
        with open(series_file, "rb") as f:
            if not self._read_header(f):
                return []

            while True:
                sample = self._read_point(f)
                if sample is None:
                    break

                if start is not None and sample.timestamp < start:
                    continue
                if end is not None and sample.timestamp > end:
                    continue

                samples.append(sample)

        return samples

    def find_series(self, metric: Optional[str] = None,
                    labels_match: Optional[Dict[str, str]] = None) -> List[Dict]:
        with self._lock:
            results = []
            for series_id, info in self._index.items():
                if metric and info["metric"] != metric:
                    continue
                if labels_match:
                    match = True
                    for k, v in labels_match.items():
                        if info["labels"].get(k) != v:
                            match = False
                            break
                    if not match:
                        continue
                results.append({"series_id": series_id, **info})
            return results

    def query_range(self, metric: str, labels_match: Optional[Dict[str, str]] = None,
                    start: Optional[int] = None, end: Optional[int] = None) -> List[TimeSeries]:
        series_list = self.find_series(metric, labels_match)
        results = []

        for series_info in series_list:
            samples = self._read_series_by_id(
                series_info["series_id"], start, end
            )
            if samples:
                results.append(TimeSeries(
                    metric=series_info["metric"],
                    labels=series_info["labels"],
                    samples=samples
                ))

        return results

    def get_all_metrics(self) -> List[str]:
        with self._lock:
            metrics = set()
            for info in self._index.values():
                metrics.add(info["metric"])
            return sorted(list(metrics))

    def delete_series(self, metric: str, labels: Dict[str, str]) -> bool:
        with self._lock:
            series_id = self._get_series_id(metric, labels)
            if series_id not in self._index:
                return False

            series_file = self._get_series_file(series_id)
            if series_file.exists():
                series_file.unlink()

            meta_file = self._get_meta_file(series_id)
            if meta_file.exists():
                meta_file.unlink()

            del self._index[series_id]
            self._dirty = True
            return True

    def delete_series_range(self, series_id: str, start: Optional[int] = None,
                            end: Optional[int] = None) -> int:
        with self._lock:
            if series_id not in self._index:
                return 0

            series_file = self._get_series_file(series_id)
            if not series_file.exists():
                return 0

            all_samples = []
            with open(series_file, "rb") as f:
                if not self._read_header(f):
                    return 0
                while True:
                    sample = self._read_point(f)
                    if sample is None:
                        break
                    all_samples.append(sample)

            kept = []
            deleted = 0
            for s in all_samples:
                if start is not None and s.timestamp < start:
                    kept.append(s)
                    continue
                if end is not None and s.timestamp > end:
                    kept.append(s)
                    continue
                deleted += 1

            if deleted == 0:
                return 0

            with open(series_file, "wb") as f:
                self._write_header(f)
                for s in kept:
                    self._write_point(f, s.timestamp, s.value)
                f.flush()

            if series_id in self._index:
                idx = self._index[series_id]
                idx["count"] = len(kept)
                if kept:
                    idx["min_time"] = min(s.timestamp for s in kept)
                    idx["max_time"] = max(s.timestamp for s in kept)
                else:
                    idx["min_time"] = 0
                    idx["max_time"] = 0
                self._dirty = True

            return deleted

    def replace_series_range(self, series_id: str, start: int, end: int,
                             new_samples: List[Sample]) -> int:
        with self._lock:
            if series_id not in self._index:
                return 0

            series_file = self._get_series_file(series_id)
            if not series_file.exists():
                return 0

            all_samples = []
            with open(series_file, "rb") as f:
                if not self._read_header(f):
                    return 0
                while True:
                    sample = self._read_point(f)
                    if sample is None:
                        break
                    all_samples.append(sample)

            kept = [s for s in all_samples if s.timestamp < start or s.timestamp > end]
            kept.extend(new_samples)
            kept.sort(key=lambda s: s.timestamp)

            with open(series_file, "wb") as f:
                self._write_header(f)
                for s in kept:
                    self._write_point(f, s.timestamp, s.value)
                f.flush()

            if series_id in self._index:
                idx = self._index[series_id]
                idx["count"] = len(kept)
                if kept:
                    idx["min_time"] = kept[0].timestamp
                    idx["max_time"] = kept[-1].timestamp
                self._dirty = True

            return len(new_samples)
