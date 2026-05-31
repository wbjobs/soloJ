import argparse
import sys
import time
import uuid
import signal
import json
from datetime import datetime
from colorama import init, Fore, Style

from .sniffer import MQTTSniffer
from .protocol_infer import ProtocolInferer
from .storage import SQLiteStorage
from .packet_editor import PacketEditor
from .tui_monitor import TrafficMonitor

init(autoreset=True)

running = True
session_id = str(uuid.uuid4())[:8]


def signal_handler(signum, frame):
    global running
    running = False
    print(f"\n{Fore.YELLOW}[*] 正在停止...{Style.RESET_ALL}")


def format_hex(data: bytes, max_len: int = 32) -> str:
    if not data:
        return ""
    hex_str = data.hex()
    if len(hex_str) > max_len:
        return hex_str[:max_len] + "..."
    return hex_str


def print_packet(packet, show_payload: bool = False):
    ts = datetime.fromtimestamp(packet.timestamp).strftime('%H:%M:%S.%f')[:-3]
    topic = packet.topic or "N/A"
    length = packet.payload_length or 0
    
    print(f"{Fore.CYAN}[{ts}] {Fore.GREEN}{packet.packet_type.name}{Style.RESET_ALL} "
          f"{Fore.MAGENTA}{topic}{Style.RESET_ALL} "
          f"{Fore.YELLOW}({length} bytes){Style.RESET_ALL}")
    
    if show_payload and packet.payload:
        hex_lines = []
        for i in range(0, len(packet.payload), 16):
            chunk = packet.payload[i:i+16]
            hex_part = ' '.join(f'{b:02X}' for b in chunk)
            ascii_part = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
            hex_lines.append(f"  {i:04X}: {hex_part:<48} {ascii_part}")
        for line in hex_lines:
            print(f"  {Fore.LIGHTBLACK_EX}{line}{Style.RESET_ALL}")


