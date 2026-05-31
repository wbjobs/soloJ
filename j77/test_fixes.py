import sys
import os
import time
import threading
import random
import tempfile
import shutil

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mqtt_sniffer.storage import SQLiteStorage
from mqtt_sniffer.protocol_infer import ProtocolInferer


def test_high_throughput_storage():
    print("=" * 70)
    print("测试 1: 高吞吐场景下 SQLite 写入性能")
    print("=" * 70)
    
    tmp_db = tempfile.mktemp(suffix='.db')
    storage = SQLiteStorage(
        db_path=tmp_db,
        batch_size=500,
        flush_interval=0.2,
        queue_maxsize=50000
    )
    
    TOTAL_PACKETS = 5000
    CONCURRENT_THREADS = 4
    PACKETS_PER_THREAD = TOTAL_PACKETS // CONCURRENT_THREADS
    
    print(f"目标: 写入 {TOTAL_PACKETS} 个包 (并发 {CONCURRENT_THREADS} 线程)")
    print(f"批量大小: {storage.batch_size}, 刷新间隔: {storage.flush_interval}s")
    print()
    
    def generate_packet(thread_id, packet_idx):
        topic = f"sensor/thread{thread_id}/temp"
        payload = bytes([
            0xAA,
            (packet_idx >> 8) & 0xFF,
            packet_idx & 0xFF,
            thread_id & 0xFF,
            random.randint(0, 255),
            random.randint(0, 255),
            random.randint(0, 255),
            random.randint(0, 255),
        ])
        
        return {
            'timestamp': time.time(),
            'packet_type': 'PUBLISH',
            'direction': 'incoming',
            'topic': topic,
            'qos': 0,
            'retain': False,
            'payload': payload.hex(),
            'payload_length': len(payload),
            'client_id': f'test_client_{thread_id}',
            'packet_id': packet_idx,
            'raw_packet': payload.hex()
        }
    
    def writer_thread(thread_id):
        for i in range(PACKETS_PER_THREAD):
            pkt = generate_packet(thread_id, i)
            storage.store_packet(pkt)
    
    start_time = time.time()
    
    threads = []
    for i in range(CONCURRENT_THREADS):
        t = threading.Thread(target=writer_thread, args=(i,))
        threads.append(t)
        t.start()
    
    monitor_start = time.time()
    while any(t.is_alive() for t in threads):
        elapsed = time.time() - monitor_start
        stats = storage.get_write_stats()
        rate = stats['total_written'] / elapsed if elapsed > 0 else 0
        print(f"\r进度: 队列={stats['queue_size']:5d} | "
              f"已写入={stats['total_written']:5d} | "
              f"丢弃={stats['dropped_count']:4d} | "
              f"速率={rate:8.1f}/s", end='')
        time.sleep(0.1)
    
    for t in threads:
        t.join()
    
    print()
    print(f"\n等待队列清空...")
    storage.stop(timeout=10.0)
    
    total_time = time.time() - start_time
    final_stats = storage.get_write_stats()
    db_info = storage.get_database_info()
    
    print()
    print("-" * 50)
    print("结果:")
    print(f"  总耗时: {total_time:.2f} 秒")
    print(f"  平均速率: {TOTAL_PACKETS / total_time:.1f} 包/秒")
    print(f"  峰值速率: > 1000 包/秒 (目标)")
    print(f"  数据库包数: {db_info['packet_count']}")
    print(f"  写入成功: {final_stats['total_written']}")
    print(f"  丢弃数量: {final_stats['dropped_count']}")
    print(f"  丢失率: {final_stats['dropped_count'] / TOTAL_PACKETS * 100:.4f}%")
    
    success = db_info['packet_count'] >= TOTAL_PACKETS * 0.95
    print(f"\n测试结果: {'通过' if success else '失败'} (目标丢失率 < 5%)")
    
    os.unlink(tmp_db)
    return success


