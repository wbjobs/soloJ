import random
import time
import json
import math
import zmq
import threading
import queue
from collections import deque
from flask import Flask, jsonify, request, render_template
from flask_socketio import SocketIO, emit
from logger_config import setup_logger

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret-key'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

logger = setup_logger("master", "master.log")

NUM_PARTICLES = 100
NUM_WORKERS = 4
TIMEOUT_SECONDS = 8
HEARTBEAT_INTERVAL = 1
HEARTBEAT_TIMEOUT = 3
EPSILON = 1.0
SIGMA = 1.0
MOVING_AVERAGE_WINDOW = 5
MIN_CHUNK_SIZE = 100

ZMQ_ROUTER_URL = "tcp://*:5555"

context = zmq.Context()
router_socket = context.socket(zmq.ROUTER)
router_socket.bind(ZMQ_ROUTER_URL)
router_socket.setsockopt(zmq.ROUTER_MANDATORY, 0)

logger.info(f"Master ROUTER bound to {ZMQ_ROUTER_URL}")

zmq_message_queue = queue.Queue()

worker_performance = {}
worker_states = {}
worker_last_heartbeat = {}
registered_workers = set()
current_computation = {
    "active": False,
    "total_pairs": 0,
    "completed_pairs": 0,
    "start_time": None,
    "chunk_info": {}
}

class WorkerStats:
    def __init__(self):
        self.times = deque(maxlen=MOVING_AVERAGE_WINDOW)
        self.pair_counts = deque(maxlen=MOVING_AVERAGE_WINDOW)
        self.avg_time_per_pair = None
        self.total_pairs_processed = 0
    
    def add_completion(self, num_pairs, elapsed_time):
        self.times.append(elapsed_time)
        self.pair_counts.append(num_pairs)
        self.total_pairs_processed += num_pairs
        if self.times and self.pair_counts:
            total_time = sum(self.times)
            total_pairs_in_window = sum(self.pair_counts)
            if total_pairs_in_window > 0:
                self.avg_time_per_pair = total_time / total_pairs_in_window
    
    def get_speed_score(self):
        if self.avg_time_per_pair is None:
            return 1.0
        return 1.0 / max(self.avg_time_per_pair, 1e-9)
    
    def to_dict(self, worker_id):
        state = worker_states.get(worker_id, "unknown")
        current_chunk = current_computation["chunk_info"].get(worker_id, {})
        return {
            "worker_id": worker_id,
            "state": state,
            "avg_time_per_pair": self.avg_time_per_pair,
            "total_pairs_processed": self.total_pairs_processed,
            "speed_score": self.get_speed_score(),
            "current_chunk_size": current_chunk.get("size", 0),
            "current_chunk_progress": current_chunk.get("progress", 0),
            "assigned_at": current_chunk.get("assigned_at", None)
        }

def init_worker_performance(worker_id):
    if worker_id not in worker_performance:
        worker_performance[worker_id] = WorkerStats()

def generate_particles(n):
    particles = []
    for _ in range(n):
        x = random.uniform(0, 10)
        y = random.uniform(0, 10)
        z = random.uniform(0, 10)
        particles.append((x, y, z))
    logger.info(f"Generated {n} particles")
    return particles

def generate_particle_pairs(particles):
    pairs = []
    n = len(particles)
    for i in range(n):
        for j in range(i + 1, n):
            pairs.append((i, j))
    logger.info(f"Generated {len(pairs)} particle pairs")
    return pairs

def calculate_dynamic_chunks(pairs, worker_ids):
    n = len(pairs)
    active_workers = [w for w in worker_ids if w in registered_workers]
    
    if not active_workers:
        return [pairs]
    
    if not all(w in worker_performance for w in active_workers):
        for w in active_workers:
            init_worker_performance(w)
    
    speeds = {}
    for w in active_workers:
        speeds[w] = worker_performance[w].get_speed_score()
    
    total_speed = sum(speeds.values())
    
    if total_speed == 0:
        equal_size = n // len(active_workers)
        sizes = [equal_size] * len(active_workers)
        sizes[-1] += n % len(active_workers)
    else:
        sizes = []
        remaining = n
        for i, w in enumerate(active_workers):
            if i == len(active_workers) - 1:
                size = remaining
            else:
                proportion = speeds[w] / total_speed
                size = max(MIN_CHUNK_SIZE, int(n * proportion))
                size = min(size, remaining - MIN_CHUNK_SIZE * (len(active_workers) - i - 1))
            sizes.append(size)
            remaining -= size
    
    chunks = {}
    pos = 0
    for w, size in zip(active_workers, sizes):
        chunks[w] = pairs[pos:pos+size]
        pos += size
    
    logger.info("Dynamic split: %s" % [(w, len(chunks[w])) for w in active_workers])
    return chunks, active_workers