def cmd_sniff(args):
    print(f"{Fore.GREEN}{'='*60}{Style.RESET_ALL}")
    print(f"{Fore.GREEN}MQTT 数据包嗅探器 - 会话 ID: {session_id}{Style.RESET_ALL}")
    print(f"{Fore.GREEN}{'='*60}{Style.RESET_ALL}")
    print(f"Broker: {Fore.CYAN}{args.host}:{args.port}{Style.RESET_ALL}")
    print(f"数据库: {Fore.CYAN}{args.db}{Style.RESET_ALL}")
    print(f"自动分析: {Fore.CYAN}{'启用' if args.auto_analyze else '禁用'}{Style.RESET_ALL}")
    print(f"高吞吐模式: {Fore.CYAN}{'启用' if args.high_throughput else '禁用'}{Style.RESET_ALL}")
    
    if args.high_throughput:
        args.verbose = False
        print(f"{Fore.YELLOW}[!] 高吞吐模式已启用，将禁用详细输出{Style.RESET_ALL}")
    print()

    storage = SQLiteStorage(
        db_path=args.db,
        batch_size=args.batch_size,
        flush_interval=args.flush_interval,
        queue_maxsize=args.queue_size
    )
    inferer = ProtocolInferer()
    packet_count = 0
    last_analysis = 0
    last_stats = 0
    start_time = time.time()

    def on_packet(packet):
        nonlocal packet_count, last_analysis, last_stats
        packet_count += 1
        
        if not args.high_throughput:
            print_packet(packet, show_payload=args.verbose)
        
        storage.store_packet(packet.to_dict())
        
        if args.auto_analyze and packet.payload:
            inferer.add_packet(packet.payload)
            
            if (packet_count % args.analyze_interval == 0 and 
                len(inferer.packets) >= 5 and
                time.time() - last_analysis > 10):
                print(f"\n{Fore.YELLOW}[*] 执行协议结构分析...{Style.RESET_ALL}")
                structure = inferer.infer_structure()
                inferer.print_analysis(structure)
                storage.store_protocol_analysis(session_id, structure.to_dict(), len(inferer.packets))
                last_analysis = time.time()
        
        if args.high_throughput and packet_count % 1000 == 0:
            elapsed = time.time() - start_time
            rate = packet_count / elapsed if elapsed > 0 else 0
            write_stats = storage.get_write_stats()
            print(f"\r{Fore.CYAN}[统计] 捕获: {packet_count} | "
                  f"速率: {rate:.1f}/s | "
                  f"队列: {write_stats['queue_size']} | "
                  f"写入: {write_stats['total_written']} | "
                  f"丢弃: {write_stats['dropped_count']}{Style.RESET_ALL}", end='')

    sniffer = MQTTSniffer(
        host=args.host,
        port=args.port,
        username=args.username,
        password=args.password
    )
    sniffer.set_packet_callback(on_packet)

    signal.signal(signal.SIGINT, signal_handler)

    try:
        sniffer.start()
        print(f"{Fore.GREEN}[+] 嗅探已启动，按 Ctrl+C 停止{Style.RESET_ALL}\n")

        while running:
            time.sleep(0.1)

    except KeyboardInterrupt:
        pass
    finally:
        sniffer.stop()
        
        print(f"\n{Fore.YELLOW}[*] 正在将队列中的数据写入数据库...{Style.RESET_ALL}")
        storage.stop(timeout=30.0)
        
        elapsed = time.time() - start_time
        rate = packet_count / elapsed if elapsed > 0 else 0
        
        print(f"\n{Fore.GREEN}{'='*60}{Style.RESET_ALL}")
        print(f"{Fore.GREEN}会话总结{Style.RESET_ALL}")
        print(f"{Fore.GREEN}{'='*60}{Style.RESET_ALL}")
        print(f"运行时长: {Fore.CYAN}{elapsed:.1f} 秒{Style.RESET_ALL}")
        print(f"捕获数据包总数: {Fore.CYAN}{packet_count}{Style.RESET_ALL}")
        print(f"平均速率: {Fore.CYAN}{rate:.1f} 包/秒{Style.RESET_ALL}")
        
        write_stats = storage.get_write_stats()
        print(f"写入统计:")
        print(f"  - 已写入: {write_stats['total_written']}")
        print(f"  - 已丢弃: {write_stats['dropped_count']}")
        print(f"  - 丢失率: {(write_stats['dropped_count']/max(packet_count,1)*100):.2f}%")
        
        db_info = storage.get_database_info()
        print(f"\n数据库统计:")
        print(f"  - 总数据包: {db_info['packet_count']}")
        print(f"  - 主题数量: {db_info['topic_count']}")
        print(f"  - 总字节数: {db_info['total_bytes']}")
        print(f"  - 平均载荷长度: {db_info['avg_payload_length']} bytes")
        
        if inferer.packets and args.auto_analyze:
            print(f"\n{Fore.YELLOW}[*] 最终协议结构分析{Style.RESET_ALL}")
            structure = inferer.infer_structure()
            inferer.print_analysis(structure)
            storage.store_protocol_analysis(session_id, structure.to_dict(), len(inferer.packets))


def cmd_analyze(args):
    print(f"{Fore.GREEN}{'='*60}{Style.RESET_ALL}")
    print(f"{Fore.GREEN}协议结构分析模式{Style.RESET_ALL}")
    print(f"{Fore.GREEN}{'='*60}{Style.RESET_ALL}")
    print(f"数据库: {Fore.CYAN}{args.db}{Style.RESET_ALL}")
    
    storage = SQLiteStorage(args.db)
    inferer = ProtocolInferer()

    if args.topic:
        print(f"主题过滤: {Fore.CYAN}{args.topic}{Style.RESET_ALL}")
        packets = storage.get_packets(limit=args.limit, topic=args.topic)
    else:
        packets = storage.get_packets(limit=args.limit)

    if not packets:
        print(f"{Fore.RED}[-] 数据库中没有找到数据包{Style.RESET_ALL}")
        return

    print(f"加载了 {Fore.CYAN}{len(packets)}{Style.RESET_ALL} 个数据包进行分析\n")

    for pkt in packets:
        payload_hex = pkt.get('payload_hex')
        if payload_hex:
            try:
                payload = bytes.fromhex(payload_hex)
                inferer.add_packet(payload)
            except:
                pass

    if len(inferer.packets) < 3:
        print(f"{Fore.YELLOW}[!] 有效载荷数据包不足，无法进行可靠分析{Style.RESET_ALL}")
        return

    structure = inferer.infer_structure()
    inferer.print_analysis(structure)

    if args.save:
        storage.store_protocol_analysis(f"manual_{int(time.time())}", structure.to_dict(), len(inferer.packets))
        print(f"{Fore.GREEN}[+] 分析结果已保存到数据库{Style.RESET_ALL}")


