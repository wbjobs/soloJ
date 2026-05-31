from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

import click
from rich.console import Console
from rich.panel import Panel
from rich.syntax import Syntax

from opsflow import __version__
from opsflow.config import Config, find_config_file, load_config
from opsflow.engine import Engine
from opsflow.plugin import PluginManager

console = Console()


def _load(cfg_path: str | None) -> tuple[Config, PluginManager]:
    if cfg_path:
        config = load_config(cfg_path)
    else:
        found = find_config_file()
        if not found:
            console.print("[red]No opsflow.yaml found. Use -c/--config to specify config file.[/red]")
            raise SystemExit(1)
        config = load_config(found)

    pm = PluginManager(plugin_dirs=config.plugin_dirs)
    pm.discover()
    return config, pm


def _complete_pipeline_names(ctx: click.Context, param: click.Parameter, incomplete: str) -> list[str]:
    try:
        cfg_path = ctx.params.get("config")
        config, _ = _load(cfg_path)
        return [name for name in config.pipelines if name.startswith(incomplete)]
    except Exception:
        return []


def _complete_step_names(ctx: click.Context, param: click.Parameter, incomplete: str) -> list[str]:
    try:
        cfg_path = ctx.params.get("config")
        config, _ = _load(cfg_path)
        pipeline_name = ctx.params.get("pipeline", "")
        if pipeline_name and pipeline_name in config.pipelines:
            steps = config.pipelines[pipeline_name].steps
            return [s.name for s in steps if s.name.startswith(incomplete)]
        return []
    except Exception:
        return []


def _complete_plugin_names(ctx: click.Context, param: click.Parameter, incomplete: str) -> list[str]:
    try:
        cfg_path = ctx.params.get("config")
        _, pm = _load(cfg_path)
        return [p.name for p in pm.list_plugins() if p.name.startswith(incomplete)]
    except Exception:
        return []


@click.group()
@click.version_option(version=__version__, prog_name="opsflow")
@click.option(
    "-c", "--config",
    type=click.Path(exists=False),
    default=None,
    help="Path to opsflow.yaml config file.",
)
@click.pass_context
def cli(ctx: click.Context, config: str | None):
    """OpsFlow - CLI ops scaffolding tool with task pipeline, plugins, and shell completion."""
    ctx.ensure_object(dict)
    ctx.obj["config_path"] = config


@cli.command()
@click.argument("pipeline", shell_complete=_complete_pipeline_names)
@click.option(
    "-s", "--step",
    "steps",
    multiple=True,
    shell_complete=_complete_step_names,
    help="Run specific step(s) only. Can be specified multiple times.",
)
@click.option(
    "-c", "--config",
    "config_opt",
    type=click.Path(exists=False),
    default=None,
    help="Override config file path.",
)
@click.option("--dry-run", is_flag=True, help="Show what would be executed without running.")
@click.pass_context
def run(ctx: click.Context, pipeline: str, steps: tuple[str, ...], config_opt: str | None, dry_run: bool):
    """Run a task pipeline."""
    cfg_path = config_opt or ctx.obj.get("config_path")
    config, pm = _load(cfg_path)

    if pipeline not in config.pipelines:
        available = ", ".join(config.pipelines.keys())
        console.print(f"[red]Pipeline '{pipeline}' not found. Available: {available}[/red]")
        raise SystemExit(1)

    if dry_run:
        _dry_run(config, pipeline, steps)
        return

    engine = Engine(config)
    engine.set_plugin_manager(pm)

    step_list = list(steps) if steps else None
    result = engine.run_pipeline(pipeline, step_list)

    if not result.success:
        raise SystemExit(1)


def _dry_run(config: Config, pipeline_name: str, steps: tuple[str, ...]):
    pipeline = config.pipelines[pipeline_name]
    lines = [f"Pipeline: {pipeline_name}", ""]
    target_steps = pipeline.steps
    if steps:
        name_map = {s.name: s for s in pipeline.steps}
        target_steps = [name_map[n] for n in steps if n in name_map]

    for i, step in enumerate(target_steps, 1):
        action = step.plugin or step.command or "unknown"
        kind = "plugin" if step.plugin else "command"
        lines.append(f"  {i}. [{kind}] {step.name}: {action}")
        if step.condition:
            lines.append(f"     condition: {step.condition}")
        if step.on_error.value != "stop":
            lines.append(f"     on_error: {step.on_error.value}")

    console.print(Panel("\n".join(lines), title="[bold]Dry Run[/bold]", border_style="yellow"))


