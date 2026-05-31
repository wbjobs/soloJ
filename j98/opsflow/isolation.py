from __future__ import annotations

import os
import shutil
import subprocess
import threading
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from rich.console import Console

console = Console()


@dataclass
class ResourceLimits:
    cpu_limit: float | None = None
    mem_limit: str | None = None
    memswap_limit: str | None = None
    network_disabled: bool = False
    pids_limit: int | None = None
    io_weight: int | None = None


@dataclass
class IsolationConfig:
    backend: str = "local"
    image: str = "python:3.11-slim"
    auto_remove: bool = True
    workdir: str = "/workspace"
    volumes: list[tuple[str, str, str]] = field(default_factory=list)
    limits: ResourceLimits = field(default_factory=ResourceLimits)
    pull_policy: str = "if_not_present"


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


@dataclass
class ExecutionResult:
    success: bool
    return_code: int
    stdout: str
    stderr: str
    duration: float
    peak_stats: ContainerStats = field(default_factory=ContainerStats)
    container_id: str | None = None


class IsolationBackend(ABC):
    @abstractmethod
    def available(self) -> bool:
        ...

    @abstractmethod
    def execute(
        self,
        command: str,
        config: IsolationConfig,
        env: dict[str, str] | None = None,
        workdir: str | None = None,
        timeout: int | None = None,
        stats_callback: Any = None,
    ) -> ExecutionResult:
        ...