def cmd_stats(args):
    print(f"{Fore.GREEN}{'='*60}{Style.RESET_ALL}")
    print(f"{Fore.GREEN}数据库统计信息{Style.RESET_ALL}")
    print(f"{Fore.GREEN}{'='*60}{Style.RESET_ALL}")
    print(f"数据库: {Fore.CYAN}{args.db}{Style.RESET_ALL}\n")

    storage = SQLiteStorage(args.db)
    db_info = storage.get_database_info()

    print(f"{Fore.YELLOW}总体统计:{Style.RESET_ALL}")
    print(f"  总数据包数: {Fore.CYAN}{db_info['packet_count']}{Style.RESET_ALL}")
    print(f"  主题数量: {Fore.CYAN}{db_info['topic_count']}{Style.RESET_ALL}")
    print(f"  总字节数: {Fore.CYAN}{db_info['total_bytes']}{Style.RESET_ALL}")
    print(f"  平均载荷长度: {Fore.CYAN}{db_info['avg_payload_length']} bytes{Style.RESET_ALL}")
    
    if 'total_written' in db_info:
        print(f"\n{Fore.YELLOW}写入统计:{Style.RESET_ALL}")
        print(f"  队列大小: {Fore.CYAN}{db_info.get('queue_size', 0)}{Style.RESET_ALL}")
        print(f"  累计写入: {Fore.CYAN}{db_info.get('total_written', 0)}{Style.RESET_ALL}")
        print(f"  累计丢弃: {Fore.CYAN}{db_info.get('dropped_count', 0)}{Style.RESET_ALL}")
    print()

    topic_stats = storage.get_topic_stats()
    if topic_stats:
        print(f"{Fore.YELLOW}主题统计 (Top 10):{Style.RESET_ALL}")
        print(f"  {'-'*60}")
        print(f"  {'主题':<30} {'包数':>8} {'总字节':>10} {'平均长度':>10}")
        print(f"  {'-'*60}")
        for stat in topic_stats[:10]:
            topic = stat['topic']
            if len(topic) > 28:
                topic = topic[:26] + ".."
            print(f"  {topic:<30} {stat['packet_count']:>8} {stat['total_bytes']:>10} {stat.get('avg_payload_length', 0):>10.1f}")
        print(f"  {'-'*60}")


def cmd_export(args):
    print(f"{Fore.GREEN}{'='*60}{Style.RESET_ALL}")
    print(f"{Fore.GREEN}数据导出{Style.RESET_ALL}")
    print(f"{Fore.GREEN}{'='*60}{Style.RESET_ALL}")
    print(f"数据库: {Fore.CYAN}{args.db}{Style.RESET_ALL}")
    print(f"输出文件: {Fore.CYAN}{args.output}{Style.RESET_ALL}\n")

    storage = SQLiteStorage(args.db)
    
    try:
        storage.export_to_json(args.output, limit=args.limit)
        print(f"{Fore.GREEN}[+] 数据成功导出到 {args.output}{Style.RESET_ALL}")
    except Exception as e:
        print(f"{Fore.RED}[-] 导出失败: {e}{Style.RESET_ALL}")


