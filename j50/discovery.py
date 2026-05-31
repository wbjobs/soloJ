import socket
import threading
import time
import json
import uuid
import platform
from config import (
    UDP_DISCOVERY_PORT,
    BROADCAST_ADDR,
    DISCOVERY_INTERVAL,
    DISCOVERY_TIMEOUT,
    DISCOVERY_MAGIC
)


class Node:
    def __init__(self, node_id, ip, hostname, last_seen):
        self.node_id = node_id
        self.ip = ip
        self.hostname = hostname
        self.last_seen = last_seen

    def to_dict(self):
        return {
            'node_id': self.node_id,
            'ip': self.ip,
            'hostname': self.hostname,
            'last_seen': self.last_seen
        }


class NodeDiscovery:
    def __init__(self, on_node_found=None, on_node_lost=None):
        self.node_id = str(uuid.uuid4())
        self.hostname = platform.node()
        self.on_node_found = on_node_found
        self.on_node_lost = on_node_lost
        self.nodes = {}
        self.running = False
        self.broadcast_thread = None
        self.listen_thread = None
        self.cleanup_thread = None
        self._lock = threading.Lock()

    def get_local_ips(self):
        ips = []
        try:
            for info in socket.getaddrinfo(socket.gethostname(), None):
                ip = info[4][0]
                if ip not in ips and not ip.startswith('127.') and ':' not in ip:
                    ips.append(ip)
        except:
            pass
        if not ips:
            ips = ['127.0.0.1']
        return ips

    def start(self):
        self.running = True
        self.broadcast_thread = threading.Thread(target=self._broadcast_loop, daemon=True)
        self.listen_thread = threading.Thread(target=self._listen_loop, daemon=True)
        self.cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self.broadcast_thread.start()
        self.listen_thread.start()
        self.cleanup_thread.start()

    def stop(self):
        self.running = False

    def _broadcast_loop(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        while self.running:
            try:
                message = json.dumps({
                    'magic': DISCOVERY_MAGIC,
                    'node_id': self.node_id,
                    'hostname': self.hostname
                }).encode('utf-8')
                sock.sendto(message, (BROADCAST_ADDR, UDP_DISCOVERY_PORT))
            except Exception as e:
                print(f"Broadcast error: {e}")
            time.sleep(DISCOVERY_INTERVAL)
        sock.close()

    def _listen_loop(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(('', UDP_DISCOVERY_PORT))
        except:
            sock.bind(('0.0.0.0', UDP_DISCOVERY_PORT))
        sock.settimeout(1)

        while self.running:
            try:
                data, addr = sock.recvfrom(4096)
                message = json.loads(data.decode('utf-8'))
                if message.get('magic') == DISCOVERY_MAGIC:
                    node_id = message['node_id']
                    if node_id != self.node_id:
                        ip = addr[0]
                        hostname = message.get('hostname', 'unknown')
                        with self._lock:
                            is_new = node_id not in self.nodes
                            self.nodes[node_id] = Node(node_id, ip, hostname, time.time())
                        if is_new and self.on_node_found:
                            self.on_node_found(self.nodes[node_id])
            except socket.timeout:
                continue
            except Exception as e:
                continue
        sock.close()

    def _cleanup_loop(self):
        while self.running:
            current_time = time.time()
            with self._lock:
                expired = [
                    nid for nid, node in self.nodes.items()
                    if current_time - node.last_seen > DISCOVERY_TIMEOUT
                ]
                for nid in expired:
                    node = self.nodes.pop(nid)
                    if self.on_node_lost:
                        self.on_node_lost(node)
            time.sleep(2)

    def get_nodes(self):
        with self._lock:
            return list(self.nodes.values())
