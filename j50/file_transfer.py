import socket
import os
import time
import json
import struct
import threading
import hashlib
from config import TCP_FILE_PORT, BUFFER_SIZE, CHUNK_SIZE


def format_speed(bytes_per_sec):
    if bytes_per_sec >= 1024 * 1024:
        return f"{bytes_per_sec / (1024 * 1024):.2f} MB/s"
    elif bytes_per_sec >= 1024:
        return f"{bytes_per_sec / 1024:.2f} KB/s"
    else:
        return f"{bytes_per_sec:.0f} B/s"


def format_size(size_bytes):
    if size_bytes >= 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"
    elif size_bytes >= 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.2f} MB"
    elif size_bytes >= 1024:
        return f"{size_bytes / 1024:.2f} KB"
    else:
        return f"{size_bytes} B"


def generate_file_id(file_path, file_size):
    file_name = os.path.basename(file_path)
    hash_input = f"{file_name}_{file_size}"
    return hashlib.md5(hash_input.encode('utf-8')).hexdigest()


class FrameProtocol:
    @staticmethod
    def send_frame(sock, data):
        frame = struct.pack('!I', len(data)) + data
        sock.sendall(frame)

    @staticmethod
    def recv_frame(sock):
        len_data = FrameProtocol._recv_exact(sock, 4)
        if not len_data:
            return None
        data_len = struct.unpack('!I', len_data)[0]
        if data_len == 0:
            return b''
        return FrameProtocol._recv_exact(sock, data_len)

    @staticmethod
    def _recv_exact(sock, size):
        data = b''
        remaining = size
        while remaining > 0:
            chunk = sock.recv(min(BUFFER_SIZE, remaining))
            if not chunk:
                return None
            data += chunk
            remaining -= len(chunk)
        return data


class FileSender:
    def __init__(self, target_ip, file_path, on_progress=None, on_complete=None, on_error=None):
        self.target_ip = target_ip
        self.file_path = file_path
        self.on_progress = on_progress
        self.on_complete = on_complete
        self.on_error = on_error
        self.running = False
        self.paused = False
        self.sock = None
        self._pause_lock = threading.Condition()
        self._status_lock = threading.Lock()

    def start(self):
        threading.Thread(target=self._send_file, daemon=True).start()

    def pause(self):
        with self._status_lock:
            self.paused = True
        with self._pause_lock:
            self._pause_lock.notify_all()

    def resume(self):
        with self._status_lock:
            self.paused = False
        with self._pause_lock:
            self._pause_lock.notify_all()

    def is_paused(self):
        with self._status_lock:
            return self.paused

    def stop(self):
        self.running = False
        with self._pause_lock:
            self._pause_lock.notify_all()
        if self.sock:
            try:
                self.sock.close()
            except:
                pass

    def _check_pause(self):
        with self._pause_lock:
            while self.paused and self.running:
                self._pause_lock.wait()

    def _send_file(self):
        self.running = True
        try:
            if not os.path.exists(self.file_path):
                raise FileNotFoundError(f"File not found: {self.file_path}")

            file_size = os.path.getsize(self.file_path)
            file_name = os.path.basename(self.file_path)
            file_id = generate_file_id(self.file_path, file_size)

            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            self.sock.settimeout(30)
            self.sock.connect((self.target_ip, TCP_FILE_PORT))

            header = json.dumps({
                'file_id': file_id,
                'filename': file_name,
                'size': file_size
            }).encode('utf-8')
            FrameProtocol.send_frame(self.sock, header)

            resume_data = FrameProtocol.recv_frame(self.sock)
            if resume_data is None:
                raise Exception("No response from receiver")
            resume_info = json.loads(resume_data.decode('utf-8'))

            if resume_info.get('rejected', False):
                raise Exception("Receiver rejected the file")

            start_offset = resume_info.get('resume_from', 0)
            is_resume = start_offset > 0

            sent_bytes = start_offset
            start_time = time.time()
            last_update = start_time

            if is_resume:
                elapsed = 0.001
                speed = 0
                progress = (sent_bytes / file_size) * 100 if file_size > 0 else 0
                if self.on_progress:
                    self.on_progress(sent_bytes, file_size, progress, speed, True)

            with open(self.file_path, 'rb') as f:
                f.seek(start_offset)
                while self.running and sent_bytes < file_size:
                    self._check_pause()
                    if not self.running:
                        break

                    chunk_size = min(CHUNK_SIZE, file_size - sent_bytes)
                    data = f.read(chunk_size)
                    if not data:
                        break
                    FrameProtocol.send_frame(self.sock, data)
                    sent_bytes += len(data)

                    current_time = time.time()
                    if current_time - last_update >= 0.3:
                        elapsed = current_time - start_time
                        speed = (sent_bytes - start_offset) / elapsed if elapsed > 0 else 0
                        progress = (sent_bytes / file_size) * 100 if file_size > 0 else 0
                        if self.on_progress:
                            self.on_progress(sent_bytes, file_size, progress, speed, False)
                        last_update = current_time

            if self.running:
                FrameProtocol.send_frame(self.sock, b'EOF')
                finish_ack = FrameProtocol.recv_frame(self.sock)
                if finish_ack:
                    finish_code = struct.unpack('!I', finish_ack)[0]
                    if finish_code == 2:
                        elapsed = time.time() - start_time
                        avg_speed = (sent_bytes - start_offset) / elapsed if elapsed > 0 else 0
                        if self.on_complete:
                            self.on_complete(file_name, file_size, avg_speed)
                    else:
                        raise Exception("Transfer incomplete")
                else:
                    raise Exception("No finish acknowledgment received")

        except Exception as e:
            if self.on_error:
                self.on_error(str(e))
        finally:
            self.running = False
            self.paused = False
            if self.sock:
                try:
                    self.sock.close()
                except:
                    pass
            self.sock = None