def cmd_list(args):
    print(f"{Fore.GREEN}{'='*60}{Style.RESET_ALL}")
    print(f"{Fore.GREEN}数据包列表{Style.RESET_ALL}")
    print(f"{Fore.GREEN}{'='*60}{Style.RESET_ALL}")
    print(f"数据库: {Fore.CYAN}{args.db}{Style.RESET_ALL}\n")

    storage = SQLiteStorage(args.db)
    
    if args.topic:
        packets = storage.get_packets(limit=args.limit, topic=args.topic)
    else:
        packets = storage.get_packets(limit=args.limit)

    if not packets:
        print(f"{Fore.YELLOW}[!] 没有找到数据包{Style.RESET_ALL}")
        return

    print(f"{'ID':<6} {'时间':<12} {'类型':<8} {'主题':<25} {'长度':>6}")
    print(f"{'-'*60}")
    
    for pkt in packets:
        pkt_id = pkt['id']
        dt = pkt.get('datetime', '').split(' ')[-1][:12] if pkt.get('datetime') else ''
        pkt_type = pkt.get('packet_type', '')[:8]
        topic = pkt.get('topic', '')
        if len(topic) > 24:
            topic = topic[:22] + ".."
        length = pkt.get('payload_length', 0)
        
        print(f"{pkt_id:<6} {dt:<12} {pkt_type:<8} {topic:<25} {length:>6}")


def cmd_clear(args):
    print(f"{Fore.YELLOW}[!] 此操作将删除数据库中的所有数据包{Style.RESET_ALL}")
    response = input(f"{Fore.YELLOW}确认继续? (yes/N): {Style.RESET_ALL}")
    
    if response.lower() == 'yes':
        storage = SQLiteStorage(args.db)
        storage.clear_packets()
        print(f"{Fore.GREEN}[+] 数据库已清空{Style.RESET_ALL}")
    else:
        print(f"{Fore.CYAN}[*] 操作已取消{Style.RESET_ALL}")


def cmd_tamper(args):
    print(f"{Fore.GREEN}{'='*60}{Style.RESET_ALL}")
    print(f"{Fore.GREEN}消息篡改与重发工具{Style.RESET_ALL}")
    print(f"{Fore.GREEN}{'='*60}{Style.RESET_ALL}")
    print(f"数据库: {Fore.CYAN}{args.db}{Style.RESET_ALL}")
    print(f"Broker: {Fore.CYAN}{args.host}:{args.port}{Style.RESET_ALL}")
    print()

    storage = SQLiteStorage(args.db)
    editor = PacketEditor(storage)

    if args.interactive:
        print(f"{Fore.CYAN}[*] 进入交互式编辑模式{Style.RESET_ALL}\n")
        editor.interactive_edit(
            packet_id=args.id,
            broker_host=args.host,
            broker_port=args.port,
            username=args.username,
            password=args.password
        )
        return

    if not args.modify:
        print(f"{Fore.RED}[-] 请指定修改操作 (--modify) 或使用交互式模式 (--interactive){Style.RESET_ALL}")
        print(f"\n可用修改操作:")
        print(f"  flip_bit:offset:bit       翻转指定偏移的指定位 (0-7)")
        print(f"  set_bit:offset:bit        置位指定偏移的指定位")
        print(f"  clear_bit:offset:bit      清零指定偏移的指定位")
        print(f"  set_byte:offset:value     设置指定偏移的字节值 (十进制或 0x)")
        print(f"  add:offset:value          指定偏移字节加上值")
        print(f"  sub:offset:value          指定偏移字节减去值")
        print(f"  xor:offset:value          指定偏移字节异或值")
        print(f"  flip_all_bits:offset      翻转指定偏移的所有位")
        print(f"\n示例:")
        print(f"  mqtt-sniffer tamper --id 123 --modify flip_bit:3:7")
        print(f"  mqtt-sniffer tamper --id 123 --modify set_byte:0:0xFF --topic new/topic")
        return

    try:
        modifications = []
        for mod_str in args.modify:
            mod = editor.parse_modification(mod_str)
            modifications.append(mod)
    except Exception as e:
        print(f"{Fore.RED}[-] 修改参数解析失败: {e}{Style.RESET_ALL}")
        sys.exit(1)

    try:
        result = editor.edit_and_publish(
            packet_id=args.id,
            modifications=modifications,
            broker_host=args.host,
            broker_port=args.port,
            username=args.username,
            password=args.password,
            new_topic=args.topic,
            qos=args.qos,
            dry_run=args.dry_run
        )
        
        print(f"\n{Fore.GREEN}{'='*60}{Style.RESET_ALL}")
        print(f"{Fore.GREEN}操作完成{Style.RESET_ALL}")
        print(f"{Fore.GREEN}{'='*60}{Style.RESET_ALL}")
        print(f"原始包 ID: {result.original_packet_id}")
        print(f"发布成功: {Fore.GREEN if result.published else Fore.RED}{result.published}{Style.RESET_ALL}")
        if result.publish_mid:
            print(f"消息 ID: {result.publish_mid}")
        if result.new_topic:
            print(f"发布主题: {result.new_topic}")
            
    except Exception as e:
        print(f"{Fore.RED}[-] 操作失败: {e}{Style.RESET_ALL}")
        sys.exit(1)


