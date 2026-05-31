from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from rich.console import Console
from rich.table import Table

console = Console()


@dataclass
class PluginInfo:
    name: str
    plugin_type: str
    path: str
    description: str = ""
    version: str = "0.1.0"


@dataclass
class _FileFingerprint:
    mtime: float
    size: int
    content_hash: str


class PluginBase(ABC):
    @abstractmethod
    def execute(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        ...

    def info(self) -> PluginInfo:
        return PluginInfo(
            name=self.__class__.__name__,
            plugin_type="python",
            path=str(Path(sys.modules[self.__class__.__module__].__file__ or ".")),
        )


class _ShadowCopyManager:
    _instance: _ShadowCopyManager | None = None
    _lock = threading.Lock()

    @classmethod
    def get(cls) -> _ShadowCopyManager:
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def __init__(self):
        self._base_dir = Path(tempfile.mkdtemp(prefix="opsflow_plugins_"))
        self._registry: dict[str, Path] = {}
        self._lock = threading.Lock()

    def get_shadow_path(self, original: Path) -> Path:
        with self._lock:
            key = str(original.resolve())
            content_hash = self._compute_hash(original)
            suffix = original.suffix
            shadow_name = f"{original.stem}_{content_hash[:12]}{suffix}"
            shadow_path = self._base_dir / shadow_name

            if shadow_path.exists():
                if key in self._registry and self._registry[key] == shadow_path:
                    return shadow_path

            self._safe_copy(original, shadow_path)

            if os.name != "nt" and shadow_path.suffix not in (".py",):
                try:
                    os.chmod(str(shadow_path), 0o755)
                except OSError:
                    pass

            self._registry[key] = shadow_path
            return shadow_path

    def refresh_shadow(self, original: Path) -> Path:
        with self._lock:
            key = str(original.resolve())
            if key in self._registry:
                old_shadow = self._registry[key]
                if old_shadow.exists():
                    try:
                        old_shadow.unlink()
                    except OSError:
                        pass

            self._registry.pop(key, None)

        return self.get_shadow_path(original)

    def _safe_copy(self, src: Path, dst: Path) -> None:
        tmp_dst = dst.with_suffix(dst.suffix + ".tmp")
        max_retries = 3
        for attempt in range(max_retries):
            try:
                shutil.copy2(str(src), str(tmp_dst))
                try:
                    tmp_dst.rename(dst)
                except OSError:
                    shutil.copy2(str(tmp_dst), str(dst))
                    try:
                        tmp_dst.unlink()
                    except OSError:
                        pass
                return
            except OSError as e:
                if attempt < max_retries - 1:
                    import time
                    time.sleep(0.1 * (attempt + 1))
                else:
                    raise RuntimeError(
                        f"Failed to create shadow copy of '{src}': {e}. "
                        f"The plugin file may be locked or being replaced."
                    ) from e

    def _compute_hash(self, path: Path) -> str:
        h = hashlib.sha256()
        max_retries = 3
        for attempt in range(max_retries):
            try:
                with open(path, "rb") as f:
                    while True:
                        chunk = f.read(8192)
                        if not chunk:
                            break
                        h.update(chunk)
                return h.hexdigest()
            except OSError as e:
                if attempt < max_retries - 1:
                    import time
                    time.sleep(0.1 * (attempt + 1))
                else:
                    raise RuntimeError(
                        f"Failed to read plugin file '{path}' for hashing: {e}. "
                        f"The file may be locked or being replaced."
                    ) from e

    def cleanup(self) -> None:
        with self._lock:
            for shadow in self._registry.values():
                try:
                    if shadow.exists():
                        shadow.unlink()
                except OSError:
                    pass
            self._registry.clear()
            try:
                if self._base_dir.exists():
                    shutil.rmtree(str(self._base_dir), ignore_errors=True)
            except Exception:
                pass


class BinaryPlugin:
    def __init__(self, path: Path):
        self.path = path
        self._info: PluginInfo | None = None
        self._shadow_mgr = _ShadowCopyManager.get()

    def execute(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        payload = json.dumps({"args": args, "context": context})
        max_retries = 2

        for attempt in range(max_retries):
            try:
                shadow_path = self._shadow_mgr.get_shadow_path(self.path)
            except RuntimeError as e:
                if attempt < max_retries - 1:
                    console.print(f"[yellow]    Shadow copy failed, retrying... ({e})[/yellow]")
                    import time
                    time.sleep(0.2)
                    continue
                raise RuntimeError(
                    f"Cannot create shadow copy for plugin '{self.path.name}': {e}. "
                    f"The file may be locked or being replaced."
                )

            try:
                proc = subprocess.run(
                    [str(shadow_path)],
                    input=payload,
                    capture_output=True,
                    text=True,
                    timeout=300,
                    shell=(os.name == "nt"),
                )

                if proc.returncode == 0:
                    return proc.stdout.strip()

                stderr = proc.stderr.strip()
                is_text_busy = "text file busy" in stderr.lower() or "etxtbsy" in stderr.lower()
                is_access_error = "permission denied" in stderr.lower() or "access is denied" in stderr.lower()

                if is_text_busy and attempt < max_retries - 1:
                    console.print(f"[yellow]    Plugin '{self.path.name}' is being replaced, refreshing shadow copy...[/yellow]")
                    import time
                    time.sleep(0.2)
                    shadow_path = self._shadow_mgr.refresh_shadow(self.path)
                    continue

                if is_access_error and attempt < max_retries - 1:
                    import time
                    time.sleep(0.3)
                    continue

                raise RuntimeError(
                    f"Plugin '{self.path.name}' exited with code {proc.returncode}: {stderr}"
                )

            except subprocess.TimeoutExpired:
                raise RuntimeError(f"Plugin '{self.path.name}' timed out")
            except FileNotFoundError:
                raise RuntimeError(f"Plugin binary not found: {self.path}")

        raise RuntimeError(f"Plugin '{self.path.name}' failed after {max_retries} attempts")

    def info(self) -> PluginInfo:
        if self._info:
            return self._info
        return PluginInfo(
            name=self.path.stem,
            plugin_type="binary",
            path=str(self.path),
        )


class _BrokenPlugin(PluginBase):
    def __init__(self, name: str, path: str, error: str):
        self._name = name
        self._path = path
        self._error = error

    def execute(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        raise RuntimeError(self._error)

    def info(self) -> PluginInfo:
        return PluginInfo(
            name=self._name,
            plugin_type="broken",
            path=self._path,
            description=f"BROKEN: {self._error[:80]}",
        )


class _IsolatedPythonPlugin(PluginBase):
    def __init__(self, name: str, original_path: str, shadow_mgr: _ShadowCopyManager):
        self._name = name
        self._original_path = original_path
        self._shadow_mgr = shadow_mgr
        self._instance: PluginBase | None = None
        self._load_error: str | None = None

    def _ensure_loaded(self) -> None:
        if self._instance is not None and self._load_error is None:
            return

        original = Path(self._original_path)
        try:
            shadow_path = self._shadow_mgr.get_shadow_path(original)
        except RuntimeError as e:
            self._load_error = str(e)
            raise RuntimeError(
                f"Cannot create shadow copy for Python plugin '{self._name}': {e}"
            )

        try:
            spec = importlib.util.spec_from_file_location(
                f"opsflow_plugin_{self._name}", str(shadow_path)
            )
            if not spec or not spec.loader:
                raise RuntimeError(f"Failed to create module spec for '{self._name}'")

            module = importlib.util.module_from_spec(spec)

            try:
                spec.loader.exec_module(module)
            except SyntaxError as e:
                raise RuntimeError(
                    f"Python plugin '{self._name}' has syntax errors (file may be partially written): {e}"
                )
            except Exception as e:
                raise RuntimeError(
                    f"Python plugin '{self._name}' failed to load: {e}"
                )

            plugin_instance: PluginBase | None = None
            for attr_name in dir(module):
                attr = getattr(module, attr_name)
                if (
                    isinstance(attr, type)
                    and issubclass(attr, PluginBase)
                    and attr is not PluginBase
                    and attr is not _IsolatedPythonPlugin
                    and attr is not _FunctionPluginWrapper
                ):
                    plugin_instance = attr()
                    break

            if plugin_instance is None and hasattr(module, "execute") and callable(module.execute):
                plugin_instance = _FunctionPluginWrapper(self._name, str(shadow_path), module.execute)

            if plugin_instance is None:
                raise RuntimeError(
                    f"Python plugin '{self._name}' contains no valid PluginBase subclass or execute function"
                )

            self._instance = plugin_instance
            self._load_error = None

        except RuntimeError:
            raise
        except Exception as e:
            self._load_error = str(e)
            raise RuntimeError(f"Unexpected error loading Python plugin '{self._name}': {e}")

    def execute(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        try:
            self._ensure_loaded()
        except RuntimeError as e:
            raise RuntimeError(f"Plugin load failed: {e}")

        try:
            result = self._instance.execute(args, context)
            return str(result) if result is not None else ""
        except Exception as e:
            error_msg = str(e)
            if "segfault" in error_msg.lower() or "segmentation" in error_msg.lower():
                raise RuntimeError(
                    f"Python plugin '{self._name}' crashed (segfault). "
                    f"If this plugin uses C extensions, consider running it as a binary plugin instead."
                )
            raise

    def force_reload(self) -> None:
        self._instance = None
        self._load_error = None
        original = Path(self._original_path)
        try:
            self._shadow_mgr.refresh_shadow(original)
        except Exception:
            pass

    def info(self) -> PluginInfo:
        if self._instance is not None:
            inner = self._instance.info()
            return PluginInfo(
                name=inner.name,
                plugin_type=inner.plugin_type,
                path=self._original_path,
                description=inner.description,
                version=inner.version,
            )
        return PluginInfo(
            name=self._name,
            plugin_type="python",
            path=self._original_path,
        )


class PluginManager:
    def __init__(self, plugin_dirs: list[str] | None = None):
        self._plugins: dict[str, PluginBase | BinaryPlugin] = {}
        self._plugin_dirs: list[Path] = []
        self._fingerprints: dict[str, _FileFingerprint] = {}
        self._shadow_mgr = _ShadowCopyManager.get()
        if plugin_dirs:
            for d in plugin_dirs:
                p = Path(d)
                if p.is_absolute():
                    self._plugin_dirs.append(p)
                else:
                    self._plugin_dirs.append(Path.cwd() / p)

    def discover(self) -> list[PluginInfo]:
        discovered: list[PluginInfo] = []
        for plugin_dir in self._plugin_dirs:
            if not plugin_dir.exists():
                continue
            for item in sorted(plugin_dir.iterdir()):
                if item.is_file():
                    infos = self._load_plugin(item)
                    discovered.extend(infos)
        return discovered

    def _get_fingerprint(self, path: Path) -> _FileFingerprint | None:
        try:
            stat = path.stat()
            h = hashlib.sha256()
            with open(path, "rb") as f:
                while True:
                    chunk = f.read(8192)
                    if not chunk:
                        break
                    h.update(chunk)
            return _FileFingerprint(
                mtime=stat.st_mtime,
                size=stat.st_size,
                content_hash=h.hexdigest(),
            )
        except OSError:
            return None

    def _has_file_changed(self, path: Path) -> bool:
        key = str(path.resolve())
        if key not in self._fingerprints:
            return True
        current = self._get_fingerprint(path)
        if current is None:
            return False
        stored = self._fingerprints[key]
        return current.content_hash != stored.content_hash

    def _load_plugin(self, path: Path) -> list[PluginInfo]:
        name = path.stem
        infos: list[PluginInfo] = []

        if self._is_python_plugin(path):
            plugins = self._load_python_plugins(name, path)
            if plugins:
                for plugin in plugins:
                    info = plugin.info()
                    self._plugins[info.name] = plugin
                    console.print(f"[green]  Loaded Python plugin: {info.name}[/green]")
                    infos.append(info)
            else:
                broken = self._try_load_broken_python(name, path)
                if broken:
                    self._plugins[name] = broken
                    infos.append(broken.info())

        elif self._is_binary_plugin(path):
            plugin = BinaryPlugin(path)
            info = plugin.info()
            self._plugins[name] = plugin
            console.print(f"[green]  Loaded binary plugin: {name}[/green]")
            infos.append(info)

        fp = self._get_fingerprint(path)
        if fp:
            self._fingerprints[str(path.resolve())] = fp

        return infos

    def _try_load_broken_python(self, name: str, path: Path) -> _BrokenPlugin | None:
        try:
            content = path.read_text(encoding="utf-8")
            if "PluginBase" in content or "def execute(" in content:
                error_msg = f"Plugin file '{name}' has valid markers but failed to load (file may be partially written or contain syntax errors)"
            else:
                error_msg = f"Plugin file '{name}' does not contain valid plugin code (file may be corrupted or still being written)"
        except Exception as e:
            error_msg = f"Cannot read plugin file '{name}': {e}"

        console.print(f"[red]  Broken Python plugin: {name} - {error_msg}[/red]")
        return _BrokenPlugin(name, str(path), error_msg)

    def _check_stale_plugin_file(self, plugin_name: str) -> str | None:
        for plugin_dir in self._plugin_dirs:
            if not plugin_dir.exists():
                continue
            for ext in (".py", ".exe", ".bat", ".cmd", ".ps1", ".sh"):
                candidate = plugin_dir / f"{plugin_name}{ext}"
                if candidate.exists():
                    try:
                        content = candidate.read_text(encoding="utf-8")
                        if "PluginBase" not in content and "def execute(" not in content:
                            return (
                                f"Plugin file '{plugin_name}' exists but does not contain valid plugin code. "
                                f"The file may be corrupted, still being written, or replaced mid-write. "
                                f"Path: {candidate}"
                            )
                        else:
                            return (
                                f"Plugin file '{plugin_name}' has valid markers but failed to load. "
                                f"The file may contain syntax errors or be partially written. "
                                f"Path: {candidate}"
                            )
                    except Exception as e:
                        return (
                            f"Plugin file '{plugin_name}' cannot be read: {e}. "
                            f"The file may be locked or being replaced. "
                            f"Path: {candidate}"
                        )
        return None

    def _reload_if_changed(self, plugin_name: str) -> bool:
        plugin = self._plugins.get(plugin_name)
        if plugin is None:
            return False

        original_path: Path | None = None
        if isinstance(plugin, BinaryPlugin):
            original_path = plugin.path
        elif isinstance(plugin, (_IsolatedPythonPlugin, _BrokenPlugin)):
            original_path = Path(plugin._path if isinstance(plugin, _BrokenPlugin) else plugin._original_path)

        if original_path is None or not original_path.exists():
            return False

        if not self._has_file_changed(original_path):
            return False

        console.print(f"[yellow]  Plugin '{plugin_name}' file changed, reloading...[/yellow]")

        if isinstance(plugin, _BrokenPlugin):
            new_plugins = self._load_python_plugins(plugin_name, original_path)
            if new_plugins:
                info = new_plugins[0].info()
                self._plugins[info.name] = new_plugins[0]
                fp = self._get_fingerprint(original_path)
                if fp:
                    self._fingerprints[str(original_path.resolve())] = fp
                console.print(f"[green]  Reloaded broken→fixed Python plugin: {plugin_name}[/green]")
                return True
            else:
                broken = self._try_load_broken_python(plugin_name, original_path)
                if broken:
                    self._plugins[plugin_name] = broken
                fp = self._get_fingerprint(original_path)
                if fp:
                    self._fingerprints[str(original_path.resolve())] = fp
                console.print(f"[red]  Plugin '{plugin_name}' still broken after file change[/red]")
                return False

        if isinstance(plugin, _IsolatedPythonPlugin):
            try:
                plugin.force_reload()
                fp = self._get_fingerprint(original_path)
                if fp:
                    self._fingerprints[str(original_path.resolve())] = fp
                console.print(f"[green]  Reloaded Python plugin: {plugin_name}[/green]")
                return True
            except Exception as e:
                console.print(f"[red]  Failed to reload plugin '{plugin_name}': {e}[/red]")
                return False

        elif isinstance(plugin, BinaryPlugin):
            try:
                self._shadow_mgr.refresh_shadow(original_path)
                fp = self._get_fingerprint(original_path)
                if fp:
                    self._fingerprints[str(original_path.resolve())] = fp
                console.print(f"[green]  Reloaded binary plugin: {plugin_name}[/green]")
                return True
            except Exception as e:
                console.print(f"[red]  Failed to reload plugin '{plugin_name}': {e}[/red]")
                return False

        return False

    def _is_python_plugin(self, path: Path) -> bool:
        if path.suffix != ".py":
            return False
        try:
            content = path.read_text(encoding="utf-8")
            return "PluginBase" in content or "def execute(" in content
        except Exception:
            return False

    def _is_binary_plugin(self, path: Path) -> bool:
        if path.suffix == ".py":
            return False
        if os.name == "nt":
            return path.suffix in (".exe", ".bat", ".cmd", ".ps1")
        return os.access(str(path), os.X_OK) or path.suffix in (".sh",)

    def _load_python_plugins(self, name: str, path: Path) -> list[PluginBase]:
        try:
            shadow_path = self._shadow_mgr.get_shadow_path(path)
        except RuntimeError as e:
            console.print(f"[yellow]  Failed to shadow-copy Python plugin '{name}': {e}[/yellow]")
            return []

        try:
            spec = importlib.util.spec_from_file_location(
                f"opsflow_plugin_{name}", str(shadow_path)
            )
            if not spec or not spec.loader:
                return []
            module = importlib.util.module_from_spec(spec)

            try:
                spec.loader.exec_module(module)
            except SyntaxError as e:
                console.print(
                    f"[yellow]  Python plugin '{name}' has syntax errors (file may be partially written): {e}[/yellow]"
                )
                return []
            except Exception as e:
                console.print(f"[yellow]  Failed to load Python plugin '{name}': {e}[/yellow]")
                return []

            plugins: list[PluginBase] = []
            for attr_name in dir(module):
                attr = getattr(module, attr_name)
                if (
                    isinstance(attr, type)
                    and issubclass(attr, PluginBase)
                    and attr is not PluginBase
                    and attr is not _IsolatedPythonPlugin
                    and attr is not _FunctionPluginWrapper
                ):
                    plugins.append(attr())

            if not plugins and hasattr(module, "execute") and callable(module.execute):
                plugins.append(_FunctionPluginWrapper(name, str(path), module.execute))

            wrapped: list[PluginBase] = []
            for p in plugins:
                info = p.info()
                isolated = _IsolatedPythonPlugin(info.name, str(path), self._shadow_mgr)
                isolated._instance = p
                wrapped.append(isolated)

            return wrapped
        except Exception as e:
            console.print(f"[yellow]  Failed to load Python plugin '{name}': {e}[/yellow]")
            return []

    def execute(self, plugin_name: str, args: dict[str, Any], step_name: str, context: dict[str, Any]) -> str:
        if plugin_name not in self._plugins:
            self.discover()

        if plugin_name not in self._plugins:
            stale = self._check_stale_plugin_file(plugin_name)
            if stale:
                raise RuntimeError(stale)
            available = ", ".join(self._plugins.keys())
            raise RuntimeError(
                f"Plugin '{plugin_name}' not found. Available: {available or 'none'}"
            )

        try:
            self._reload_if_changed(plugin_name)
        except Exception:
            pass

        plugin = self._plugins[plugin_name]

        try:
            return plugin.execute(args, context)
        except RuntimeError:
            raise
        except OSError as e:
            error_str = str(e)
            if "text file busy" in error_str.lower() or "etxtbsy" in error_str.lower():
                if isinstance(plugin, BinaryPlugin):
                    try:
                        self._shadow_mgr.refresh_shadow(plugin.path)
                        shadow_path = self._shadow_mgr.get_shadow_path(plugin.path)
                        payload = json.dumps({"args": args, "context": context})
                        proc = subprocess.run(
                            [str(shadow_path)],
                            input=payload,
                            capture_output=True,
                            text=True,
                            timeout=300,
                            shell=(os.name == "nt"),
                        )
                        if proc.returncode == 0:
                            return proc.stdout.strip()
                    except Exception as retry_e:
                        raise RuntimeError(
                            f"Plugin '{plugin_name}' is being replaced (text file busy). "
                            f"Retry also failed: {retry_e}"
                        )

                raise RuntimeError(
                    f"Plugin '{plugin_name}' is being replaced (text file busy). "
                    f"Please try again after the replacement is complete."
                )
            raise RuntimeError(f"OS error executing plugin '{plugin_name}': {e}")
        except Exception as e:
            error_str = str(e)
            if "segfault" in error_str.lower() or "segmentation fault" in error_str.lower():
                raise RuntimeError(
                    f"Plugin '{plugin_name}' crashed with segmentation fault. "
                    f"This is likely caused by a C extension error or a file being replaced during execution. "
                    f"Consider running this plugin as a binary plugin for process isolation."
                )
            raise RuntimeError(f"Unexpected error executing plugin '{plugin_name}': {e}")

    def get_plugin(self, name: str) -> PluginBase | BinaryPlugin | None:
        return self._plugins.get(name)

    def list_plugins(self) -> list[PluginInfo]:
        if not self._plugins:
            self.discover()
        return [p.info() for p in self._plugins.values()]

    def print_plugins_table(self):
        plugins = self.list_plugins()
        if not plugins:
            console.print("[yellow]No plugins found.[/yellow]")
            return

        table = Table(title="Available Plugins", show_header=True)
        table.add_column("Name", style="cyan")
        table.add_column("Type", style="green")
        table.add_column("Path", style="dim")
        table.add_column("Description", style="white")

        for p in plugins:
            table.add_row(p.name, p.plugin_type, p.path, p.description)

        console.print(table)


class _FunctionPluginWrapper(PluginBase):
    def __init__(self, name: str, path: str, fn: Any):
        self._name = name
        self._path = path
        self._fn = fn

    def execute(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        result = self._fn(args, context)
        return str(result) if result is not None else ""

    def info(self) -> PluginInfo:
        return PluginInfo(
            name=self._name,
            plugin_type="python",
            path=self._path,
        )


import atexit

atexit.register(lambda: _ShadowCopyManager.get().cleanup())
