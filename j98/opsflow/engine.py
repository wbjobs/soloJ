from __future__ import annotations

import os
import subprocess
import time
from dataclasses import dataclass, field
from typing import Any

from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn
from rich.table import Table
from rich.text import Text

from opsflow.config import Config, ErrorPolicy, Pipeline, Step
from opsflow.isolation import (
    ContainerStats,
    DockerBackend,
    IsolationConfig as IsoExecConfig,
    LocalBackend,
    ResourceLimits as IsoResourceLimits,
    get_backend,
)

console = Console()


def _format_bytes(num: int | float) -> str:
    num = int(num)
    for unit in ["B", "KiB", "MiB", "GiB", "TiB"]:
        if num < 1024:
            return f"{num:.1f}{unit}"
        num /= 1024
    return f"{num:.1f}PiB"


@dataclass
class StepResult:
    step_name: str
    success: bool
    output: str = ""
    error: str = ""
    return_code: int = 0
    duration: float = 0.0
    skipped: bool = False
    retried: int = 0
    peak_stats: ContainerStats | None = None
    isolation_backend: str | None = None


@dataclass
class PipelineResult:
    pipeline_name: str
    step_results: list[StepResult] = field(default_factory=list)
    success: bool = True
    total_duration: float = 0.0

    @property
    def failed_steps(self) -> list[StepResult]:
        return [r for r in self.step_results if not r.success and not r.skipped]


class _ResourceMonitorDisplay:
    def __init__(self, step_name: str):
        self.step_name = step_name
        self.current_stats = ContainerStats()
        self.peak_stats = ContainerStats()
        self._live: Live | None = None
        self._start_time = time.time()

    def update(self, stats: ContainerStats):
        self.current_stats = stats
        if stats.cpu_percent > self.peak_stats.cpu_percent:
            self.peak_stats.cpu_percent = stats.cpu_percent
        if stats.mem_usage > self.peak_stats.mem_usage:
            self.peak_stats.mem_usage = stats.mem_usage
        if stats.mem_percent > self.peak_stats.mem_percent:
            self.peak_stats.mem_percent = stats.mem_percent
        if self._live:
            self._live.update(self._render())

    def _render(self) -> Panel:
        elapsed = time.time() - self._start_time
        stats = self.current_stats

        cpu_bar = Progress(
            SpinnerColumn(),
            TextColumn("[bold blue]CPU:"),
            BarColumn(bar_width=20),
            TextColumn("[bold blue]{task.percentage:>5.1f}%"),
            console=console,
        )
        cpu_task = cpu_bar.add_task("cpu", total=100, completed=min(stats.cpu_percent, 100))

        mem_bar = Progress(
            TextColumn("[bold green]MEM:"),
            BarColumn(bar_width=20),
            TextColumn("[bold green]{task.percentage:>5.1f}%"),
            TextColumn("[dim]({task.fields[used]} / {task.fields[limit]})"),
            console=console,
        )
        mem_used = _format_bytes(stats.mem_usage)
        mem_limit = _format_bytes(stats.mem_limit) if stats.mem_limit > 0 else "?"
        mem_task = mem_bar.add_task(
            "mem", total=100, completed=min(stats.mem_percent, 100),
            used=mem_used, limit=mem_limit
        )

        content = Text()
        content.append(f"Step: {self.step_name}\n", style="bold cyan")
        content.append(f"Elapsed: {elapsed:.1f}s\n\n", style="dim")
        content.append(f"CPU:  {stats.cpu_percent:>5.1f}%  (peak: {self.peak_stats.cpu_percent:.1f}%)\n")
        content.append(f"MEM:  {mem_used:>8}  (peak: {_format_bytes(self.peak_stats.mem_usage)})\n")
        if stats.pids > 0:
            content.append(f"PIDs: {stats.pids}\n")
        if stats.net_rx > 0 or stats.net_tx > 0:
            content.append(f"NET:  ↓{_format_bytes(stats.net_rx):>8}  ↑{_format_bytes(stats.net_tx):>8}\n")
        if stats.block_read > 0 or stats.block_write > 0:
            content.append(f"IO:   ↓{_format_bytes(stats.block_read):>8}  ↑{_format_bytes(stats.block_write):>8}\n")

        return Panel(content, border_style="blue", title="[bold]Resource Monitor[/bold]", padding=(1, 2))

    def start(self):
        self._start_time = time.time()
        self._live = Live(self._render(), console=console, refresh_per_second=4)
        self._live.start()

    def stop(self):
        if self._live:
            self._live.stop()
            self._live = None