class DockerBackend(IsolationBackend):
    def __init__(self):
        self._docker_path = shutil.which("docker")

    def available(self) -> bool:
        if not self._docker_path:
            return False
        try:
            result = subprocess.run(
                [self._docker_path, "info"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            return result.returncode == 0
        except Exception:
            return False

    def execute(
        self,
        command: str,
        config: IsolationConfig,
        env: dict[str, str] | None = None,
        workdir: str | None = None,
        timeout: int | None = None,
        stats_callback: Any = None,
    ) -> ExecutionResult:
        start_time = time.time()
        container_name = f"opsflow-{uuid.uuid4().hex[:8]}"

        self._ensure_image(config.image, config.pull_policy)

        docker_args = [
            self._docker_path,
            "run",
            "--name", container_name,
        ]

        if config.auto_remove:
            docker_args.append("--rm")

        if config.limits.cpu_limit is not None:
            docker_args.extend(["--cpus", str(config.limits.cpu_limit)])

        if config.limits.mem_limit is not None:
            docker_args.extend(["--memory", config.limits.mem_limit])

        if config.limits.memswap_limit is not None:
            docker_args.extend(["--memory-swap", config.limits.memswap_limit])

        if config.limits.pids_limit is not None:
            docker_args.extend(["--pids-limit", str(config.limits.pids_limit)])

        if config.limits.network_disabled:
            docker_args.append("--network=none")

        for src, dst, mode in config.volumes:
            src_abs = str(Path(src).resolve())
            if os.name == "nt":
                src_abs = src_abs.replace("\\", "/")
                if ":" in src_abs:
                    src_abs = "/" + src_abs.replace(":", "")
            docker_args.extend(["-v", f"{src_abs}:{dst}:{mode}"])

        if env:
            safe_env = {}
            for k, v in env.items():
                if (
                    k.startswith("OPSFLOW_")
                    or k in ("PATH", "HOME", "USER", "LANG", "TERM")
                    or k.isupper() and len(k) <= 30
                ):
                    if isinstance(v, str) and "\n" not in v and "\r" not in v and len(v) < 1024:
                        safe_env[k] = v
            for k, v in safe_env.items():
                docker_args.extend(["-e", f"{k}={v}"])

        docker_args.extend(["-w", config.workdir])
        docker_args.append(config.image)

        shell_cmd = ["sh", "-c", command]
        docker_args.extend(shell_cmd)

        monitor_thread = None
        stop_monitor = threading.Event()
        peak_stats_list = [ContainerStats()]
        peak_stats_list[0]._lock = threading.Lock()

        if stats_callback:
            monitor_thread = threading.Thread(
                target=self._monitor_stats,
                args=(container_name, stop_monitor, stats_callback, peak_stats_list),
                daemon=True,
            )
            monitor_thread.start()

        try:
            proc = subprocess.Popen(
                docker_args,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                shell=False,
            )

            stdout_lines = []
            stderr_lines = []

            def read_output():
                for line in proc.stdout:
                    stdout_lines.append(line)
                    console.print(f"[dim]  {line.rstrip()}[/dim]")
                for line in proc.stderr:
                    stderr_lines.append(line)

            output_thread = threading.Thread(target=read_output, daemon=True)
            output_thread.start()
            output_thread.join(timeout=timeout)

            try:
                return_code = proc.wait(timeout=1)
            except subprocess.TimeoutExpired:
                proc.kill()
                return_code = -1

            duration = time.time() - start_time

            return ExecutionResult(
                success=return_code == 0,
                return_code=return_code,
                stdout="".join(stdout_lines),
                stderr="".join(stderr_lines),
                duration=duration,
                peak_stats=peak_stats_list[0],
                container_id=container_name,
            )

        finally:
            if monitor_thread:
                stop_monitor.set()
                monitor_thread.join(timeout=2)

    def _ensure_image(self, image: str, pull_policy: str):
        if pull_policy == "never":
            return

        try:
            result = subprocess.run(
                [self._docker_path, "inspect", "--type=image", image],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode == 0:
                if pull_policy == "if_not_present":
                    return
        except Exception:
            pass

        console.print(f"[cyan]  Pulling image: {image}[/cyan]")
        subprocess.run(
            [self._docker_path, "pull", image],
            capture_output=False,
            timeout=300,
        )

    def _monitor_stats(
        self,
        container_name: str,
        stop_event: threading.Event,
        callback: Any,
        peak_stats_list: list,
    ):
        first_call = True
        while not stop_event.is_set():
            try:
                result = subprocess.run(
                    [
                        self._docker_path,
                        "stats",
                        container_name,
                        "--no-stream",
                        "--format",
                        "{{json .}}",
                    ],
                    capture_output=True,
                    text=True,
                    timeout=3,
                )

                if result.returncode == 0 and result.stdout.strip():
                    import json
                    try:
                        data = json.loads(result.stdout.strip())
                        stats = self._parse_stats(data)
                        with peak_stats_list[0]._lock:
                            peak = peak_stats_list[0]
                            if stats.cpu_percent > peak.cpu_percent:
                                peak.cpu_percent = stats.cpu_percent
                            if stats.mem_usage > peak.mem_usage:
                                peak.mem_usage = stats.mem_usage
                            if stats.mem_percent > peak.mem_percent:
                                peak.mem_percent = stats.mem_percent
                        if callback:
                            callback(stats)
                    except (json.JSONDecodeError, KeyError, AttributeError):
                        pass
            except Exception:
                pass
            stop_event.wait(0.5 if first_call else 1.0)
            first_call = False

    def _parse_stats(self, data: dict[str, Any]) -> ContainerStats:
        cpu_str = data.get("CPUPerc", "0%")
        mem_str = data.get("MemPerc", "0%")
        mem_usage_str = data.get("MemUsage", "0 / 0")
        net_io = data.get("NetIO", "0 / 0")
        block_io = data.get("BlockIO", "0 / 0")
        pids = int(data.get("PIDs", "0") or 0)

        cpu_percent = float(cpu_str.rstrip("%")) if cpu_str else 0.0
        mem_percent = float(mem_str.rstrip("%")) if mem_str else 0.0

        mem_usage = 0
        mem_limit = 0
        if "/" in mem_usage_str:
            usage_part, limit_part = mem_usage_str.split("/", 1)
            mem_usage = self._parse_size(usage_part.strip())
            mem_limit = self._parse_size(limit_part.strip())

        net_rx, net_tx = 0, 0
        if "/" in net_io:
            rx_part, tx_part = net_io.split("/", 1)
            net_rx = self._parse_size(rx_part.strip())
            net_tx = self._parse_size(tx_part.strip())

        block_read, block_write = 0, 0
        if "/" in block_io:
            r_part, w_part = block_io.split("/", 1)
            block_read = self._parse_size(r_part.strip())
            block_write = self._parse_size(w_part.strip())

        return ContainerStats(
            cpu_percent=cpu_percent,
            mem_usage=mem_usage,
            mem_limit=mem_limit,
            mem_percent=mem_percent,
            net_rx=net_rx,
            net_tx=net_tx,
            block_read=block_read,
            block_write=block_write,
            pids=pids,
        )

    def _parse_size(self, size_str: str) -> int:
        size_str = size_str.strip()
        multipliers = [
            ("GiB", 1024 * 1024 * 1024),
            ("GB", 1024 * 1024 * 1024),
            ("MiB", 1024 * 1024),
            ("MB", 1024 * 1024),
            ("KiB", 1024),
            ("KB", 1024),
            ("B", 1),
        ]
        for suffix, mult in multipliers:
            if size_str.endswith(suffix):
                try:
                    return int(float(size_str[:-len(suffix)]) * mult)
                except ValueError:
                    return 0
        try:
            return int(size_str)
        except ValueError:
            return 0


class LocalBackend(IsolationBackend):
    def available(self) -> bool:
        return True

    def execute(
        self,
        command: str,
        config: IsolationConfig,
        env: dict[str, str] | None = None,
        workdir: str | None = None,
        timeout: int | None = None,
        stats_callback: Any = None,
    ) -> ExecutionResult:
        from .monitor import LocalResourceMonitor

        start_time = time.time()
        full_env = {**os.environ, **(env or {})}

        monitor = LocalResourceMonitor()
        monitor.start()

        try:
            proc = subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=full_env,
                cwd=workdir,
            )

            monitor.watch_pid(proc.pid)

            stdout_lines = []
            stderr_lines = []

            def read_output():
                for line in proc.stdout:
                    stdout_lines.append(line)
                    console.print(f"[dim]  {line.rstrip()}[/dim]")
                for line in proc.stderr:
                    stderr_lines.append(line)

            output_thread = threading.Thread(target=read_output, daemon=True)
            output_thread.start()
            output_thread.join(timeout=timeout)

            try:
                return_code = proc.wait(timeout=1)
            except subprocess.TimeoutExpired:
                proc.kill()
                return_code = -1

            duration = time.time() - start_time
            peak_stats = monitor.get_peak_stats()

            if stats_callback:
                stats_callback(peak_stats)

            return ExecutionResult(
                success=return_code == 0,
                return_code=return_code,
                stdout="".join(stdout_lines),
                stderr="".join(stderr_lines),
                duration=duration,
                peak_stats=peak_stats,
            )

        finally:
            monitor.stop()


def get_backend(backend_name: str = "auto") -> IsolationBackend:
    if backend_name == "auto":
        docker = DockerBackend()
        if docker.available():
            return docker
        return LocalBackend()
    elif backend_name == "docker":
        docker = DockerBackend()
        if not docker.available():
            raise RuntimeError(
                "Docker backend is not available. "
                "Please ensure Docker is installed and running, or use 'auto' backend for automatic fallback."
            )
        return docker
    else:
        return LocalBackend()