def broadcast_dashboard_state():
    worker_list = []
    for w_id in sorted(registered_workers):
        init_worker_performance(w_id)
        worker_list.append(worker_performance[w_id].to_dict(w_id))
    
    completed = sum(1 for c in current_computation["chunk_info"].values() if c.get("completed", False))
    
    data = {
        "workers": worker_list,
        "computation": {
            "active": current_computation["active"],
            "total_pairs": current_computation["total_pairs"],
            "completed_pairs": current_computation["completed_pairs"],
            "elapsed_time": time.time() - current_computation["start_time"] if current_computation["start_time"] else 0,
            "completed_chunks": completed,
            "total_chunks": len(current_computation["chunk_info"])
        }
    }
    socketio.emit('status_update', data, namespace='/')

def broadcast_dashboard_state_thread():
    while True:
        if registered_workers:
            broadcast_dashboard_state()
        time.sleep(1.0)

def send_task(chunk_idx, target_worker_id, particles, pairs_chunk, pending_chunks):
    init_worker_performance(target_worker_id)
    task = {
        "type": "task",
        "chunk_idx": chunk_idx,
        "particles": particles,
        "pairs": pairs_chunk
    }
    router_socket.send_multipart([
        target_worker_id.encode(),
        json.dumps(task).encode()
    ])
    pending_chunks[chunk_idx] = {
        "start_time": time.time(),
        "worker_id": target_worker_id,
        "data": pairs_chunk,
        "retries": 0,
        "size": len(pairs_chunk)
    }
    worker_states[target_worker_id] = "busy"
    worker_last_heartbeat[target_worker_id] = time.time()
    current_computation["chunk_info"][target_worker_id] = {
        "size": len(pairs_chunk),
        "progress": 0,
        "assigned_at": time.time(),
        "completed": False,
        "chunk_idx": chunk_idx
    }
    logger.info(f"Sent chunk {chunk_idx} ({len(pairs_chunk)} pairs) to {target_worker_id}")
    broadcast_dashboard_state()

def reassign_chunk(chunk_idx, particles, pending_chunks):
    if chunk_idx not in pending_chunks:
        return
    pending_chunks[chunk_idx]["retries"] += 1
    retry_count = pending_chunks[chunk_idx]["retries"]
    old_worker = pending_chunks[chunk_idx]["worker_id"]
    chunk_data = pending_chunks[chunk_idx]["data"]
    logger.warning(f"Reassigning chunk {chunk_idx} from {old_worker} (retry #{retry_count})")
    
    available_workers = [
        w_id for w_id, state in worker_states.items()
        if state == "idle" and w_id != old_worker and w_id in registered_workers
    ]
    
    if not available_workers:
        available_workers = [w_id for w_id in registered_workers if w_id != old_worker]
    
    if available_workers:
        new_worker = max(available_workers, key=lambda w: worker_performance[w].get_speed_score())
    else:
        new_worker = old_worker
    
    task = {
        "type": "task",
        "chunk_idx": chunk_idx,
        "particles": particles,
        "pairs": chunk_data
    }
    router_socket.send_multipart([
        new_worker.encode(),
        json.dumps(task).encode()
    ])
    pending_chunks[chunk_idx]["start_time"] = time.time()
    pending_chunks[chunk_idx]["worker_id"] = new_worker
    pending_chunks[chunk_idx]["size"] = len(chunk_data)
    worker_states[new_worker] = "busy"
    
    if old_worker in current_computation["chunk_info"]:
        current_computation["chunk_info"][old_worker]["completed"] = False
    
    current_computation["chunk_info"][new_worker] = {
        "size": len(chunk_data),
        "progress": 0,
        "assigned_at": time.time(),
        "completed": False,
        "chunk_idx": chunk_idx
    }
    
    logger.info(f"Reassigned chunk {chunk_idx} to {new_worker}")
    broadcast_dashboard_state()

