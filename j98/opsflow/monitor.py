from __future__ import annotations

import threading
import time
from dataclasses import dataclass

try:
    import psutil
    _HAS_PSUTIL = True
except ImportError:
    _HAS_PSUTIL = False


@dataclass
class ContainerStats:
    cpu_percent: float = 0.0
    mem_usage: int = 0
    mem_limit: int = 0
    mem_percent: float = 0.0
    net_rx: int = 0
    net_tx: int = 0
    block_read: int = 0
    block_write: int = 0
    pids: int = 0


class LocalResourceMonitor:
    def __init__(self, interval: float = 0.5):
        self._interval = interval
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._watched_pid: int | None = None
        self._peak_stats = ContainerStats()
        self._current_stats = ContainerStats()
        self._lock = threading.Lock()
        self._callback = None

        if _HAS_PSUTIL:
            self._total_mem = psutil.virtual_memory().total
        else:
            self._total_mem = 0

    def watch_pid(self, pid: int):
        self._watched_pid = pid

    def set_callback(self, callback):
        self._callback = callback

    def start(self):
        if not _HAS_PSUTIL:
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._thread.start()

    def stop(self):
        if self._thread:
            self._stop_event.set()
            self._thread.join(timeout=2)
            self._thread = None

    def get_peak_stats(self) -> ContainerStats:
        with self._lock:
            return ContainerStats(
                cpu_percent=self._peak_stats.cpu_percent,
                mem_usage=self._peak_stats.mem_usage,
                mem_limit=self._peak_stats.mem_limit,
                mem_percent=self._peak_stats.mem_percent,
                net_rx=self._peak_stats.net_rx,
                net_tx=self._peak_stats.net_tx,
                block_read=self._peak_stats.block_read,
                block_write=self._peak_stats.block_write,
                pids=self._peak_stats.pids,
            )

    def get_current_stats(self) -> ContainerStats:
        with self._lock:
            return ContainerStats(
                cpu_percent=self._current_stats.cpu_percent,
                mem_usage=self._current_stats.mem_usage,
                mem_limit=self._current_stats.mem_limit,
                mem_percent=self._current_stats.mem_percent,
                net_rx=self._current_stats.net_rx,
                net_tx=self._current_stats.net_tx,
                block_read=self._current_stats.block_read,
                block_write=self._current_stats.block_write,
                pids=self._current_stats.pids,
            )

    def _monitor_loop(self):
        if not _HAS_PSUTIL:
            return

        prev_net_io = psutil.net_io_counters()
        prev_disk_io = psutil.disk_io_counters()

        while not self._stop_event.is_set():
            try:
                stats = self._collect_stats(prev_net_io, prev_disk_io)

                with self._lock:
                    self._current_stats = stats
                    if stats.cpu_percent > self._peak_stats.cpu_percent:
                        self._peak_stats.cpu_percent = stats.cpu_percent
                    if stats.mem_usage > self._peak_stats.mem_usage:
                        self._peak_stats.mem_usage = stats.mem_usage
                    if stats.mem_percent > self._peak_stats.mem_percent:
                        self._peak_stats.mem_percent = stats.mem_percent
                    self._peak_stats.net_rx = stats.net_rx
                    self._peak_stats.net_tx = stats.net_tx
                    self._peak_stats.block_read = stats.block_read
                    self._peak_stats.block_write = stats.block_write
                    self._peak_stats.pids = stats.pids

                if self._callback:
                    self._callback(stats)

                current_net_io = psutil.net_io_counters()
                current_disk_io = psutil.disk_io_counters()
                prev_net_io = current_net_io
                prev_disk_io = current_disk_io

            except Exception:
                pass

            self._stop_event.wait(self._interval)

    def _collect_stats(self, prev_net_io, prev_disk_io) -> ContainerStats:
        cpu_percent = 0.0
        mem_usage = 0
        pids_count = 0

        if self._watched_pid:
            try:
                proc = psutil.Process(self._watched_pid)
                with proc.oneshot():
                    cpu_percent = proc.cpu_percent(interval=None)
                    mem_info = proc.memory_info()
                    mem_usage = mem_info.rss
                    try:
                        children = proc.children(recursive=True)
                        pids_count = len(children) + 1
                        for child in children:
                            try:
                                child_mem = child.memory_info()
                                mem_usage += child_mem.rss
                            except Exception:
                                pass
                    except Exception:
                        pids_count = 1
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        else:
            cpu_percent = psutil.cpu_percent(interval=None)
            mem = psutil.virtual_memory()
            mem_usage = mem.used

        current_net = psutil.net_io_counters()
        net_rx = current_net.bytes_recv - prev_net_io.bytes_recv
        net_tx = current_net.bytes_sent - prev_net_io.bytes_sent

        current_disk = psutil.disk_io_counters()
        block_read = current_disk.read_bytes - prev_disk_io.read_bytes
        block_write = current_disk.write_bytes - prev_disk_io.write_bytes

        mem_percent = (mem_usage / self._total_mem * 100) if self._total_mem > 0 else 0.0

        return ContainerStats(
            cpu_percent=cpu_percent,
            mem_usage=mem_usage,
            mem_limit=self._total_mem,
            mem_percent=mem_percent,
            net_rx=net_rx,
            net_tx=net_tx,
            block_read=block_read,
            block_write=block_write,
            pids=pids_count,
        )
