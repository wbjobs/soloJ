import time
import json
import os
import shutil
import gc
from pathlib import Path
from tsdb.storage import TimeSeriesStorage
from tsdb.retention import RetentionManager, RetentionPolicy, DownsamplePolicy


RETENTION_DATA_DIR = "./retention_test_data"


def cleanup():
    gc.collect()
    time.sleep(0.2)
    for attempt in range(5):
        try:
            if os.path.exists(RETENTION_DATA_DIR):
                shutil.rmtree(RETENTION_DATA_DIR)
            return
        except PermissionError:
            gc.collect()
            time.sleep(0.5 * (attempt + 1))
    if os.path.exists(RETENTION_DATA_DIR):
        shutil.rmtree(RETENTION_DATA_DIR, ignore_errors=True)


def test_downsample_policy_model():
    print("=" * 60)
    print("TEST 1: DownsamplePolicy data model")
    print("=" * 60)

    ds = DownsamplePolicy(after_seconds=604800, granularity_seconds=3600, aggregation="avg")
    d = ds.to_dict()
    print(f"  to_dict: {d}")

    ds2 = DownsamplePolicy.from_dict(d)
    assert ds2.after_seconds == 604800
    assert ds2.granularity_seconds == 3600
    assert ds2.aggregation == "avg"
    print("  from_dict roundtrip OK")

    policy = RetentionPolicy(
        metric="cpu_usage",
        retention_seconds=2592000,
        downsample=[
            DownsamplePolicy(after_seconds=604800, granularity_seconds=3600, aggregation="avg"),
            DownsamplePolicy(after_seconds=2592000, granularity_seconds=86400, aggregation="avg"),
        ],
    )
    d = policy.to_dict()
    print(f"  RetentionPolicy to_dict: {json.dumps(d, indent=2)}")

    policy2 = RetentionPolicy.from_dict(d)
    assert policy2.metric == "cpu_usage"
    assert len(policy2.downsample) == 2
    assert policy2.downsample[0].after_seconds == 604800
    print("  RetentionPolicy roundtrip OK")

    effective = policy2.get_effective_policy(800000)
    assert effective is not None
    assert effective.granularity_seconds == 3600
    print(f"  Effective policy at age 800000s: granularity={effective.granularity_seconds}s")

    effective2 = policy2.get_effective_policy(3000000)
    assert effective2.granularity_seconds == 86400
    print(f"  Effective policy at age 3000000s: granularity={effective2.granularity_seconds}s")

    print("  PASSED!\n")


def test_storage_delete_range():
    print("=" * 60)
    print("TEST 2: Storage delete_series_range")
    print("=" * 60)
    cleanup()

    storage = TimeSeriesStorage(RETENTION_DATA_DIR, flush_interval=60.0)
    base_ts = 1000000

    for i in range(100):
        storage.write("temp", {"host": "a"}, base_ts + i, float(i))

    series_info = storage.find_series("temp")
    series_id = series_info[0]["series_id"]
    print(f"  Written 100 points, count={series_info[0]['count']}")

    deleted = storage.delete_series_range(series_id, end=base_ts + 50)
    print(f"  Deleted {deleted} points older than {base_ts + 50}")

    remaining = storage.read_series("temp", {"host": "a"})
    print(f"  Remaining points: {len(remaining)}")
    assert len(remaining) == 49
    assert remaining[0].timestamp == base_ts + 51

    storage.close()
    print("  PASSED!\n")


def test_storage_replace_range():
    print("=" * 60)
    print("TEST 3: Storage replace_series_range (downsample simulation)")
    print("=" * 60)
    cleanup()

    storage = TimeSeriesStorage(RETENTION_DATA_DIR, flush_interval=60.0)
    base_ts = 1000000

    for i in range(60):
        storage.write("cpu", {"host": "a"}, base_ts + i * 60, float(i))

    series_info = storage.find_series("cpu")
    series_id = series_info[0]["series_id"]
    print(f"  Written 60 points (1 per minute), count={series_info[0]['count']}")

    from tsdb.storage import Sample
    hourly = [
        Sample(timestamp=base_ts, value=10.0),
        Sample(timestamp=base_ts + 3600, value=20.0),
        Sample(timestamp=base_ts + 7200, value=30.0),
    ]

    replaced = storage.replace_series_range(
        series_id, base_ts, base_ts + 3600 * 3 - 1, hourly
    )
    print(f"  Replaced range with {replaced} aggregated points")

    remaining = storage.read_series("cpu", {"host": "a"})
    print(f"  Remaining points: {len(remaining)}")
    for s in remaining:
        print(f"    ts={s.timestamp}, val={s.value}")

    assert len(remaining) == 3
    assert remaining[0].timestamp == base_ts
    assert remaining[1].timestamp == base_ts + 3600

    storage.close()
    print("  PASSED!\n")


