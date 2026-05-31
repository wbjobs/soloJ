from __future__ import annotations

import os
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

import yaml


class ErrorPolicy(str, Enum):
    STOP = "stop"
    SKIP = "skip"
    RETRY = "retry"


@dataclass
class ResourceLimits:
    cpu: float | None = None
    memory: str | None = None
    memory_swap: str | None = None
    network_disabled: bool = False
    pids: int | None = None


@dataclass
class IsolationConfig:
    enabled: bool = False
    backend: str = "auto"
    image: str = "python:3.11-slim"
    auto_remove: bool = True
    volumes: list[str] = field(default_factory=list)
    limits: ResourceLimits = field(default_factory=ResourceLimits)
    pull_policy: str = "if_not_present"


@dataclass
class Step:
    name: str
    command: str | None = None
    plugin: str | None = None
    args: dict[str, Any] = field(default_factory=dict)
    env: dict[str, str] = field(default_factory=dict)
    on_error: ErrorPolicy = ErrorPolicy.STOP
    retry_count: int = 0
    retry_delay: int = 5
    condition: str | None = None
    timeout: int | None = None
    workdir: str | None = None
    isolation: IsolationConfig | None = None
    monitor: bool = True

    def __post_init__(self):
        if self.command is None and self.plugin is None:
            raise ValueError(f"Step '{self.name}' must have either 'command' or 'plugin'")
        if isinstance(self.on_error, str):
            self.on_error = ErrorPolicy(self.on_error)


@dataclass
class Pipeline:
    name: str
    description: str = ""
    steps: list[Step] = field(default_factory=list)
    env: dict[str, str] = field(default_factory=dict)
    workdir: str | None = None


@dataclass
class Config:
    pipelines: dict[str, Pipeline] = field(default_factory=dict)
    plugin_dirs: list[str] = field(default_factory=lambda: ["./plugins"])
    global_env: dict[str, str] = field(default_factory=dict)


def _parse_isolation(raw: dict[str, Any] | None) -> IsolationConfig | None:
    if not raw:
        return None
    limits_raw = raw.get("limits", {})
    limits = ResourceLimits(
        cpu=limits_raw.get("cpu"),
        memory=limits_raw.get("memory"),
        memory_swap=limits_raw.get("memory_swap"),
        network_disabled=limits_raw.get("network_disabled", False),
        pids=limits_raw.get("pids"),
    )
    return IsolationConfig(
        enabled=raw.get("enabled", False),
        backend=raw.get("backend", "auto"),
        image=raw.get("image", "python:3.11-slim"),
        auto_remove=raw.get("auto_remove", True),
        volumes=raw.get("volumes", []),
        limits=limits,
        pull_policy=raw.get("pull_policy", "if_not_present"),
    )


def _parse_step(raw: dict[str, Any]) -> Step:
    return Step(
        name=raw["name"],
        command=raw.get("command"),
        plugin=raw.get("plugin"),
        args=raw.get("args", {}),
        env=raw.get("env", {}),
        on_error=raw.get("on_error", ErrorPolicy.STOP),
        retry_count=raw.get("retry_count", 0),
        retry_delay=raw.get("retry_delay", 5),
        condition=raw.get("condition"),
        timeout=raw.get("timeout"),
        workdir=raw.get("workdir"),
        isolation=_parse_isolation(raw.get("isolation")),
        monitor=raw.get("monitor", True),
    )


def _parse_pipeline(name: str, raw: dict[str, Any]) -> Pipeline:
    steps = [_parse_step(s) for s in raw.get("steps", [])]
    return Pipeline(
        name=name,
        description=raw.get("description", ""),
        steps=steps,
        env=raw.get("env", {}),
        workdir=raw.get("workdir"),
    )


def load_config(path: str | Path) -> Config:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Config file not found: {p}")
    with open(p, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}

    pipelines = {}
    for name, raw_pipeline in data.get("pipelines", {}).items():
        pipelines[name] = _parse_pipeline(name, raw_pipeline)

    plugin_dirs = data.get("plugin_dirs", ["./plugins"])
    global_env = data.get("global_env", {})

    resolved_env = {}
    for k, v in {**global_env, **os.environ}.items():
        resolved_env[k] = str(v)

    return Config(
        pipelines=pipelines,
        plugin_dirs=plugin_dirs,
        global_env=resolved_env,
    )


def find_config_file() -> Path | None:
    candidates = [
        Path("opsflow.yaml"),
        Path("opsflow.yml"),
        Path("opsflow.yaml").resolve(),
        Path("opsflow.yml").resolve(),
    ]
    for c in candidates:
        if c.exists():
            return c
    return None