def test_protocol_infer_robustness():
    print("\n" + "=" * 70)
    print("测试 2: 协议推断模块 - 二进制 Payload 处理健壮性")
    print("=" * 70)
    
    inferer = ProtocolInferer()
    
    test_cases = [
        ("正常二进制数据", b'\xAA\x00\x0C\x01\x00\x01\x00\x00\x00\x0A\x00\x14\xAB'),
        ("空 bytes", b''),
        ("None 值", None),
        ("字符串类型 (十六进制)", "AA000C0100010000000A0014AB"),
        ("字符串类型 (普通文本)", "hello world"),
        ("bytearray 类型", bytearray([0xAA, 0xBB, 0xCC])),
        ("memoryview 类型", memoryview(b'\xAA\xBB\xCC\xDD')),
        ("包含特殊字节", b'\x00\x01\x80\xFF\xFE\x7F'),
        ("单字节数据", b'\xAA'),
        ("Unicode 字符串", "测试中文"),
        ("整数类型", 12345),
        ("列表类型", [1, 2, 3, 4]),
        ("字典类型", {"key": "value"}),
        ("混合无效十六进制", "AAZZ0011GG"),
        ("超长字符串", "A" * 10000),
        ("包含 NULL 字节", b'\x00\x00\x00Hello\x00World\x00'),
        ("高位字节", b'\x80\x81\x82\xFE\xFF'),
    ]
    
    print(f"\n测试 {len(test_cases)} 种不同类型的输入...\n")
    
    success_count = 0
    crash_count = 0
    
    for i, (name, payload) in enumerate(test_cases, 1):
        try:
            result = inferer.add_packet(payload)
            print(f"  {i:2d}. {name:<30} -> {'接受' if result else '跳过':<4} (正常)")
            success_count += 1
        except Exception as e:
            print(f"  {i:2d}. {name:<30} -> 崩溃! {type(e).__name__}: {e}")
            crash_count += 1
    
    print()
    print("-" * 50)
    print(f"有效数据包: {len(inferer.packets)}")
    print(f"无效数据包计数: {inferer._invalid_packets}")
    print(f"崩溃次数: {crash_count}")
    
    if len(inferer.packets) > 0:
        print(f"\n执行推断分析 (含 {len(inferer.packets)} 个有效包)...")
        try:
            structure = inferer.infer_structure()
            print(f"推断完成: {len(structure.fields)} 个字段, {len(structure.recommendations)} 条建议")
            inferer.print_analysis(structure)
        except Exception as e:
            print(f"推断分析崩溃! {type(e).__name__}: {e}")
            crash_count += 1
    
    success = crash_count == 0
    print(f"\n测试结果: {'通过' if success else '失败'} (崩溃次数: {crash_count})")
    
    return success


def test_wal_mode():
    print("\n" + "=" * 70)
    print("测试 3: SQLite WAL 模式验证")
    print("=" * 70)
    
    tmp_db = tempfile.mktemp(suffix='.db')
    storage = SQLiteStorage(db_path=tmp_db)
    
    import sqlite3
    conn = sqlite3.connect(tmp_db)
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode")
    journal_mode = cursor.fetchone()[0]
    cursor.execute("PRAGMA synchronous")
    synchronous = cursor.fetchone()[0]
    conn.close()
    
    print(f"Journal 模式: {journal_mode}")
    print(f"Synchronous 模式: {synchronous}")
    print(f"WAL 目录文件: {os.path.exists(tmp_db + '-wal')}")
    print(f"SHM 目录文件: {os.path.exists(tmp_db + '-shm')}")
    
    storage.stop()
    os.unlink(tmp_db)
    for ext in ['-wal', '-shm', '-journal']:
        f = tmp_db + ext
        if os.path.exists(f):
            os.unlink(f)
    
    success = journal_mode == 'wal'
    print(f"\n测试结果: {'通过' if success else '失败'}")
    return success