def test_retention_manager_downsample():
    print("=" * 60)
    print("TEST 4: RetentionManager full workflow (7d raw -> 1h avg)")
    print("=" * 60)
    cleanup()

    storage = TimeSeriesStorage(RETENTION_DATA_DIR, flush_interval=60.0)
    retention = RetentionManager(storage, check_interval=60.0)

    now = int(time.time())
    base_ts = now - 10 * 86400

    for day in range(10):
        for minute in range(0, 1440, 10):
            ts = base_ts + day * 86400 + minute * 60
            storage.write("cpu_usage", {"host": "server1"}, ts, 50.0 + day * 0.5)

    total_before = storage.find_series("cpu_usage")[0]["count"]
    print(f"  Written {total_before} points over 10 days")

    policy = RetentionPolicy(
        metric="cpu_usage",
        retention_seconds=30 * 86400,
        downsample=[
            DownsamplePolicy(
                after_seconds=7 * 86400,
                granularity_seconds=3600,
                aggregation="avg",
            ),
        ],
    )
    retention.add_policy(policy)

    retention.enforce_all_policies()

    total_after = storage.find_series("cpu_usage")[0]["count"]
    print(f"  Points after downsample: {total_after}")
    assert total_after < total_before, f"Expected fewer points, got {total_after}"

    recent_samples = storage.read_series(
        "cpu_usage", {"host": "server1"},
        start=now - 5 * 86400, end=now
    )
    print(f"  Recent data (last 5d): {len(recent_samples)} samples (should be raw)")

    old_samples = storage.read_series(
        "cpu_usage", {"host": "server1"},
        start=base_ts, end=base_ts + 86400
    )
    print(f"  Old data (day 1): {len(old_samples)} samples (should be downsampled)")

    if old_samples:
        print(f"  Old sample timestamps: {[s.timestamp for s in old_samples[:5]]}")

    retention.close()
    storage.close()
    print("  PASSED!\n")


def test_retention_manager_delete_expired():
    print("=" * 60)
    print("TEST 5: RetentionManager deletes expired data")
    print("=" * 60)
    cleanup()

    storage = TimeSeriesStorage(RETENTION_DATA_DIR, flush_interval=60.0)
    retention = RetentionManager(storage, check_interval=60.0)

    now = int(time.time())
    base_ts = now - 20 * 86400

    for day in range(20):
        ts = base_ts + day * 86400
        storage.write("logs_count", {"app": "web"}, ts, float(day * 100))

    total_before = storage.find_series("logs_count")[0]["count"]
    print(f"  Written {total_before} points over 20 days")

    policy = RetentionPolicy(
        metric="logs_count",
        retention_seconds=7 * 86400,
        downsample=[],
    )
    retention.add_policy(policy)
    retention.enforce_all_policies()

    total_after = storage.find_series("logs_count")[0]["count"]
    print(f"  Points after enforcement: {total_after}")
    assert total_after <= 7, f"Expected ~7 points, got {total_after}"

    retention.close()
    storage.close()
    print("  PASSED!\n")


def test_retention_policies_persist():
    print("=" * 60)
    print("TEST 6: Retention policies persist across restart")
    print("=" * 60)
    cleanup()

    storage = TimeSeriesStorage(RETENTION_DATA_DIR, flush_interval=60.0)
    retention = RetentionManager(storage, check_interval=60.0)

    policy = RetentionPolicy(
        metric="cpu_usage",
        retention_seconds=7 * 86400,
        downsample=[
            DownsamplePolicy(after_seconds=3 * 86400, granularity_seconds=3600, aggregation="avg"),
        ],
    )
    retention.add_policy(policy)

    policies = retention.list_policies()
    assert len(policies) == 1
    print(f"  Added policy: {policies[0].to_dict()}")

    retention.close()
    storage.close()

    storage2 = TimeSeriesStorage(RETENTION_DATA_DIR, flush_interval=60.0)
    retention2 = RetentionManager(storage2, check_interval=60.0)

    policies2 = retention2.list_policies()
    assert len(policies2) == 1
    assert policies2[0].metric == "cpu_usage"
    assert len(policies2[0].downsample) == 1
    print(f"  Reloaded policy: {policies2[0].to_dict()}")

    retention2.close()
    storage2.close()
    print("  PASSED!\n")


def test_retention_policy_remove():
    print("=" * 60)
    print("TEST 7: Remove retention policy")
    print("=" * 60)
    cleanup()

    storage = TimeSeriesStorage(RETENTION_DATA_DIR, flush_interval=60.0)
    retention = RetentionManager(storage, check_interval=60.0)

    policy = RetentionPolicy(metric="test_metric", retention_seconds=86400)
    retention.add_policy(policy)
    assert len(retention.list_policies()) == 1

    removed = retention.remove_policy("test_metric")
    assert removed
    assert len(retention.list_policies()) == 0
    print("  Policy removed successfully")

    removed2 = retention.remove_policy("nonexistent")
    assert not removed2
    print("  Removing nonexistent policy returns False")

    retention.close()
    storage.close()
    print("  PASSED!\n")


if __name__ == "__main__":
    try:
        test_downsample_policy_model()
        test_storage_delete_range()
        test_storage_replace_range()
        test_retention_manager_downsample()
        test_retention_manager_delete_expired()
        test_retention_policies_persist()
        test_retention_policy_remove()

        print("=" * 60)
        print("ALL RETENTION TESTS PASSED!")
        print("=" * 60)
    except AssertionError as e:
        print(f"\nTEST FAILED: {e}")
    except Exception as e:
        print(f"\nUNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cleanup()
