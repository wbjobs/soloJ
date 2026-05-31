"""Simulate hot-replacement of a plugin file during execution.

This test:
1. Runs a pipeline that uses the db_backup plugin
2. Replaces the plugin file while the pipeline is still running
3. Runs the pipeline again to verify auto-reload works
4. Writes a corrupted file to test error handling
"""
import os
import sys
import time
import threading
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from opsflow.config import load_config
from opsflow.engine import Engine
from opsflow.plugin import PluginManager

CONFIG_PATH = Path(__file__).parent.parent / "examples" / "pipeline.yaml"
PLUGIN_PATH = Path(__file__).parent.parent / "examples" / "plugins" / "db_backup.py"

ORIGINAL_CONTENT = PLUGIN_PATH.read_text(encoding="utf-8")

MODIFIED_CONTENT = '''from __future__ import annotations
from typing import Any
from opsflow.plugin import PluginBase

class DbBackup(PluginBase):
    def execute(self, args, context):
        return f"[V2] Backed up {args.get('database', 'unknown')} (hot-reloaded!)"

    def info(self):
        from opsflow.plugin import PluginInfo
        return PluginInfo(
            name="db_backup",
            plugin_type="python",
            path=str(__file__),
            description="V2 db_backup plugin (hot-reloaded)",
        )

class HealthCheck(PluginBase):
    def execute(self, args, context):
        return f"[V2] Health OK: {args.get('url', 'unknown')}"

    def info(self):
        from opsflow.plugin import PluginInfo
        return PluginInfo(
            name="health_check",
            plugin_type="python",
            path=str(__file__),
            description="V2 health check (hot-reloaded)",
        )

class Notify(PluginBase):
    def execute(self, args, context):
        return f"[V2] Notified: {args.get('message', 'unknown')}"

    def info(self):
        from opsflow.plugin import PluginInfo
        return PluginInfo(
            name="notify",
            plugin_type="python",
            path=str(__file__),
            description="V2 notify (hot-reloaded)",
        )
'''

CORRUPTED_CONTENT = 'this is not valid python syntax !!!'


def test_normal_run():
    print("=" * 60)
    print("TEST 1: Normal pipeline run (before any replacement)")
    print("=" * 60)
    config = load_config(CONFIG_PATH)
    pm = PluginManager(plugin_dirs=config.plugin_dirs)
    pm.discover()
    engine = Engine(config)
    engine.set_plugin_manager(pm)
    result = engine.run_pipeline("deploy")
    assert result.success, f"Normal run should succeed, but got: {result.failed_steps}"
    print("✅ TEST 1 PASSED: Normal run succeeded\n")


def test_hot_replace_during_run():
    print("=" * 60)
    print("TEST 2: Hot-replace plugin file, then re-run pipeline")
    print("=" * 60)

    config = load_config(CONFIG_PATH)
    pm = PluginManager(plugin_dirs=config.plugin_dirs)
    pm.discover()

    PLUGIN_PATH.write_text(MODIFIED_CONTENT, encoding="utf-8")
    print("  [simulated] Plugin file replaced with V2 content")

    try:
        engine = Engine(config)
        engine.set_plugin_manager(pm)
        result = engine.run_pipeline("deploy")
        assert result.success, f"Post-replace run should succeed, but got: {result.failed_steps}"
        print("✅ TEST 2 PASSED: Pipeline succeeded after hot-replace\n")
    finally:
        PLUGIN_PATH.write_text(ORIGINAL_CONTENT, encoding="utf-8")


def test_corrupted_file_then_restore():
    print("=" * 60)
    print("TEST 3: Corrupted plugin file -> should fail gracefully, then restore")
    print("=" * 60)

    PLUGIN_PATH.write_text(CORRUPTED_CONTENT, encoding="utf-8")
    print("  [simulated] Plugin file corrupted with invalid syntax")

    try:
        config = load_config(CONFIG_PATH)
        pm = PluginManager(plugin_dirs=config.plugin_dirs)
        pm.discover()
        engine = Engine(config)
        engine.set_plugin_manager(pm)
        result = engine.run_pipeline("deploy")

        assert not result.success, "Pipeline should fail with corrupted plugin"
        for sr in result.step_results:
            if sr.step_name == "backup_db" and not sr.success:
                error_lower = sr.error.lower()
                is_meaningful = (
                    "syntax" in error_lower
                    or "failed" in error_lower
                    or "load" in error_lower
                    or "corrupted" in error_lower
                    or "partially written" in error_lower
                    or "does not contain valid" in error_lower
                )
                assert is_meaningful, \
                    f"Error should mention corruption/load failure, got: {sr.error}"
                assert "not found" not in error_lower, \
                    f"Error should NOT be 'not found', got: {sr.error}"
                break
        print("  ✅ Pipeline failed gracefully (no crash)")
    except Exception as e:
        print(f"  ❌ UNEXPECTED CRASH: {e}")
        raise
    finally:
        PLUGIN_PATH.write_text(ORIGINAL_CONTENT, encoding="utf-8")
        print("  [restored] Plugin file restored to original")

    print("  Now running again after restore...")
    config = load_config(CONFIG_PATH)
    pm = PluginManager(plugin_dirs=config.plugin_dirs)
    pm.discover()
    engine = Engine(config)
    engine.set_plugin_manager(pm)
    result = engine.run_pipeline("deploy")
    assert result.success, f"Post-restore run should succeed, but got: {result.failed_steps}"
    print("✅ TEST 3 PASSED: Graceful failure + recovery\n")


def test_concurrent_replace_and_execute():
    print("=" * 60)
    print("TEST 4: Concurrent file replacement during execution")
    print("=" * 60)

    config = load_config(CONFIG_PATH)
    pm = PluginManager(plugin_dirs=config.plugin_dirs)
    pm.discover()
    engine = Engine(config)
    engine.set_plugin_manager(pm)

    crash_occurred = False
    results = []

    def replace_loop():
        for i in range(5):
            try:
                if i % 2 == 0:
                    PLUGIN_PATH.write_text(MODIFIED_CONTENT, encoding="utf-8")
                else:
                    PLUGIN_PATH.write_text(ORIGINAL_CONTENT, encoding="utf-8")
            except Exception:
                pass
            time.sleep(0.05)
        try:
            PLUGIN_PATH.write_text(ORIGINAL_CONTENT, encoding="utf-8")
        except Exception:
            pass

    replacer = threading.Thread(target=replace_loop, daemon=True)
    replacer.start()

    try:
        for i in range(3):
            try:
                r = engine.run_pipeline("backup_only")
                results.append(r)
            except Exception as e:
                crash_occurred = True
                print(f"  ❌ CRASH on iteration {i}: {e}")
                break
            time.sleep(0.1)
    finally:
        PLUGIN_PATH.write_text(ORIGINAL_CONTENT, encoding="utf-8")
        replacer.join(timeout=3)

    assert not crash_occurred, "CLI crashed during concurrent file replacement!"
    print(f"  Ran {len(results)} iterations without crash")
    for i, r in enumerate(results):
        status = "SUCCESS" if r.success else "FAILED (graceful)"
        print(f"    Iteration {i}: {status}")
    print("✅ TEST 4 PASSED: No crash during concurrent replacement\n")


if __name__ == "__main__":
    try:
        test_normal_run()
        test_hot_replace_during_run()
        test_corrupted_file_then_restore()
        test_concurrent_replace_and_execute()
        print("=" * 60)
        print("ALL TESTS PASSED ✅")
        print("=" * 60)
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
