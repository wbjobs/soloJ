import time
import json
import os
import shutil
import threading
import gc
from pathlib import Path
from tsdb.storage import TimeSeriesStorage
from tsdb.query import QueryEngine


STRESS_DATA_DIR = "./stress_test_data"


def cleanup():
    gc.collect()
    time.sleep(0.3)
    for attempt in range(5):
        try:
            if os.path.exists(STRESS_DATA_DIR):
                shutil.rmtree(STRESS_DATA_DIR)
            return
        except PermissionError:
            gc.collect()
            time.sleep(0.5 * (attempt + 1))
    if os.path.exists(STRESS_DATA_DIR):
        shutil.rmtree(STRESS_DATA_DIR, ignore_errors=True)


def test_concurrent_write_50_threads():
    print("=" * 60)
    print("TEST 1: 50-thread concurrent write stress test")
    print("=" * 60)
    cleanup()

    storage = TimeSeriesStorage(STRESS_DATA_DIR, flush_interval=2.0)
    num_threads = 50
    points_per_thread = 200
    base_ts = int(time.time())
    errors = []

    def writer(thread_id):
        try:
            for i in range(points_per_thread):
                metric = f"metric_t{thread_id % 10}"
                labels = {
                    "thread": str(thread_id),
                    "group": f"group_{thread_id % 5}",
                }
                storage.write(metric, labels, base_ts + i, thread_id * 100.0 + i)
        except Exception as e:
            errors.append((thread_id, str(e)))

    start_time = time.time()
    threads = []
    for t in range(num_threads):
        th = threading.Thread(target=writer, args=(t,))
        threads.append(th)
        th.start()

    for th in threads:
        th.join()

    elapsed = time.time() - start_time

    total_expected = num_threads * points_per_thread
    total_in_index = sum(info["count"] for info in storage._index.values())

    print(f"  Threads: {num_threads}")
    print(f"  Points per thread: {points_per_thread}")
    print(f"  Total expected: {total_expected}")
    print(f"  Total in index: {total_in_index}")
    print(f"  Errors: {len(errors)}")
    print(f"  Elapsed: {elapsed:.2f}s")
    print(f"  Throughput: {total_expected / elapsed:.0f} points/sec")

    if errors:
        print(f"  FIRST 3 ERRORS: {errors[:3]}")

    storage.close()

    assert total_in_index == total_expected, (
        f"Data loss! Expected {total_expected}, got {total_in_index}"
    )
    assert len(errors) == 0, f"Write errors occurred: {errors}"
    print("  PASSED!\n")
    return base_ts


def test_index_corruption_recovery(base_ts):
    print("=" * 60)
    print("TEST 2: Index corruption + recovery after restart")
    print("=" * 60)

    index_file = Path(STRESS_DATA_DIR) / "index.json"
    assert index_file.exists(), "Index file should exist"

    with open(index_file, "w", encoding="utf-8") as f:
        f.write('{"corrupted": true, "data": [1,2,3,')
    print("  Simulated index corruption (truncated JSON)")

    storage2 = TimeSeriesStorage(STRESS_DATA_DIR, flush_interval=2.0)

    total_recovered = sum(info["count"] for info in storage2._index.values())
    num_series = len(storage2._index)
    metrics = storage2.get_all_metrics()

    print(f"  Series recovered: {num_series}")
    print(f"  Total points recovered: {total_recovered}")
    print(f"  Metrics: {metrics}")

    query_engine = QueryEngine(storage2)
    results = query_engine.execute("metric_t0", base_ts, base_ts + 200)
    print(f"  Query metric_t0: {len(results)} series found")

    storage2.close()

    assert num_series > 0, "No series recovered after index corruption!"
    assert len(metrics) > 0, "No metrics recovered!"
    print("  PASSED!\n")


