import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import os
import queue
from discovery import NodeDiscovery
from file_transfer import FileSender, FileReceiver, format_speed, format_size


class FileTransferGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("局域网文件传输工具")
        self.root.geometry("800x600")
        self.root.minsize(700, 500)

        self.selected_file = None
        self.selected_node = None
        self.current_sender = None
        self.progress_queue = queue.Queue()
        self.log_queue = queue.Queue()
        self._is_paused = False

        self._setup_styles()
        self._build_ui()

        self.discovery = NodeDiscovery(
            on_node_found=self._on_node_found,
            on_node_lost=self._on_node_lost
        )
        self.receiver = FileReceiver(
            save_dir='./received',
            on_progress=self._on_receive_progress,
            on_complete=self._on_receive_complete,
            on_error=self._on_receive_error,
            on_request=None
        )

        self.discovery.start()
        self.receiver.start()

        self._update_local_info()
        self._process_queues()
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    def _setup_styles(self):
        style = ttk.Style()
        style.configure('Header.TLabel', font=('Microsoft YaHei', 12, 'bold'))
        style.configure('Info.TLabel', font=('Microsoft YaHei', 10))
        style.configure('Speed.TLabel', font=('Microsoft YaHei', 11, 'bold'), foreground='#2196F3')
        style.configure('Progress.Horizontal.TProgressbar', thickness=20)

    def _build_ui(self):
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        info_frame = ttk.LabelFrame(main_frame, text="本机信息", padding="8")
        info_frame.pack(fill=tk.X, pady=(0, 10))
        self.local_info_label = ttk.Label(info_frame, text="", style='Info.TLabel')
        self.local_info_label.pack(anchor=tk.W)

        content_frame = ttk.Frame(main_frame)
        content_frame.pack(fill=tk.BOTH, expand=True)

        left_frame = ttk.Frame(content_frame)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5))

        node_frame = ttk.LabelFrame(left_frame, text="在线节点", padding="8")
        node_frame.pack(fill=tk.BOTH, expand=True)

        self.node_listbox = tk.Listbox(node_frame, font=('Microsoft YaHei', 10), height=12)
        self.node_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        node_scroll = ttk.Scrollbar(node_frame, orient=tk.VERTICAL, command=self.node_listbox.yview)
        node_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.node_listbox.config(yscrollcommand=node_scroll.set)
        self.node_listbox.bind('<<ListboxSelect>>', self._on_node_select)

        right_frame = ttk.Frame(content_frame)
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(5, 0))

        file_frame = ttk.LabelFrame(right_frame, text="文件选择", padding="8")
        file_frame.pack(fill=tk.X)

        self.file_label = ttk.Label(file_frame, text="未选择文件", style='Info.TLabel', wraplength=280)
        self.file_label.pack(anchor=tk.W, pady=(0, 5))

        button_frame = ttk.Frame(file_frame)
        button_frame.pack(fill=tk.X)
        ttk.Button(button_frame, text="选择文件", command=self._choose_file).pack(side=tk.LEFT)
        self.send_button = ttk.Button(button_frame, text="发送", command=self._send_file, state=tk.DISABLED)
        self.send_button.pack(side=tk.RIGHT)

        progress_frame = ttk.LabelFrame(main_frame, text="传输进度", padding="8")
        progress_frame.pack(fill=tk.X, pady=(10, 0))

        self.status_label = ttk.Label(progress_frame, text="等待传输...", style='Info.TLabel')
        self.status_label.pack(anchor=tk.W, pady=(0, 5))

        self.progress_bar = ttk.Progressbar(
            progress_frame,
            mode='determinate',
            style='Progress.Horizontal.TProgressbar'
        )
        self.progress_bar.pack(fill=tk.X, pady=(0, 5))

        stats_frame = ttk.Frame(progress_frame)
        stats_frame.pack(fill=tk.X)
        self.progress_label = ttk.Label(stats_frame, text="0%", style='Info.TLabel')
        self.progress_label.pack(side=tk.LEFT)
        self.speed_label = ttk.Label(stats_frame, text="--", style='Speed.TLabel')
        self.speed_label.pack(side=tk.LEFT, padx=(20, 0))
        self.pause_button = ttk.Button(stats_frame, text="暂停", command=self._toggle_pause, state=tk.DISABLED, width=8)
        self.pause_button.pack(side=tk.RIGHT)

        log_frame = ttk.LabelFrame(main_frame, text="传输日志", padding="8")
        log_frame.pack(fill=tk.BOTH, expand=True, pady=(10, 0))

        self.log_text = tk.Text(log_frame, font=('Consolas', 9), height=8, state=tk.DISABLED)
        self.log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        log_scroll = ttk.Scrollbar(log_frame, orient=tk.VERTICAL, command=self.log_text.yview)
        log_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.log_text.config(yscrollcommand=log_scroll.set)

    def _update_local_info(self):
        ips = self.discovery.get_local_ips()
        hostname = self.discovery.hostname
        ip_str = ', '.join(ips) if ips else '127.0.0.1'
        self.local_info_label.config(text=f"主机名: {hostname}  |  IP: {ip_str}")

    def _on_node_found(self, node):
        self.log_queue.put(f"发现节点: {node.hostname} ({node.ip})")

    def _on_node_lost(self, node):
        self.log_queue.put(f"节点离线: {node.hostname} ({node.ip})")

    def _on_node_select(self, event):
        selection = self.node_listbox.curselection()
        if selection:
            self.selected_node = self.node_listbox.get(selection[0])
            self._update_send_button()
        else:
            self.selected_node = None

    def _choose_file(self):
        file_path = filedialog.askopenfilename(title="选择要发送的文件")
        if file_path:
            self.selected_file = file_path
            file_name = os.path.basename(file_path)
            file_size = os.path.getsize(file_path)
            self.file_label.config(text=f"{file_name}  ({format_size(file_size)})")
            self._update_send_button()

    def _update_send_button(self):
        if self.selected_file and self.selected_node:
            self.send_button.config(state=tk.NORMAL)
        else:
            self.send_button.config(state=tk.DISABLED)

    def _send_file(self):
        if not self.selected_file or not self.selected_node:
            return

        if self.current_sender and self.current_sender.running:
            messagebox.showinfo("提示", "当前有传输正在进行，请等待完成")
            return

        node_info = self.selected_node
        ip_start = node_info.rfind('(') + 1
        ip_end = node_info.rfind(')')
        target_ip = node_info[ip_start:ip_end]

        self.progress_bar['value'] = 0
        self.progress_label.config(text="0%")
        self.speed_label.config(text="--")
        self.status_label.config(text=f"正在发送: {os.path.basename(self.selected_file)}")
        self._is_paused = False
        self.pause_button.config(text="暂停", state=tk.NORMAL)

        self.current_sender = FileSender(
            target_ip=target_ip,
            file_path=self.selected_file,
            on_progress=self._on_send_progress,
            on_complete=self._on_send_complete,
            on_error=self._on_send_error
        )
        self.current_sender.start()
        self.send_button.config(state=tk.DISABLED)

    def _toggle_pause(self):
        if not self.current_sender or not self.current_sender.running:
            return

        if self._is_paused:
            self.current_sender.resume()
            self._is_paused = False
            self.pause_button.config(text="暂停")
            self.status_label.config(text=self.status_label.cget("text").replace(" (已暂停)", ""))
        else:
            self.current_sender.pause()
            self._is_paused = True
            self.pause_button.config(text="继续")
            current_text = self.status_label.cget("text")
            if " (已暂停)" not in current_text:
                self.status_label.config(text=current_text + " (已暂停)")

    def _on_send_progress(self, sent, total, progress, speed, is_resume=False):
        self.progress_queue.put(('send', sent, total, progress, speed, is_resume))

    def _on_send_complete(self, filename, size, avg_speed):
        self.progress_queue.put(('send_done', filename, size, avg_speed))
        self.log_queue.put(f"发送完成: {filename} ({format_size(size)}) - 平均速度: {format_speed(avg_speed)}")

    def _on_send_error(self, error_msg):
        self.progress_queue.put(('send_error', error_msg))
        self.log_queue.put(f"发送失败: {error_msg}")

    def _on_receive_progress(self, filename, received, total, progress, speed, from_ip):
        self.progress_queue.put(('recv', filename, received, total, progress, speed, from_ip))

    def _on_receive_complete(self, save_path, size, avg_speed, from_ip):
        self.log_queue.put(f"接收完成: {save_path} ({format_size(size)}) - 平均速度: {format_speed(avg_speed)}")

    def _on_receive_error(self, error_msg, from_ip):
        self.log_queue.put(f"接收失败 ({from_ip}): {error_msg}")

    def _process_queues(self):
        try:
            while True:
                item = self.progress_queue.get_nowait()
                if item[0] == 'send':
                    _, sent, total, progress, speed, is_resume = item
                    self.progress_bar['value'] = progress
                    self.progress_label.config(text=f"{progress:.1f}%  ({format_size(sent)} / {format_size(total)})")
                    self.speed_label.config(text=format_speed(speed))
                    if is_resume:
                        self.log_queue.put("检测到未完成传输，自动续传...")
                        self.status_label.config(text=f"续传中: {os.path.basename(self.selected_file) if self.selected_file else ''}")
                elif item[0] == 'send_done':
                    _, filename, size, avg_speed = item
                    self.progress_bar['value'] = 100
                    self.progress_label.config(text=f"100%  ({format_size(size)})")
                    self.speed_label.config(text=format_speed(avg_speed))
                    self.status_label.config(text=f"发送完成: {filename}")
                    self.send_button.config(state=tk.NORMAL)
                    self.pause_button.config(state=tk.DISABLED, text="暂停")
                    self._is_paused = False
                elif item[0] == 'send_error':
                    _, error_msg = item
                    self.status_label.config(text=f"发送失败: {error_msg}")
                    self.send_button.config(state=tk.NORMAL)
                    self.pause_button.config(state=tk.DISABLED, text="暂停")
                    self._is_paused = False
                elif item[0] == 'recv':
                    _, filename, received, total, progress, speed, from_ip = item
                    self.progress_bar['value'] = progress
                    self.progress_label.config(text=f"{progress:.1f}%  ({format_size(received)} / {format_size(total)})")
                    self.speed_label.config(text=format_speed(speed))
                    self.status_label.config(text=f"正在接收: {filename} (来自 {from_ip})")
        except queue.Empty:
            pass

        try:
            while True:
                log_msg = self.log_queue.get_nowait()
                self._append_log(log_msg)
        except queue.Empty:
            pass

        self._refresh_node_list()
        self.root.after(100, self._process_queues)

    def _refresh_node_list(self):
        nodes = self.discovery.get_nodes()
        current_selection = self.node_listbox.curselection()
        selected_text = None
        if current_selection:
            selected_text = self.node_listbox.get(current_selection[0])

        self.node_listbox.delete(0, tk.END)
        for node in nodes:
            display_text = f"{node.hostname}  ({node.ip})"
            self.node_listbox.insert(tk.END, display_text)
            if selected_text == display_text:
                idx = self.node_listbox.size() - 1
                self.node_listbox.selection_set(idx)

    def _append_log(self, message):
        from datetime import datetime
        timestamp = datetime.now().strftime('%H:%M:%S')
        self.log_text.config(state=tk.NORMAL)
        self.log_text.insert(tk.END, f"[{timestamp}] {message}\n")
        self.log_text.see(tk.END)
        self.log_text.config(state=tk.DISABLED)

    def _on_close(self):
        if self.current_sender:
            self.current_sender.stop()
        self.discovery.stop()
        self.receiver.stop()
        self.root.destroy()


def main():
    root = tk.Tk()
    app = FileTransferGUI(root)
    root.mainloop()


if __name__ == '__main__':
    main()