def test_batch_writing():
    print("\n" + "=" * 70)
    print("测试 4: 批量写入功能验证")
    print("=" * 70)
    
    tmp_db = tempfile.mktemp(suffix='.db')
    storage = SQLiteStorage(
        db_path=tmp_db,
        batch_size=100,
        flush_interval=0.2,
        queue_maxsize=10000
    )
    
    print("写入 250 个包 (批量大小 100)...")
    
    for i in range(250):
        pkt = {
            'timestamp': time.time(),
            'packet_type': 'PUBLISH',
            'topic': f'test/batch/{i % 5}',
            'payload_length': 8,
            'payload': 'AABBCCDDEEFF0011',
            'raw_packet': 'AABBCCDDEEFF0011'
        }
        storage.store_packet(pkt)
        
        if i % 50 == 49:
            stats = storage.get_write_stats()
            print(f"  写入 {i+1:3d} 个包后: 队列={stats['queue_size']}, 已刷盘={stats['total_written']}")
    
    print("\n等待自动刷盘...")
    time.sleep(0.5)
    storage.flush(timeout=5.0)
    
    final_stats = storage.get_write_stats()
    db_info = storage.get_database_info()
    
    print()
    print(f"最终已写入: {final_stats['total_written']}")
    print(f"数据库计数: {db_info['packet_count']}")
    print(f"主题数: {db_info['topic_count']}")
    
    storage.stop()
    
    success = db_info['packet_count'] == 250 and db_info['topic_count'] == 5
    print(f"\n测试结果: {'通过' if success else '失败'}")
    
    os.unlink(tmp_db)
    for ext in ['-wal', '-shm', '-journal']:
        f = tmp_db + ext
        if os.path.exists(f):
            os.unlink(f)
    
    return success


def test_cli_help():
    print("\n" + "=" * 70)
    print("测试 5: CLI 帮助验证")
    print("=" * 70)
    
    import subprocess
    result = subprocess.run(
        [sys.executable, '-m', 'mqtt_sniffer.main', 'sniff', '--help'],
        capture_output=True,
        text=True,
        timeout=10
    )
    
    print(f"返回码: {result.returncode}")
    
    help_text = result.stdout
    has_high_throughput = '--high-throughput' in help_text
    has_batch_size = '--batch-size' in help_text
    has_flush_interval = '--flush-interval' in help_text
    has_queue_size = '--queue-size' in help_text
    
    print(f"--high-throughput 参数: {'存在' if has_high_throughput else '缺失'}")
    print(f"--batch-size 参数: {'存在' if has_batch_size else '缺失'}")
    print(f"--flush-interval 参数: {'存在' if has_flush_interval else '缺失'}")
    print(f"--queue-size 参数: {'存在' if has_queue_size else '缺失'}")
    
    success = all([has_high_throughput, has_batch_size, has_flush_interval, has_queue_size])
    print(f"\n测试结果: {'通过' if success else '失败'}")
    
    return success


def main():
    print("MQTT Sniffer - 修复验证测试")
    print(f"Python 版本: {sys.version}")
    print()
    
    results = []
    
    results.append(("高吞吐存储", test_high_throughput_storage()))
    results.append(("协议推断健壮性", test_protocol_infer_robustness()))
    results.append(("WAL 模式", test_wal_mode()))
    results.append(("批量写入", test_batch_writing()))
    results.append(("CLI 帮助", test_cli_help()))
    
    print("\n" + "=" * 70)
    print("测试总结")
    print("=" * 70)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "通过" if result else "失败"
        color = "\033[92m" if result else "\033[91m"
        print(f"  {name:<20}: {color}{status}\033[0m")
    
    print()
    print(f"总计: {passed}/{total} 测试通过")
    
    if passed == total:
        print("\n\033[92m所有测试通过! 修复验证成功。\033[0m")
        return 0
    else:
        print(f"\n\033[91m{total - passed} 个测试失败，请检查修复。\033[0m")
        return 1


if __name__ == "__main__":
    sys.exit(main())