def test_simulated_crash_with_wal():
    print("=" * 60)
    print("TEST 3: Simulated crash - WAL recovery")
    print("=" * 60)
    cleanup()

    base_ts = int(time.time())
    storage = TimeSeriesStorage(STRESS_DATA_DIR, flush_interval=60.0)
    num_points = 100
    ts = base_ts + 10000

    for i in range(num_points):
        storage.write("crash_test", {"env": "prod"}, ts + i, float(i))

    storage._running = False
    storage._stop_event.set()
    if storage._flush_thread.is_alive():
        storage._flush_thread.join(timeout=5)

    index_file = Path(STRESS_DATA_DIR) / "index.json"
    with open(index_file, "w", encoding="utf-8") as f:
        f.write('{"broken')

    wal_file = Path(STRESS_DATA_DIR) / "wal.log"
    assert wal_file.exists(), "WAL file should exist (crash before close)"
    wal_size = wal_file.stat().st_size
    print(f"  WAL file size: {wal_size} bytes")

    storage2 = TimeSeriesStorage(STRESS_DATA_DIR, flush_interval=60.0)
    total_recovered = sum(info["count"] for info in storage2._index.values())
    print(f"  Total points recovered (from WAL + data rebuild): {total_recovered}")

    samples = storage2.read_series("crash_test", {"env": "prod"}, ts, ts + num_points - 1)
    print(f"  Samples queryable: {len(samples)}")

    storage2.close()

    assert len(samples) > 0, "No data recovered after simulated crash!"
    print("  PASSED!\n")


def test_write_read_consistency_under_concurrency():
    print("=" * 60)
    print("TEST 4: Write-read consistency under concurrency")
    print("=" * 60)
    cleanup()

    storage = TimeSeriesStorage(STRESS_DATA_DIR, flush_interval=1.0)
    base_ts = int(time.time())
    num_writers = 20
    points_per_writer = 50
    read_errors = []

    def writer(thread_id):
        for i in range(points_per_writer):
            storage.write(
                "consistency_metric",
                {"writer": str(thread_id)},
                base_ts + i,
                float(thread_id * 1000 + i),
            )

    def reader():
        time.sleep(0.5)
        for _ in range(10):
            try:
                storage.query_range(
                    "consistency_metric",
                    start=base_ts,
                    end=base_ts + points_per_writer,
                )
            except Exception as e:
                read_errors.append(str(e))
            time.sleep(0.2)

    writer_threads = [threading.Thread(target=writer, args=(t,)) for t in range(num_writers)]
    reader_thread = threading.Thread(target=reader)

    for t in writer_threads:
        t.start()
    reader_thread.start()

    for t in writer_threads:
        t.join()
    reader_thread.join()

    storage.close()

    storage2 = TimeSeriesStorage(STRESS_DATA_DIR, flush_interval=1.0)
    total_after_restart = sum(info["count"] for info in storage2._index.values())
    expected = num_writers * points_per_writer

    print(f"  Expected points: {expected}")
    print(f"  Points after restart: {total_after_restart}")
    print(f"  Read errors during concurrency: {len(read_errors)}")

    storage2.close()

    assert total_after_restart == expected, (
        f"Data loss after restart! Expected {expected}, got {total_after_restart}"
    )
    assert len(read_errors) == 0, f"Read errors: {read_errors}"
    print("  PASSED!\n")


def test_index_backup_fallback():
    print("=" * 60)
    print("TEST 5: Index backup file fallback")
    print("=" * 60)
    cleanup()

    storage = TimeSeriesStorage(STRESS_DATA_DIR, flush_interval=1.0)
    base_ts = int(time.time())
    for i in range(50):
        storage.write("backup_test", {"zone": "a"}, base_ts + i, float(i))
    storage._flush_index()
    storage.close()

    index_file = Path(STRESS_DATA_DIR) / "index.json"
    backup_file = Path(STRESS_DATA_DIR) / "index.json.bak"

    if not backup_file.exists():
        shutil.copy2(str(index_file), str(backup_file))

    with open(index_file, "w", encoding="utf-8") as f:
        f.write("NOT JSON AT ALL {{{")

    storage2 = TimeSeriesStorage(STRESS_DATA_DIR, flush_interval=1.0)
    total = sum(info["count"] for info in storage2._index.values())
    print(f"  Points recovered from backup: {total}")

    storage2.close()

    assert total == 50, f"Expected 50, got {total}"
    print("  PASSED!\n")


if __name__ == "__main__":
    try:
        base_ts = test_concurrent_write_50_threads()
        test_index_corruption_recovery(base_ts)
        test_simulated_crash_with_wal()
        test_write_read_consistency_under_concurrency()
        test_index_backup_fallback()

        print("=" * 60)
        print("ALL STRESS TESTS PASSED!")
        print("=" * 60)
    except AssertionError as e:
        print(f"\nTEST FAILED: {e}")
    except Exception as e:
        print(f"\nUNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cleanup()