class FileReceiver:
    def __init__(self, save_dir='./received', on_progress=None, on_complete=None, on_error=None, on_request=None):
        self.save_dir = save_dir
        self.on_progress = on_progress
        self.on_complete = on_complete
        self.on_error = on_error
        self.on_request = on_request
        self.running = False
        self.server_sock = None
        self.accept_thread = None
        self.active_connections = []
        self._lock = threading.Lock()
        self._partial_files = {}
        self._partial_lock = threading.Lock()

        if not os.path.exists(self.save_dir):
            os.makedirs(self.save_dir)

        self._scan_partial_files()

    def _scan_partial_files(self):
        with self._partial_lock:
            self._partial_files.clear()
            for filename in os.listdir(self.save_dir):
                if filename.endswith('.part'):
                    base_name = filename[:-5]
                    file_path = os.path.join(self.save_dir, filename)
                    if os.path.isfile(file_path):
                        file_size = os.path.getsize(file_path)
                        self._partial_files[base_name] = {
                            'path': file_path,
                            'size': file_size
                        }

    def start(self):
        self.running = True
        self.accept_thread = threading.Thread(target=self._accept_loop, daemon=True)
        self.accept_thread.start()

    def stop(self):
        self.running = False
        with self._lock:
            for conn in self.active_connections:
                try:
                    conn.close()
                except:
                    pass
        if self.server_sock:
            try:
                self.server_sock.close()
            except:
                pass

    def _accept_loop(self):
        self.server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            self.server_sock.bind(('0.0.0.0', TCP_FILE_PORT))
        except:
            self.server_sock.bind(('', TCP_FILE_PORT))
        self.server_sock.listen(5)
        self.server_sock.settimeout(1)

        while self.running:
            try:
                conn, addr = self.server_sock.accept()
                conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
                with self._lock:
                    self.active_connections.append(conn)
                threading.Thread(
                    target=self._handle_connection,
                    args=(conn, addr),
                    daemon=True
                ).start()
            except socket.timeout:
                continue
            except Exception as e:
                if self.running:
                    print(f"Accept error: {e}")

        if self.server_sock:
            try:
                self.server_sock.close()
            except:
                pass

    def _handle_connection(self, conn, addr):
        try:
            conn.settimeout(60)

            header_data = FrameProtocol.recv_frame(conn)
            if header_data is None:
                return
            header = json.loads(header_data.decode('utf-8'))
            file_id = header['file_id']
            filename = header['filename']
            file_size = header['size']

            accept = True
            if self.on_request:
                accept = self.on_request(addr[0], filename, file_size)

            if not accept:
                response = json.dumps({'rejected': True, 'resume_from': 0}).encode('utf-8')
                FrameProtocol.send_frame(conn, response)
                return

            resume_from = 0
            save_path = None
            is_resume = False

            with self._partial_lock:
                if filename in self._partial_files:
                    partial_info = self._partial_files[filename]
                    if partial_info['size'] < file_size:
                        resume_from = partial_info['size']
                        save_path = partial_info['path']
                        is_resume = True

            if not save_path:
                temp_path = os.path.join(self.save_dir, f"{filename}.part")
                base, ext = os.path.splitext(temp_path)
                counter = 1
                while os.path.exists(temp_path):
                    temp_path = f"{base}_{counter}{ext}.part"
                    counter += 1
                save_path = temp_path

            response = json.dumps({
                'rejected': False,
                'resume_from': resume_from
            }).encode('utf-8')
            FrameProtocol.send_frame(conn, response)

            received_bytes = resume_from
            start_time = time.time()
            last_update = start_time

            file_mode = 'ab' if is_resume else 'wb'

            with open(save_path, file_mode) as f:
                while received_bytes < file_size:
                    data = FrameProtocol.recv_frame(conn)
                    if data is None:
                        with self._partial_lock:
                            self._partial_files[filename] = {
                                'path': save_path,
                                'size': received_bytes
                            }
                        raise Exception("Connection lost during transfer")
                    if data == b'EOF':
                        break
                    f.write(data)
                    received_bytes += len(data)

                    current_time = time.time()
                    if current_time - last_update >= 0.3:
                        elapsed = current_time - start_time
                        speed = (received_bytes - resume_from) / elapsed if elapsed > 0 else 0
                        progress = (received_bytes / file_size) * 100 if file_size > 0 else 0
                        if self.on_progress:
                            self.on_progress(filename, received_bytes, file_size, progress, speed, addr[0])
                        last_update = current_time

            if received_bytes != file_size:
                raise Exception(f"File size mismatch: expected {file_size}, got {received_bytes}")

            final_path = save_path[:-5] if save_path.endswith('.part') else save_path
            base, ext = os.path.splitext(final_path)
            counter = 1
            while os.path.exists(final_path):
                final_path = f"{base}_{counter}{ext}"
                counter += 1
            os.rename(save_path, final_path)

            with self._partial_lock:
                if filename in self._partial_files:
                    del self._partial_files[filename]

            FrameProtocol.send_frame(conn, struct.pack('!I', 2))
            elapsed = time.time() - start_time
            avg_speed = (received_bytes - resume_from) / elapsed if elapsed > 0 else 0
            if self.on_complete:
                self.on_complete(final_path, file_size, avg_speed, addr[0])

        except Exception as e:
            if self.on_error:
                self.on_error(str(e), addr[0])
        finally:
            with self._lock:
                if conn in self.active_connections:
                    self.active_connections.remove(conn)
            try:
                conn.close()
            except:
                pass