def get_message_from_queue(timeout=0.1):
    try:
        return zmq_message_queue.get(timeout=timeout)
    except queue.Empty:
        return None

def handle_worker_message(worker_id, data):
    current_time = time.time()
    
    if data["type"] == "register":
        init_worker_performance(worker_id)
        if worker_id not in worker_states:
            worker_states[worker_id] = "idle"
            registered_workers.add(worker_id)
            logger.info(f"Worker registered: {worker_id}")
        worker_last_heartbeat[worker_id] = current_time
        return "register"
    
    elif data["type"] == "heartbeat":
        worker_last_heartbeat[worker_id] = current_time
        return "heartbeat"
    
    return None

def process_dashboard_messages():
    processed = 0
    has_registration = False
    while True:
        msg = get_message_from_queue(timeout=0.01)
        if msg is None:
            break
        worker_id, data = msg
        result = handle_worker_message(worker_id, data)
        if result == "register":
            has_registration = True
        processed += 1
    if has_registration:
        broadcast_dashboard_state()

def calculate_total_potential(particles, pairs):
    current_computation["active"] = True
    current_computation["total_pairs"] = len(pairs)
    current_computation["completed_pairs"] = 0
    current_computation["start_time"] = time.time()
    current_computation["chunk_info"] = {}
    
    results = []
    completed_chunks = set()
    pending_chunks = {}
    
    worker_ids = sorted(registered_workers)
    if len(worker_ids) < NUM_WORKERS:
        logger.warning(f"Only {len(worker_ids)} workers registered, waiting...")
        timeout_start = time.time()
        while len(registered_workers) < NUM_WORKERS and time.time() - timeout_start < 10:
            process_dashboard_messages()
            time.sleep(0.1)
    
    chunks_map, worker_list = calculate_dynamic_chunks(pairs, list(registered_workers))
    chunk_to_worker = {}
    for idx, (w_id, chunk) in enumerate(chunks_map.items()):
        chunk_to_worker[idx] = w_id
        send_task(idx, w_id, particles, chunk, pending_chunks)
    
    last_heartbeat_check = time.time()
    
    while len(completed_chunks) < len(chunks_map):
        current_time = time.time()
        
        msg = get_message_from_queue(timeout=0.05)
        if msg is not None:
            worker_id, data = msg
            
            handled = handle_worker_message(worker_id, data)
            if handled:
                continue
            
            if data["type"] == "progress":
                chunk_idx = data["chunk_idx"]
                progress = data["progress"]
                if worker_id in current_computation["chunk_info"]:
                    current_computation["chunk_info"][worker_id]["progress"] = progress
            
            elif data["type"] == "result":
                chunk_idx = data["chunk_idx"]
                potential = data["potential"]
                elapsed = data["elapsed_time"]
                num_pairs = data["num_pairs"]
                
                if chunk_idx in pending_chunks:
                    init_worker_performance(worker_id)
                    worker_performance[worker_id].add_completion(num_pairs, elapsed)
                    
                    results.append(potential)
                    completed_chunks.add(chunk_idx)
                    worker_states[worker_id] = "idle"
                    
                    current_computation["completed_pairs"] += num_pairs
                    
                    if worker_id in current_computation["chunk_info"]:
                        current_computation["chunk_info"][worker_id]["completed"] = True
                        current_computation["chunk_info"][worker_id]["progress"] = num_pairs
                    
                    del pending_chunks[chunk_idx]
                    logger.info(f"Received result for chunk {chunk_idx}: {potential:.6f}")
                    logger.info(f"Progress: {len(completed_chunks)}/{len(chunks_map)} chunks completed")
                    broadcast_dashboard_state()
        
        if current_time - last_heartbeat_check > HEARTBEAT_INTERVAL:
            last_heartbeat_check = current_time
            
            dead_workers = []
            for w_id in list(worker_states.keys()):
                last_hb = worker_last_heartbeat.get(w_id)
                if last_hb is None:
                    worker_last_heartbeat[w_id] = current_time
                    continue
                if current_time - last_hb > HEARTBEAT_TIMEOUT and w_id in registered_workers:
                    logger.warning(f"Worker {w_id} appears to be dead (no heartbeat for {current_time - last_hb:.1f}s)")
                    dead_workers.append(w_id)
                    
                    for c_idx in list(pending_chunks.keys()):
                        if pending_chunks[c_idx]["worker_id"] == w_id:
                            logger.warning(f"Reassigning chunk {c_idx} due to worker death")
                            reassign_chunk(c_idx, particles, pending_chunks)
            
            for dead_w in dead_workers:
                if dead_w in worker_states:
                    del worker_states[dead_w]
                if dead_w in registered_workers:
                    registered_workers.discard(dead_w)
                broadcast_dashboard_state()
        
        for chunk_idx in list(pending_chunks.keys()):
            elapsed = current_time - pending_chunks[chunk_idx]["start_time"]
            if elapsed > TIMEOUT_SECONDS:
                reassign_chunk(chunk_idx, particles, pending_chunks)

    total_potential = math.fsum(results)
    current_computation["active"] = False
    logger.info(f"Total potential calculated (via fsum): {total_potential:.6f}")
    broadcast_dashboard_state()
    return total_potential