class Engine:
    def __init__(self, config: Config, context: dict[str, Any] | None = None):
        self.config = config
        self.context: dict[str, Any] = context or {}
        self._plugin_manager: Any = None

    def set_plugin_manager(self, manager: Any):
        self._plugin_manager = manager

    def run_pipeline(self, pipeline_name: str, step_names: list[str] | None = None) -> PipelineResult:
        if pipeline_name not in self.config.pipelines:
            available = ", ".join(self.config.pipelines.keys())
            console.print(f"[red]Pipeline '{pipeline_name}' not found. Available: {available}[/red]")
            return PipelineResult(pipeline_name=pipeline_name, success=False)

        pipeline = self.config.pipelines[pipeline_name]
        self.context["pipeline"] = pipeline_name
        self.context["env"] = {**self.config.global_env, **pipeline.env, **os.environ}

        if pipeline.workdir:
            self.context["workdir"] = pipeline.workdir

        self._print_pipeline_header(pipeline)

        start_time = time.time()
        result = PipelineResult(pipeline_name=pipeline_name)

        target_steps = self._resolve_steps(pipeline, step_names)

        for step in target_steps:
            step_result = self._execute_step(step)
            result.step_results.append(step_result)
            result.success = result.success and (step_result.success or step_result.skipped)

            if not step_result.success and not step_result.skipped:
                if step.on_error == ErrorPolicy.STOP:
                    console.print(f"[red]  ✗ Step '{step.name}' failed. Stopping pipeline.[/red]")
                    break

        result.total_duration = time.time() - start_time
        self._print_pipeline_summary(result)
        return result

    def _resolve_steps(self, pipeline: Pipeline, step_names: list[str] | None) -> list[Step]:
        if not step_names:
            return pipeline.steps
        name_map = {s.name: s for s in pipeline.steps}
        resolved = []
        for name in step_names:
            if name not in name_map:
                console.print(f"[yellow]Warning: Step '{name}' not found in pipeline, skipping.[/yellow]")
                continue
            resolved.append(name_map[name])
        return resolved

    def _execute_step(self, step: Step) -> StepResult:
        if step.condition and not self._evaluate_condition(step.condition):
            console.print(f"[dim]  ◌ Step '{step.name}' skipped (condition not met)[/dim]")
            return StepResult(step_name=step.name, success=True, skipped=True)

        console.print(f"[cyan]  ▶ Step: {step.name}[/cyan]")
        start_time = time.time()

        attempts = 1 + (step.retry_count if step.on_error == ErrorPolicy.RETRY else 0)
        last_result: StepResult | None = None

        for attempt in range(attempts):
            if attempt > 0:
                console.print(f"[yellow]    Retrying ({attempt}/{step.retry_count}) after {step.retry_delay}s...[/yellow]")
                time.sleep(step.retry_delay)

            if step.plugin:
                last_result = self._execute_plugin_step(step, attempt)
            else:
                last_result = self._execute_command_step(step, attempt)

            if last_result.success:
                break

        if last_result:
            last_result.duration = time.time() - start_time
            self._print_step_result(last_result)

        return last_result or StepResult(step_name=step.name, success=False, error="No execution result")

    def _execute_command_step(self, step: Step, attempt: int) -> StepResult:
        use_isolation = step.isolation and step.isolation.enabled

        env = {**os.environ, **self.config.global_env, **step.env}
        if "env" in self.context:
            env.update(self.context["env"])

        workdir = step.workdir or self.context.get("workdir")

        monitor_display = None
        stats_callback = None
        peak_stats = None

        if step.monitor and use_isolation:
            monitor_display = _ResourceMonitorDisplay(step.name)
            stats_callback = monitor_display.update
            monitor_display.start()

        try:
            if use_isolation:
                return self._execute_isolated(step, env, workdir, stats_callback, attempt)
            else:
                return self._execute_local(step, env, workdir)

        finally:
            if monitor_display:
                peak_stats = monitor_display.peak_stats
                monitor_display.stop()

    def _execute_isolated(
        self,
        step: Step,
        env: dict[str, str],
        workdir: str | None,
        stats_callback: Any,
        attempt: int,
    ) -> StepResult:
        iso_cfg = step.isolation
        if iso_cfg is None:
            return self._execute_local(step, env, workdir)

        backend = get_backend(iso_cfg.backend)
        backend_name = "docker" if isinstance(backend, DockerBackend) else "local"

        volumes: list[tuple[str, str, str]] = []
        for vol in iso_cfg.volumes:
            parts = vol.split(":")
            if len(parts) >= 2:
                src, dst = parts[0], parts[1]
                mode = parts[2] if len(parts) >= 3 else "ro"
                volumes.append((src, dst, mode))

        exec_config = IsoExecConfig(
            backend=iso_cfg.backend,
            image=iso_cfg.image,
            auto_remove=iso_cfg.auto_remove,
            volumes=volumes,
            limits=IsoResourceLimits(
                cpu_limit=iso_cfg.limits.cpu,
                mem_limit=iso_cfg.limits.memory,
                memswap_limit=iso_cfg.limits.memory_swap,
                network_disabled=iso_cfg.limits.network_disabled,
                pids_limit=iso_cfg.limits.pids,
            ),
            pull_policy=iso_cfg.pull_policy,
        )

        try:
            result = backend.execute(
                command=step.command or "",
                config=exec_config,
                env=env,
                workdir=workdir,
                timeout=step.timeout,
                stats_callback=stats_callback,
            )
            return StepResult(
                step_name=step.name,
                success=result.success,
                output=result.stdout.strip(),
                error=result.stderr.strip(),
                return_code=result.return_code,
                retried=attempt,
                peak_stats=result.peak_stats,
                isolation_backend=backend_name,
            )
        except Exception as e:
            return StepResult(
                step_name=step.name,
                success=False,
                error=f"Isolated execution failed: {e}",
                retried=attempt,
                isolation_backend=backend_name,
            )

    def _execute_local(self, step: Step, env: dict[str, str], workdir: str | None) -> StepResult:
        try:
            proc = subprocess.Popen(
                step.command or "",
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env,
                cwd=workdir,
            )

            stdout_lines = []
            stderr_lines = []

            def read_stdout():
                for line in proc.stdout:
                    stdout_lines.append(line)
                    console.print(f"[dim]    {line.rstrip()}[/dim]")

            def read_stderr():
                for line in proc.stderr:
                    stderr_lines.append(line)

            import threading
            out_thread = threading.Thread(target=read_stdout, daemon=True)
            err_thread = threading.Thread(target=read_stderr, daemon=True)
            out_thread.start()
            err_thread.start()

            try:
                return_code = proc.wait(timeout=step.timeout)
            except subprocess.TimeoutExpired:
                proc.kill()
                return StepResult(
                    step_name=step.name,
                    success=False,
                    error=f"Command timed out after {step.timeout}s",
                    output="".join(stdout_lines).strip(),
                )

            out_thread.join(timeout=1)
            err_thread.join(timeout=1)

            return StepResult(
                step_name=step.name,
                success=return_code == 0,
                output="".join(stdout_lines).strip(),
                error="".join(stderr_lines).strip(),
                return_code=return_code,
            )
        except Exception as e:
            return StepResult(
                step_name=step.name,
                success=False,
                error=str(e),
            )

    def _execute_plugin_step(self, step: Step, attempt: int) -> StepResult:
        if not self._plugin_manager:
            return StepResult(
                step_name=step.name,
                success=False,
                error="No plugin manager configured",
                retried=attempt,
            )

        try:
            output = self._plugin_manager.execute(
                plugin_name=step.plugin,
                args=step.args,
                step_name=step.name,
                context=self.context,
            )
            return StepResult(
                step_name=step.name,
                success=True,
                output=str(output) if output else "",
                retried=attempt,
            )
        except Exception as e:
            return StepResult(
                step_name=step.name,
                success=False,
                error=str(e),
                retried=attempt,
            )

    def _evaluate_condition(self, condition: str) -> bool:
        eval_context = {
            "env": self.context.get("env", os.environ),
            "ctx": self.context,
        }
        try:
            return bool(eval(condition, {"__builtins__": {}}, eval_context))
        except Exception:
            console.print(f"[yellow]    Condition evaluation failed: {condition}[/yellow]")
            return False

    def _print_pipeline_header(self, pipeline: Pipeline):
        header = Text()
        header.append(f"Pipeline: {pipeline.name}", style="bold cyan")
        if pipeline.description:
            header.append(f"\n{pipeline.description}", style="dim")
        header.append(f"\nSteps: {len(pipeline.steps)}", style="white")
        console.print(Panel(header, border_style="cyan", padding=(1, 2)))

    def _print_step_result(self, result: StepResult):
        if result.skipped:
            return
        if result.success:
            status = "[green]OK[/green]"
        else:
            status = "[red]FAILED[/red]"

        iso_info = f" [{result.isolation_backend}]" if result.isolation_backend else ""
        console.print(f"  {status} {result.step_name}{iso_info} [dim]({result.duration:.2f}s)[/dim]")

        if result.peak_stats:
            peak_cpu = result.peak_stats.cpu_percent
            peak_mem = _format_bytes(result.peak_stats.mem_usage)
            console.print(f"    [dim]Peak: CPU {peak_cpu:.1f}% | MEM {peak_mem}[/dim]")

        if result.error:
            console.print(f"[red]    Error: {result.error[:200]}[/red]")
        if result.output:
            for line in result.output.split("\n")[:3]:
                console.print(f"[dim]    {line}[/dim]")

    def _print_pipeline_summary(self, result: PipelineResult):
        table = Table(title=f"Pipeline Result: {result.pipeline_name}", show_header=True)
        table.add_column("Step", style="white")
        table.add_column("Status", style="white")
        table.add_column("Backend", style="cyan")
        table.add_column("Duration", style="white", justify="right")
        table.add_column("Peak CPU", style="blue", justify="right")
        table.add_column("Peak MEM", style="green", justify="right")
        table.add_column("Details", style="dim")

        for r in result.step_results:
            if r.skipped:
                status = "[dim]SKIPPED[/dim]"
            elif r.success:
                status = "[green]OK[/green]"
            else:
                status = "[red]FAILED[/red]"

            backend = r.isolation_backend or "-"
            peak_cpu = f"{r.peak_stats.cpu_percent:.1f}%" if r.peak_stats else "-"
            peak_mem = _format_bytes(r.peak_stats.mem_usage) if r.peak_stats else "-"

            details = ""
            if r.error:
                details = r.error[:50]
            elif r.retried > 0:
                details = f"retried {r.retried}x"

            table.add_row(r.step_name, status, backend, f"{r.duration:.2f}s", peak_cpu, peak_mem, details)

        console.print()
        console.print(table)
        console.print()
        total_status = "[green]SUCCESS[/green]" if result.success else "[red]FAILED[/red]"
        console.print(f"  Total: {total_status} | Duration: {result.total_duration:.2f}s")
        console.print()