@cli.command(name="list")
@click.option(
    "-c", "--config",
    "config_opt",
    type=click.Path(exists=False),
    default=None,
    help="Override config file path.",
)
@click.pass_context
def list_pipelines(ctx: click.Context, config_opt: str | None):
    """List all available pipelines and their steps."""
    from rich.table import Table

    cfg_path = config_opt or ctx.obj.get("config_path")
    config, pm = _load(cfg_path)

    if not config.pipelines:
        console.print("[yellow]No pipelines defined in config.[/yellow]")
        return

    table = Table(title="Pipelines", show_header=True)
    table.add_column("Pipeline", style="cyan bold")
    table.add_column("Steps", style="white")
    table.add_column("Description", style="dim")

    for name, pipeline in config.pipelines.items():
        step_names = " → ".join(s.name for s in pipeline.steps)
        table.add_row(name, step_names, pipeline.description)

    console.print(table)
    console.print()
    pm.print_plugins_table()


@cli.command()
@click.argument("plugin_name", required=False, shell_complete=_complete_plugin_names)
@click.option(
    "-c", "--config",
    "config_opt",
    type=click.Path(exists=False),
    default=None,
    help="Override config file path.",
)
@click.pass_context
def plugin(ctx: click.Context, plugin_name: str | None, config_opt: str | None):
    """List plugins or show plugin details."""
    cfg_path = config_opt or ctx.obj.get("config_path")
    config, pm = _load(cfg_path)

    if plugin_name:
        p = pm.get_plugin(plugin_name)
        if not p:
            console.print(f"[red]Plugin '{plugin_name}' not found.[/red]")
            raise SystemExit(1)
        info = p.info()
        console.print(Panel(
            f"Name: {info.name}\nType: {info.plugin_type}\nPath: {info.path}\nDescription: {info.description}",
            title=f"Plugin: {info.name}",
            border_style="green",
        ))
    else:
        pm.print_plugins_table()


@cli.command()
@click.argument("shell", type=click.Choice(["bash", "zsh", "fish", "powershell"]))
def completion(shell: str):
    """Generate shell completion script.

    \b
    Usage:
      bash:       eval "$(opsflow completion bash)"
      zsh:        eval "$(opsflow completion zsh)"
      fish:       opsflow completion fish | source
      powershell: opsflow completion powershell | Out-String | Invoke-Expression
    """
    if shell == "powershell":
        click.echo(_powershell_completion_script())
        return

    from click.shell_completion import get_completion_class

    comp_cls = get_completion_class(shell)
    if comp_cls is None:
        console.print(f"[red]Shell completion not supported for: {shell}[/red]")
        raise SystemExit(1)

    comp = comp_cls(cli, {}, "_OPSFLOW_COMPLETE", shell)
    script = comp.source()
    click.echo(script)


