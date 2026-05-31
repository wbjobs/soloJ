import sqlite3
import json
import time
import threading
import queue
from typing import List, Dict, Any, Optional, Tuple
from contextlib import contextmanager
from datetime import datetime
from collections import defaultdict


class SQLiteStorage:
    def __init__(self, db_path: str = "mqtt_sniffer.db", 
                 batch_size: int = 500, 
                 flush_interval: float = 0.5,
                 queue_maxsize: int = 100000):
        self.db_path = db_path
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.queue_maxsize = queue_maxsize
        
        self._write_queue: queue.Queue = queue.Queue(maxsize=queue_maxsize)
        self._conn: Optional[sqlite3.Connection] = None
        self._writer_thread: Optional[threading.Thread] = None
        self._running = False
        self._lock = threading.Lock()
        self._flush_event = threading.Event()
        
        self._topic_stats_cache: Dict[str, Dict] = defaultdict(lambda: {
            'packet_count': 0,
            'first_seen': None,
            'last_seen': None,
            'total_bytes': 0
        })
        self._dirty_topics: set = set()
        self._dropped_count = 0
        self._total_written = 0
        
        self._init_db()
        self._start_writer_thread()

    def _create_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(
            self.db_path,
            timeout=30.0,
            isolation_level=None,
            check_same_thread=False
        )
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        conn.execute("PRAGMA cache_size = -65536")
        conn.execute("PRAGMA temp_store = MEMORY")
        conn.execute("PRAGMA mmap_size = 2147483648")
        conn.execute("PRAGMA busy_timeout = 5000")
        return conn

    def _init_db(self):
        with self._lock:
            conn = self._create_connection()
            try:
                cursor = conn.cursor()
                
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS mqtt_packets (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp REAL NOT NULL,
                        datetime TEXT,
                        packet_type TEXT NOT NULL,
                        direction TEXT,
                        topic TEXT,
                        qos INTEGER,
                        retain INTEGER,
                        payload_hex TEXT,
                        payload_length INTEGER,
                        client_id TEXT,
                        packet_id INTEGER,
                        raw_packet_hex TEXT,
                        created_at REAL DEFAULT (strftime('%s', 'now'))
                    )
                ''')

                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS protocol_analysis (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id TEXT,
                        analysis_time REAL,
                        total_packets INTEGER,
                        max_length INTEGER,
                        structure_json TEXT,
                        created_at REAL DEFAULT (strftime('%s', 'now'))
                    )
                ''')

                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS topic_stats (
                        topic TEXT PRIMARY KEY,
                        packet_count INTEGER DEFAULT 0,
                        first_seen REAL,
                        last_seen REAL,
                        total_bytes INTEGER DEFAULT 0,
                        avg_payload_length REAL
                    )
                ''')

                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_packets_timestamp 
                    ON mqtt_packets(timestamp)
                ''')
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_packets_topic 
                    ON mqtt_packets(topic)
                ''')
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_packets_type 
                    ON mqtt_packets(packet_type)
                ''')

                conn.commit()
                
                self._load_topic_stats(conn)
            finally:
                conn.close()

    def _load_topic_stats(self, conn: sqlite3.Connection):
        try:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM topic_stats')
            rows = cursor.fetchall()
            for row in rows:
                topic = row['topic']
                self._topic_stats_cache[topic] = {
                    'packet_count': row['packet_count'] or 0,
                    'first_seen': row['first_seen'],
                    'last_seen': row['last_seen'],
                    'total_bytes': row['total_bytes'] or 0
                }
        except Exception as e:
            pass

    def _start_writer_thread(self):
        self._running = True
        self._writer_thread = threading.Thread(
            target=self._writer_loop,
            daemon=True,
            name="SQLiteWriter"
        )
        self._writer_thread.start()

    def _writer_loop(self):
        conn = self._create_connection()
        try:
            batch: List[Dict] = []
            last_flush = time.time()
            
            while self._running or not self._write_queue.empty():
                try:
                    timeout = max(0.01, self.flush_interval / 2)
                    try:
                        item = self._write_queue.get(timeout=timeout)
                        if item is None:
                            break
                        batch.append(item)
                    except queue.Empty:
                        pass
                    
                    should_flush = (
                        len(batch) >= self.batch_size or
                        (time.time() - last_flush) >= self.flush_interval or
                        (not self._running and len(batch) > 0) or
                        self._flush_event.is_set()
                    )
                    
                    if should_flush and self._flush_event.is_set():
                        self._flush_event.clear()
                    
                    if should_flush and batch:
                        self._flush_batch(conn, batch)
                        batch = []
                        last_flush = time.time()
                        self._flush_topic_stats(conn)
                        
                except Exception as e:
                    time.sleep(0.1)
        finally:
            if batch:
                try:
                    self._flush_batch(conn, batch)
                    self._flush_topic_stats(conn)
                except:
                    pass
            conn.close()

    def _flush_batch(self, conn: sqlite3.Connection, batch: List[Dict]):
        if not batch:
            return
        
        retry_count = 0
        max_retries = 5
        
        while retry_count < max_retries:
            try:
                cursor = conn.cursor()
                cursor.execute("BEGIN IMMEDIATE")
                
                insert_data = []
                for item in batch:
                    ts = item.get('timestamp', time.time())
                    dt_str = datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S.%f')
                    
                    insert_data.append((
                        ts,
                        dt_str,
                        item.get('packet_type', 'UNKNOWN'),
                        item.get('direction'),
                        item.get('topic'),
                        item.get('qos', 0),
                        1 if item.get('retain', False) else 0,
                        item.get('payload'),
                        item.get('payload_length', 0),
                        item.get('client_id'),
                        item.get('packet_id'),
                        item.get('raw_packet')
                    ))
                    
                    topic = item.get('topic')
                    payload_len = item.get('payload_length', 0)
                    if topic:
                        self._update_topic_cache(topic, ts, payload_len)
                
                cursor.executemany('''
                    INSERT INTO mqtt_packets (
                        timestamp, datetime, packet_type, direction, topic, qos, retain,
                        payload_hex, payload_length, client_id, packet_id, raw_packet_hex
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', insert_data)
                
                conn.execute("COMMIT")
                self._total_written += len(batch)
                return
                
            except sqlite3.OperationalError as e:
                if "locked" in str(e).lower() and retry_count < max_retries - 1:
                    try:
                        conn.execute("ROLLBACK")
                    except:
                        pass
                    retry_count += 1
                    time.sleep(0.05 * retry_count)
                else:
                    try:
                        conn.execute("ROLLBACK")
                    except:
                        pass
                    raise
            except Exception:
                try:
                    conn.execute("ROLLBACK")
                except:
                    pass
                raise

    def _update_topic_cache(self, topic: str, ts: float, payload_len: int):
        stats = self._topic_stats_cache[topic]
        stats['packet_count'] += 1
        stats['total_bytes'] += payload_len
        if stats['first_seen'] is None or ts < stats['first_seen']:
            stats['first_seen'] = ts
        if stats['last_seen'] is None or ts > stats['last_seen']:
            stats['last_seen'] = ts
        self._dirty_topics.add(topic)

    def _flush_topic_stats(self, conn: sqlite3.Connection):
        if not self._dirty_topics:
            return
        
        retry_count = 0
        max_retries = 3
        
        while retry_count < max_retries:
            try:
                cursor = conn.cursor()
                cursor.execute("BEGIN IMMEDIATE")
                
                update_data = []
                for topic in self._dirty_topics:
                    stats = self._topic_stats_cache[topic]
                    count = stats['packet_count']
                    avg_len = stats['total_bytes'] / count if count > 0 else 0
                    update_data.append((
                        topic,
                        count,
                        stats['first_seen'],
                        stats['last_seen'],
                        stats['total_bytes'],
                        avg_len,
                        count,
                        stats['last_seen'],
                        stats['total_bytes'],
                        avg_len
                    ))
                
                cursor.executemany('''
                    INSERT INTO topic_stats (
                        topic, packet_count, first_seen, last_seen, total_bytes, avg_payload_length
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(topic) DO UPDATE SET
                        packet_count = ?,
                        last_seen = ?,
                        total_bytes = ?,
                        avg_payload_length = ?
                ''', update_data)
                
                conn.execute("COMMIT")
                self._dirty_topics.clear()
                return
                
            except sqlite3.OperationalError as e:
                if "locked" in str(e).lower() and retry_count < max_retries - 1:
                    try:
                        conn.execute("ROLLBACK")
                    except:
                        pass
                    retry_count += 1
                    time.sleep(0.05 * retry_count)
                else:
                    try:
                        conn.execute("ROLLBACK")
                    except:
                        pass
                    self._dirty_topics.clear()
                    return
            except Exception:
                try:
                    conn.execute("ROLLBACK")
                except:
                    pass
                self._dirty_topics.clear()
                return

    def store_packet(self, packet_data: Dict[str, Any]) -> Optional[int]:
        try:
            self._write_queue.put_nowait(packet_data.copy())
            return None
        except queue.Full:
            self._dropped_count += 1
            if self._dropped_count % 1000 == 0:
                print(f"[WARNING] 队列已满，已丢弃 {self._dropped_count} 个包")
            return None

    def store_packet_sync(self, packet_data: Dict[str, Any]) -> int:
        with self._lock:
            conn = self._create_connection()
            try:
                cursor = conn.cursor()
                
                ts = packet_data.get('timestamp', time.time())
                dt_str = datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S.%f')
                
                cursor.execute('''
                    INSERT INTO mqtt_packets (
                        timestamp, datetime, packet_type, direction, topic, qos, retain,
                        payload_hex, payload_length, client_id, packet_id, raw_packet_hex
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    ts,
                    dt_str,
                    packet_data.get('packet_type', 'UNKNOWN'),
                    packet_data.get('direction'),
                    packet_data.get('topic'),
                    packet_data.get('qos', 0),
                    1 if packet_data.get('retain', False) else 0,
                    packet_data.get('payload'),
                    packet_data.get('payload_length', 0),
                    packet_data.get('client_id'),
                    packet_data.get('packet_id'),
                    packet_data.get('raw_packet')
                ))

                topic = packet_data.get('topic')
                if topic:
                    payload_len = packet_data.get('payload_length', 0)
                    self._update_topic_cache(topic, ts, payload_len)
                    self._flush_topic_stats(conn)

                conn.commit()
                return cursor.lastrowid
            finally:
                conn.close()

    def store_protocol_analysis(self, session_id: str, structure: Dict[str, Any], 
                                 total_packets: int) -> int:
        with self._lock:
            conn = self._create_connection()
            try:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO protocol_analysis (
                        session_id, analysis_time, total_packets, max_length, structure_json
                    ) VALUES (?, ?, ?, ?, ?)
                ''', (
                    session_id,
                    time.time(),
                    total_packets,
                    structure.get('total_length', 0),
                    json.dumps(structure, ensure_ascii=False)
                ))
                conn.commit()
                return cursor.lastrowid
            finally:
                conn.close()

    def flush(self, timeout: float = 5.0):
        self._flush_event.set()
        start = time.time()
        while (not self._write_queue.empty() or self._dirty_topics) and (time.time() - start) < timeout:
            self._flush_event.set()
            time.sleep(0.05)

    def stop(self, timeout: float = 10.0):
        self._running = False
        try:
            self._write_queue.put(None, timeout=1.0)
        except:
            pass
        if self._writer_thread:
            self._writer_thread.join(timeout=timeout)
        self.flush(timeout=timeout)

    def get_write_stats(self) -> Dict[str, Any]:
        return {
            'queue_size': self._write_queue.qsize(),
            'total_written': self._total_written,
            'dropped_count': self._dropped_count,
            'dirty_topics': len(self._dirty_topics)
        }

    @contextmanager
    def get_connection(self):
        conn = self._create_connection()
        try:
            yield conn
        finally:
            conn.close()

    @contextmanager
    def _get_read_connection(self):
        conn = self._create_connection()
        try:
            yield conn
        finally:
            conn.close()

    def get_packets(self, limit: int = 100, offset: int = 0, 
                    topic: Optional[str] = None) -> List[Dict]:
        with self._get_read_connection() as conn:
            cursor = conn.cursor()
            
            query = 'SELECT * FROM mqtt_packets'
            params = []
            
            if topic:
                query += ' WHERE topic = ?'
                params.append(topic)
            
            query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?'
            params.extend([limit, offset])
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            return [dict(row) for row in rows]

    def get_topic_stats(self) -> List[Dict]:
        with self._lock:
            self.flush(timeout=2.0)
            
        with self._get_read_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM topic_stats ORDER BY packet_count DESC')
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def get_packet_count(self) -> int:
        with self._get_read_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) as cnt FROM mqtt_packets')
            return cursor.fetchone()['cnt']

    def search_payload(self, hex_pattern: str, limit: int = 100) -> List[Dict]:
        with self._get_read_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM mqtt_packets 
                WHERE payload_hex LIKE ? 
                ORDER BY timestamp DESC 
                LIMIT ?
            ''', (f'%{hex_pattern}%', limit))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def get_packets_by_time_range(self, start_ts: float, end_ts: float) -> List[Dict]:
        with self._get_read_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM mqtt_packets 
                WHERE timestamp BETWEEN ? AND ?
                ORDER BY timestamp ASC
            ''', (start_ts, end_ts))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def export_to_json(self, output_path: str, limit: Optional[int] = None):
        with self._lock:
            self.flush(timeout=5.0)
            
        with self._get_read_connection() as conn:
            cursor = conn.cursor()
            query = 'SELECT * FROM mqtt_packets ORDER BY timestamp ASC'
            if limit:
                query += f' LIMIT {limit}'
            cursor.execute(query)
            rows = cursor.fetchall()
            
            packets = [dict(row) for row in rows]
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(packets, f, indent=2, ensure_ascii=False)

    def clear_packets(self):
        with self._lock:
            self.flush(timeout=5.0)
            self._topic_stats_cache.clear()
            self._dirty_topics.clear()
            self._total_written = 0
            self._dropped_count = 0
            
            while not self._write_queue.empty():
                try:
                    self._write_queue.get_nowait()
                except:
                    break
            
            with self._get_read_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("BEGIN IMMEDIATE")
                cursor.execute('DELETE FROM mqtt_packets')
                cursor.execute('DELETE FROM topic_stats')
                conn.execute("COMMIT")

    def get_database_info(self) -> Dict:
        with self._lock:
            self.flush(timeout=2.0)
            
        with self._get_read_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('SELECT COUNT(*) as cnt FROM mqtt_packets')
            packet_count = cursor.fetchone()['cnt']
            
            cursor.execute('SELECT COUNT(*) as cnt FROM topic_stats')
            topic_count = cursor.fetchone()['cnt']
            
            cursor.execute('''
                SELECT 
                    COALESCE(SUM(payload_length), 0) as total_bytes,
                    COALESCE(AVG(payload_length), 0) as avg_length
                FROM mqtt_packets
            ''')
            stats = cursor.fetchone()
            
            write_stats = self.get_write_stats()
            
            return {
                'packet_count': packet_count,
                'topic_count': topic_count,
                'total_bytes': stats['total_bytes'],
                'avg_payload_length': round(stats['avg_length'], 2),
                'queue_size': write_stats['queue_size'],
                'total_written': write_stats['total_written'],
                'dropped_count': write_stats['dropped_count']
            }

    def __del__(self):
        try:
            self.stop(timeout=2.0)
        except:
            pass
