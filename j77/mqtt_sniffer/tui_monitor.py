import time
import threading
import signal
from collections import deque
from typing import Dict, Deque, List, Optional
from datetime import datetime

from rich.console import Console, Group
from rich.panel import Panel
from rich.live import Live
from rich.table import Table
from rich.text import Text
from rich.bar import Bar
from rich import box
from rich.progress import Progress, BarColumn, TextColumn, TimeElapsedColumn

from .sniffer import MQTTSniffer, MQTTPacket
from .storage import SQLiteStorage


class TrafficMonitor:
    def __init__(self, host: str = "localhost", port: int = 1883,
                 username: Optional[str] = None, password: Optional[str] = None,
                 db_path: Optional[str] = None, history_seconds: int = 60):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.db_path = db_path
        self.history_seconds = history_seconds
        
        self.console = Console()
        self.running = False
        self.start_time = time.time()
        
        self.total_packets = 0
        self.total_bytes = 0
        self.packets_per_second = 0
        self.bytes_per_second = 0
        self.current_second_packets = 0
        self.current_second_bytes = 0
        self.last_second_time = time.time()
        
        self.rate_history: Deque[int] = deque(maxlen=history_seconds)
        self.byte_rate_history: Deque[int] = deque(maxlen=history_seconds)
        self.topic_counts: Dict[str, int] = {}
        self.recent_packets: Deque[MQTTPacket] = deque(maxlen=50)
        
        self.peak_packets_per_second = 0
        self.peak_bytes_per_second = 0
        
        self.sniffer: Optional[MQTTSniffer] = None
        self.storage: Optional[SQLiteStorage] = None
        self.lock = threading.Lock()
        
        if db_path:
            self.storage = SQLiteStorage(db_path=db_path)
    
    def _on_packet(self, packet: MQTTPacket):
        now = time.time()
        
        with self.lock:
            self.total_packets += 1
            self.total_bytes += packet.payload_length or 0
            self.current_second_packets += 1
            self.current_second_bytes += packet.payload_length or 0
            
            topic = packet.topic or "unknown"
            self.topic_counts[topic] = self.topic_counts.get(topic, 0) + 1
            
            self.recent_packets.append(packet)
            
            if self.storage:
                self.storage.store_packet(packet.to_dict())
            
            if now - self.last_second_time >= 1.0:
                self.packets_per_second = self.current_second_packets
                self.bytes_per_second = self.current_second_bytes
                
                if self.packets_per_second > self.peak_packets_per_second:
                    self.peak_packets_per_second = self.packets_per_second
                if self.bytes_per_second > self.peak_bytes_per_second:
                    self.peak_bytes_per_second = self.bytes_per_second
                
                self.rate_history.append(self.packets_per_second)
                self.byte_rate_history.append(self.bytes_per_second)
                
                self.current_second_packets = 0
                self.current_second_bytes = 0
                self.last_second_time = now
    
    def _generate_waveform(self, data: Deque[int], max_val: int, width: int, height: int) -> str:
        if not data:
            return " " * width * height
        
        max_data = max(max(data), 1) if data else 1
        normalized = [int(d / max_data * height) for d in data]
        
        if len(normalized) < width:
            normalized = [0] * (width - len(normalized)) + normalized
        elif len(normalized) > width:
            normalized = normalized[-width:]
        
        lines = []
        for row in range(height):
            line = []
            threshold = height - row - 1
            for val in normalized:
                if val > threshold:
                    line.append("█")
                elif val == threshold:
                    line.append("▄")
                else:
                    line.append(" ")
            lines.append("".join(line))
        
        return "\n".join(lines)
    
    def _create_summary_panel(self) -> Panel:
        elapsed = time.time() - self.start_time
        hours, rem = divmod(elapsed, 3600)
        minutes, seconds = divmod(rem, 60)
        
        table = Table.grid(padding=(0, 2))
        table.add_column(style="cyan")
        table.add_column(style="bright_yellow")
        table.add_column(style="cyan")
        table.add_column(style="bright_yellow")
        
        table.add_row(
            "运行时间:", f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}",
            "总数据包:", f"{self.total_packets:,}"
        )
        table.add_row(
            "当前速率:", f"{self.packets_per_second:,} 包/秒",
            "总字节:", f"{self._format_bytes(self.total_bytes)}"
        )
        table.add_row(
            "峰值速率:", f"{self.peak_packets_per_second:,} 包/秒",
            "当前字节率:", f"{self._format_bytes(self.bytes_per_second)}/秒"
        )
        table.add_row(
            "主题数量:", f"{len(self.topic_counts)}",
            "字节峰值:", f"{self._format_bytes(self.peak_bytes_per_second)}/秒"
        )
        
        return Panel(
            table,
            title="[bold cyan]📊 流量统计[/bold cyan]",
            border_style="cyan",
            expand=True
        )
    
    def _create_waveform_panel(self) -> Panel:
        width = 80
        height = 10
        
        pps_wave = self._generate_waveform(
            self.rate_history, self.peak_packets_per_second, width, height
        )
        bps_wave = self._generate_waveform(
            self.byte_rate_history, self.peak_bytes_per_second, width, height
        )
        
        current_max_pps = max(list(self.rate_history) + [1])
        current_max_bps = max(list(self.byte_rate_history) + [1])
        
        content = Group(
            Text("数据包速率 (包/秒)", style="bold green"),
            Text(pps_wave, style="green"),
            Text(f"  0 {'─' * (width - 8)} {current_max_pps:,}", style="dim"),
            Text(""),
            Text("字节速率 (字节/秒)", style="bold magenta"),
            Text(bps_wave, style="magenta"),
            Text(f"  0 {'─' * (width - 8)} {self._format_bytes(current_max_bps)}", style="dim"),
        )
        
        return Panel(
            content,
            title=f"[bold green]📈 实时流量波形图 (最近 {self.history_seconds} 秒)[/bold green]",
            border_style="green",
            expand=True
        )
    
    def _create_topics_panel(self) -> Panel:
        table = Table(show_header=True, header_style="bold", box=box.SIMPLE)
        table.add_column("排名", style="dim", width=4)
        table.add_column("主题", style="cyan")
        table.add_column("计数", justify="right", style="yellow")
        table.add_column("占比", justify="right", width=12)
        table.add_column("流量条", width=20)
        
        sorted_topics = sorted(
            self.topic_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        max_count = max([c for _, c in sorted_topics] + [1])
        total = self.total_packets if self.total_packets > 0 else 1
        
        for i, (topic, count) in enumerate(sorted_topics, 1):
            pct = (count / total) * 100
            bar_width = int((count / max_count) * 20)
            bar = "█" * bar_width + "░" * (20 - bar_width)
            
            display_topic = topic
            if len(display_topic) > 30:
                display_topic = display_topic[:27] + "..."
            
            table.add_row(
                str(i),
                display_topic,
                f"{count:,}",
                f"{pct:.1f}%",
                bar
            )
        
        return Panel(
            table,
            title="[bold yellow]🏷️  Top 10 主题分布[/bold yellow]",
            border_style="yellow",
            expand=True
        )
    
    def _create_recent_packets_panel(self) -> Panel:
        table = Table(show_header=True, header_style="bold", box=box.SIMPLE)
        table.add_column("时间", style="dim", width=12)
        table.add_column("主题", style="cyan")
        table.add_column("长度", justify="right", style="yellow")
        table.add_column("载荷预览", style="green")
        
        packets = list(self.recent_packets)[-15:]
        
        for pkt in packets:
            ts = datetime.fromtimestamp(pkt.timestamp).strftime('%H:%M:%S.%f')[:-3]
            topic = pkt.topic or "unknown"
            if len(topic) > 20:
                topic = topic[:17] + "..."
            
            payload_hex = pkt.payload.hex() if pkt.payload else ""
            preview = payload_hex[:20] + "..." if len(payload_hex) > 20 else payload_hex
            
            table.add_row(
                ts,
                topic,
                str(pkt.payload_length or 0),
                preview
            )
        
        return Panel(
            table,
            title="[bold magenta]📨 最近数据包[/bold magenta]",
            border_style="magenta",
            expand=True
        )
    
    def _create_layout(self) -> Group:
        summary = self._create_summary_panel()
        waveform = self._create_waveform_panel()
        topics = self._create_topics_panel()
        recent = self._create_recent_packets_panel()
        
        return Group(
            summary,
            waveform,
            topics,
            recent
        )
    
    def _format_bytes(self, num: int) -> str:
        for unit in ['B', 'KB', 'MB', 'GB']:
            if num < 1024.0:
                return f"{num:.1f} {unit}"
            num /= 1024.0
        return f"{num:.1f} TB"
    
    def start(self):
        self.sniffer = MQTTSniffer(
            host=self.host,
            port=self.port,
            username=self.username,
            password=self.password
        )
        self.sniffer.set_packet_callback(self._on_packet)
        self.sniffer.start()
        self.running = True
        
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        self.console.clear()
        self.console.print("[bold green]🚀 MQTT 实时流量监控启动中...[/bold green]")
        time.sleep(0.5)
        
        try:
            with Live(
                self._create_layout(),
                refresh_per_second=4,
                console=self.console,
                screen=True
            ) as live:
                while self.running:
                    try:
                        live.update(self._create_layout())
                        time.sleep(0.1)
                    except Exception as e:
                        self.console.print(f"[red]渲染错误: {e}[/red]")
                        time.sleep(0.5)
        except KeyboardInterrupt:
            pass
        finally:
            self.stop()
    
    def _signal_handler(self, signum, frame):
        self.running = False
    
    def stop(self):
        self.running = False
        
        if self.sniffer:
            self.sniffer.stop()
        
        if self.storage:
            self.storage.stop()
        
        self.console.clear()
        self.console.print("\n[bold green]📊 监控结束 - 最终统计[/bold green]")
        self.console.print("=" * 60)
        self.console.print(f"运行时间: {self._format_duration(time.time() - self.start_time)}")
        self.console.print(f"总数据包: {self.total_packets:,}")
        self.console.print(f"总字节: {self._format_bytes(self.total_bytes)}")
        self.console.print(f"峰值速率: {self.peak_packets_per_second:,} 包/秒")
        self.console.print(f"峰值字节率: {self._format_bytes(self.peak_bytes_per_second)}/秒")
        self.console.print(f"主题数量: {len(self.topic_counts)}")
        self.console.print("=" * 60)
    
    def _format_duration(self, seconds: float) -> str:
        hours, rem = divmod(seconds, 3600)
        minutes, secs = divmod(rem, 60)
        return f"{int(hours):02d}:{int(minutes):02d}:{int(secs):02d}"