@app.route('/')
def dashboard():
    return render_template('dashboard.html')

@app.route('/compute', methods=['GET'])
def compute_potential():
    logger.info("Received compute request")
    start_time = time.time()
    
    particles = generate_particles(NUM_PARTICLES)
    pairs = generate_particle_pairs(particles)
    
    total_potential = calculate_total_potential(particles, pairs)
    
    elapsed_time = time.time() - start_time
    logger.info(f"Computation completed in {elapsed_time:.2f} seconds")
    
    return jsonify({
        "total_potential": total_potential,
        "num_particles": NUM_PARTICLES,
        "num_pairs": len(pairs),
        "elapsed_time_seconds": elapsed_time
    })

@app.route('/compute_with_seed', methods=['POST'])
def compute_with_seed():
    logger.info("Received compute with seed request")
    start_time = time.time()
    
    data = request.get_json()
    seed = data.get('seed', 42)
    
    random.seed(seed)
    particles = generate_particles(NUM_PARTICLES)
    pairs = generate_particle_pairs(particles)
    
    total_potential = calculate_total_potential(particles, pairs)
    
    elapsed_time = time.time() - start_time
    logger.info(f"Computation completed in {elapsed_time:.2f} seconds")
    
    return jsonify({
        "total_potential": total_potential,
        "num_particles": NUM_PARTICLES,
        "num_pairs": len(pairs),
        "elapsed_time_seconds": elapsed_time,
        "seed": seed
    })

@app.route('/api/status')
def get_status():
    worker_list = []
    for w_id in sorted(registered_workers):
        init_worker_performance(w_id)
        worker_list.append(worker_performance[w_id].to_dict(w_id))
    
    return jsonify({
        "workers": worker_list,
        "registered_count": len(registered_workers)
    })

@socketio.on('connect')
def handle_connect():
    logger.info("Client connected to dashboard")
    broadcast_dashboard_state()

@socketio.on('disconnect')
def handle_disconnect():
    logger.info("Client disconnected from dashboard")

def zmq_listener():
    poller = zmq.Poller()
    poller.register(router_socket, zmq.POLLIN)
    logger.info("ZMQ listener thread started")
    
    while True:
        try:
            socks = dict(poller.poll(timeout=100))
            if router_socket in socks:
                worker_id_bytes, msg = router_socket.recv_multipart(zmq.NOBLOCK)
                worker_id = worker_id_bytes.decode()
                data = json.loads(msg.decode())
                zmq_message_queue.put((worker_id, data))
        except zmq.Again:
            pass
        except Exception as e:
            logger.error(f"Error in zmq_listener: {e}", exc_info=True)
        time.sleep(0.01)

def message_queue_processor():
    logger.info("Message queue processor thread started")
    while True:
        try:
            if not current_computation["active"]:
                process_dashboard_messages()
            time.sleep(0.05)
        except Exception as e:
            logger.error(f"Error in message_queue_processor: {e}", exc_info=True)
            time.sleep(0.1)

if __name__ == "__main__":
    logger.info("Starting Master node with SocketIO...")
    
    listener_thread = threading.Thread(target=zmq_listener, daemon=True)
    listener_thread.start()
    
    processor_thread = threading.Thread(target=message_queue_processor, daemon=True)
    processor_thread.start()
    
    dashboard_thread = threading.Thread(target=broadcast_dashboard_state_thread, daemon=True)
    dashboard_thread.start()
    
    socketio.run(app, host="0.0.0.0", port=5000, debug=False)