def _powershell_completion_script() -> str:
    prog_name = "opsflow"
    return f'''using namespace System.Management.Automation
using namespace System.Management.Automation.Language
Register-ArgumentCompleter -Native -CommandName {prog_name} -ScriptBlock {{
    param($wordToComplete, $commandAst, $cursorPosition)
    $commandElements = $commandAst.CommandElements
    $commands = @('run', 'list', 'plugin', 'completion', 'validate', 'init')
    $pipelineNames = @()
    $pluginNames = @()

    try {{
        $yamlFile = Join-Path $PWD "opsflow.yaml"
        if (-not (Test-Path $yamlFile)) {{ $yamlFile = Join-Path $PWD "opsflow.yml" }}
        if (Test-Path $yamlFile) {{
            $content = Get-Content $yamlFile -Raw
            if ($content -match 'pipelines:') {{
                $matches = [regex]::Matches($content, '(?m)^\\s{2}(\\w+):')
                foreach ($m in $matches) {{ $pipelineNames += $m.Groups[1].Value }}
            }}
        }}
    }} catch {{}}

    $command = ''
    foreach ($el in $commandElements) {{
        if ($el -is [StringConstantExpressionAst]) {{
            $command = $el.Value
        }}
    }}

    $previousWord = ''
    for ($i = $commandElements.Count - 1; $i -ge 1; $i--) {{
        $el = $commandElements[$i]
        if ($el -is [StringConstantExpressionAst]) {{
            $previousWord = $el.Value
            break
        }}
    }}

    if ($previousWord -in $commands) {{
        switch ($previousWord) {{
            'run' {{
                $pipelineNames | Where-Object {{ $_ -like "$wordToComplete*" }} | ForEach-Object {{
                    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
                }}
            }}
            'plugin' {{
                $pluginNames | Where-Object {{ $_ -like "$wordToComplete*" }} | ForEach-Object {{
                    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
                }}
            }}
            'completion' {{
                @('bash', 'zsh', 'fish', 'powershell') | Where-Object {{ $_ -like "$wordToComplete*" }} | ForEach-Object {{
                    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
                }}
            }}
        }}
        return
    }}

    if ($wordToComplete -eq '' -or $wordToComplete.StartsWith('-')) {{
        @('-c', '--config', '--version', '--help') | Where-Object {{ $_ -like "$wordToComplete*" }} | ForEach-Object {{
            [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterName', $_)
        }}
    }}

    $commands | Where-Object {{ $_ -like "$wordToComplete*" }} | ForEach-Object {{
        [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }}
}}
'''


@cli.command()
@click.option(
    "-c", "--config",
    "config_opt",
    type=click.Path(exists=False),
    default=None,
    help="Override config file path.",
)
@click.pass_context
def validate(ctx: click.Context, config_opt: str | None):
    """Validate the configuration file."""
    cfg_path = config_opt or ctx.obj.get("config_path")
    try:
        config, pm = _load(cfg_path)
    except Exception as e:
        console.print(f"[red]Configuration error: {e}[/red]")
        raise SystemExit(1)

    errors = []
    for name, pipeline in config.pipelines.items():
        for step in pipeline.steps:
            if step.plugin and not pm.get_plugin(step.plugin):
                errors.append(f"Pipeline '{name}', step '{step.name}': plugin '{step.plugin}' not found")

    if errors:
        console.print("[red]Validation failed:[/red]")
        for err in errors:
            console.print(f"  [red]✗ {err}[/red]")
        raise SystemExit(1)
    else:
        console.print(f"[green]✓ Configuration valid. {len(config.pipelines)} pipeline(s), {len(pm.list_plugins())} plugin(s).[/green]")


@cli.command()
def init():
    """Create a sample opsflow.yaml configuration file."""
    sample = """\
pipelines:
  deploy:
    description: "Production deployment pipeline"
    steps:
      - name: backup_db
        plugin: db-backup
        args:
          host: localhost
          database: myapp
        on_error: stop

      - name: pull_code
        command: git pull origin main
        on_error: stop

      - name: install_deps
        command: pip install -r requirements.txt
        on_error: stop

      - name: restart_service
        command: systemctl restart myapp
        on_error: retry
        retry_count: 3
        retry_delay: 5

  rollback:
    description: "Rollback to previous version"
    steps:
      - name: stop_service
        command: systemctl stop myapp
        on_error: skip

      - name: restore_db
        plugin: db-restore
        args:
          host: localhost
          database: myapp
        on_error: stop

      - name: start_service
        command: systemctl start myapp
        on_error: retry
        retry_count: 3

plugin_dirs:
  - ./plugins

global_env:
  DEPLOY_ENV: production
"""
    target = Path("opsflow.yaml")
    if target.exists():
        console.print(f"[yellow]File {target} already exists. Skipping.[/yellow]")
        return

    target.write_text(sample, encoding="utf-8")
    console.print(f"[green]✓ Created {target}[/green]")
    console.print("[dim]Edit the file to customize your pipelines, then run: opsflow run deploy[/dim]")

    plugins_dir = Path("plugins")
    if not plugins_dir.exists():
        plugins_dir.mkdir()
        console.print(f"[green]✓ Created {plugins_dir}/ directory[/green]")