def cmd_monitor(args):
    print(f"{Fore.GREEN}启动 MQTT 实时流量监控...{Style.RESET_ALL}")
    print(f"Broker: {Fore.CYAN}{args.host}:{args.port}{Style.RESET_ALL}")
    if args.db:
        print(f"数据库: {Fore.CYAN}{args.db}{Style.RESET_ALL}")
    print(f"{Fore.YELLOW}按 Ctrl+C 退出监控{Style.RESET_ALL}\n")

    monitor = TrafficMonitor(
        host=args.host,
        port=args.port,
        username=args.username,
        password=args.password,
        db_path=args.db,
        history_seconds=args.history
    )

    try:
        monitor.start()
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"{Fore.RED}[-] 监控启动失败: {e}{Style.RESET_ALL}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        prog="mqtt-sniffer",
        description="MQTT 数据包嗅探与协议推断工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  mqtt-sniffer sniff -H localhost -p 1883                        # 开始嗅探
  mqtt-sniffer sniff --auto-analyze --verbose                    # 自动分析并显示载荷
  mqtt-sniffer sniff --high-throughput                            # 高吞吐模式 (>1000包/秒)
  mqtt-sniffer monitor -H localhost -p 1883                       # TUI 实时流量监控
  mqtt-sniffer tamper --id 123 --interactive                      # 交互式修改消息
  mqtt-sniffer tamper --id 123 --modify flip_bit:3:7             # 翻转第3字节第7位
  mqtt-sniffer tamper --id 123 --modify set_byte:0:0xFF          # 设置第0字节为0xFF
  mqtt-sniffer analyze --db mqtt_sniffer.db                      # 分析数据库中的包
  mqtt-sniffer stats --db mqtt_sniffer.db                        # 显示统计信息
  mqtt-sniffer export --output packets.json                      # 导出数据
        """
    )
    parser.add_argument("--db", default="mqtt_sniffer.db", help="SQLite 数据库路径")
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    sniff_parser = subparsers.add_parser("sniff", help="启动 MQTT 数据包嗅探")
    sniff_parser.add_argument("-H", "--host", default="localhost", help="MQTT Broker 地址")
    sniff_parser.add_argument("-p", "--port", type=int, default=1883, help="MQTT Broker 端口")
    sniff_parser.add_argument("-u", "--username", help="用户名")
    sniff_parser.add_argument("-P", "--password", help="密码")
    sniff_parser.add_argument("-v", "--verbose", action="store_true", help="显示详细载荷")
    sniff_parser.add_argument("--auto-analyze", action="store_true", help="启用自动协议分析")
    sniff_parser.add_argument("--analyze-interval", type=int, default=20, help="分析间隔包数")
    sniff_parser.add_argument("--high-throughput", action="store_true", help="高吞吐模式，优化 >1000包/秒 场景")
    sniff_parser.add_argument("--batch-size", type=int, default=500, help="数据库批量写入大小 (默认: 500)")
    sniff_parser.add_argument("--flush-interval", type=float, default=0.5, help="数据库刷新间隔秒数 (默认: 0.5)")
    sniff_parser.add_argument("--queue-size", type=int, default=100000, help="内存队列最大长度 (默认: 100000)")
    
    analyze_parser = subparsers.add_parser("analyze", help="分析协议结构")
    analyze_parser.add_argument("-t", "--topic", help="按主题过滤")
    analyze_parser.add_argument("-n", "--limit", type=int, default=1000, help="分析包数量")
    analyze_parser.add_argument("--save", action="store_true", help="保存分析结果")
    
    stats_parser = subparsers.add_parser("stats", help="显示数据库统计")
    
    list_parser = subparsers.add_parser("list", help="列出数据包")
    list_parser.add_argument("-t", "--topic", help="按主题过滤")
    list_parser.add_argument("-n", "--limit", type=int, default=50, help="显示数量")
    
    export_parser = subparsers.add_parser("export", help="导出数据")
    export_parser.add_argument("-o", "--output", default="mqtt_packets.json", help="输出文件")
    export_parser.add_argument("-n", "--limit", type=int, help="导出数量限制")
    
    clear_parser = subparsers.add_parser("clear", help="清空数据库")
    
    tamper_parser = subparsers.add_parser(
        "tamper", 
        help="消息篡改与重发 - 读取、修改并重新发布消息",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
修改操作格式: offset:operation[:params]

支持的操作:
  flip_bit:offset:bit       翻转指定偏移的指定位 (0-7)
  set_bit:offset:bit        置位指定偏移的指定位
  clear_bit:offset:bit      清零指定偏移的指定位
  set_byte:offset:value     设置指定偏移的字节值 (十进制或 0x)
  add:offset:value          指定偏移字节加上值
  sub:offset:value          指定偏移字节减去值
  xor:offset:value          指定偏移字节异或值
  flip_all_bits:offset      翻转指定偏移的所有位

示例:
  mqtt-sniffer tamper --id 123 --interactive
  mqtt-sniffer tamper --id 123 --modify flip_bit:3:7
  mqtt-sniffer tamper --id 123 --modify set_byte:0:0xFF --topic new/topic
  mqtt-sniffer tamper --id 123 --modify flip_bit:0:0 --modify flip_bit:3:7
        """
    )
    tamper_parser.add_argument("--id", type=int, required=True, help="要修改的数据包 ID")
    tamper_parser.add_argument("-H", "--host", default="localhost", help="MQTT Broker 地址")
    tamper_parser.add_argument("-p", "--port", type=int, default=1883, help="MQTT Broker 端口")
    tamper_parser.add_argument("-u", "--username", help="用户名")
    tamper_parser.add_argument("-P", "--password", help="密码")
    tamper_parser.add_argument("-m", "--modify", action="append", help="修改操作，可多次指定")
    tamper_parser.add_argument("-t", "--topic", help="指定发布主题 (默认使用原主题)")
    tamper_parser.add_argument("-q", "--qos", type=int, choices=[0, 1, 2], help="指定发布 QoS")
    tamper_parser.add_argument("-i", "--interactive", action="store_true", help="交互式编辑模式")
    tamper_parser.add_argument("--dry-run", action="store_true", help="仅显示修改，不实际发布")
    
    monitor_parser = subparsers.add_parser(
        "monitor", 
        help="实时流量监控 - 基于 Rich 的 TUI 界面，显示流量波形图"
    )
    monitor_parser.add_argument("-H", "--host", default="localhost", help="MQTT Broker 地址")
    monitor_parser.add_argument("-p", "--port", type=int, default=1883, help="MQTT Broker 端口")
    monitor_parser.add_argument("-u", "--username", help="用户名")
    monitor_parser.add_argument("-P", "--password", help="密码")
    monitor_parser.add_argument("--db", help="可选: 同时保存数据到 SQLite 数据库")
    monitor_parser.add_argument("--history", type=int, default=60, help="波形图历史秒数 (默认: 60)")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    try:
        if args.command == "sniff":
            cmd_sniff(args)
        elif args.command == "analyze":
            cmd_analyze(args)
        elif args.command == "stats":
            cmd_stats(args)
        elif args.command == "list":
            cmd_list(args)
        elif args.command == "export":
            cmd_export(args)
        elif args.command == "clear":
            cmd_clear(args)
        elif args.command == "tamper":
            cmd_tamper(args)
        elif args.command == "monitor":
            cmd_monitor(args)
    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}[*] 用户中断{Style.RESET_ALL}")
        sys.exit(0)
    except Exception as e:
        print(f"\n{Fore.RED}[-] 错误: {e}{Style.RESET_ALL}")
        sys.exit(1)


if __name__ == "__main__":
    main()
