import sys
import time
import math
import json
import random
import zmq
from logger_config import setup_logger

EPSILON = 1.0
SIGMA = 1.0
ZMQ_ROUTER_URL = "tcp://localhost:5555"
HEARTBEAT_INTERVAL = 0.5
PROGRESS_REPORT_INTERVAL = 100

def calculate_pair_potential(p1, p2):
    dx = p1[0] - p2[0]
    dy = p1[1] - p2[1]
    dz = p1[2] - p2[2]
    r = math.sqrt(dx*dx + dy*dy + dz*dz)
    
    if r < 1e-10:
        return 0.0
    
    sigma_over_r = SIGMA / r
    sigma_over_r_6 = sigma_over_r ** 6
    sigma_over_r_12 = sigma_over_r_6 ** 2
    
    potential = 4 * EPSILON * (sigma_over_r_12 - sigma_over_r_6)
    return potential

def calculate_chunk_potential(worker_id, chunk_idx, particles, pairs, socket, logger):
    total = 0.0
    total_pairs = len(pairs)
    last_progress_report = 0
    
    for idx, (i, j) in enumerate(pairs):
        total += calculate_pair_potential(particles[i], particles[j])
        
        if (idx + 1) % PROGRESS_REPORT_INTERVAL == 0 and (idx + 1) != last_progress_report:
            last_progress_report = idx + 1
            progress = {
                "type": "progress",
                "chunk_idx": chunk_idx,
                "worker_id": worker_id,
                "progress": idx + 1,
                "total": total_pairs
            }
            try:
                socket.send(json.dumps(progress).encode(), zmq.NOBLOCK)
            except zmq.Again:
                pass
    
    return total, total_pairs

def main(worker_id):
    logger = setup_logger(f"worker_{worker_id}", f"worker_{worker_id}.log")
    
    speed_factor = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
    if speed_factor != 1.0:
        logger.info(f"Worker {worker_id} starting with speed factor: {speed_factor}")
    else:
        logger.info(f"Worker {worker_id} starting...")
    
    context = zmq.Context()
    
    dealer_socket = context.socket(zmq.DEALER)
    dealer_socket.setsockopt_string(zmq.IDENTITY, f"worker_{worker_id}")
    dealer_socket.connect(ZMQ_ROUTER_URL)
    logger.info(f"Worker {worker_id} connected to {ZMQ_ROUTER_URL}")
    
    register_msg = json.dumps({"type": "register", "worker_id": worker_id})
    dealer_socket.send(register_msg.encode())
    logger.info(f"Worker {worker_id} sent register message")
    
    poller = zmq.Poller()
    poller.register(dealer_socket, zmq.POLLIN)
    
    last_heartbeat = time.time()
    
    try:
        while True:
            socks = dict(poller.poll(timeout=100))
            
            current_time = time.time()
            
            if current_time - last_heartbeat > HEARTBEAT_INTERVAL:
                heartbeat_msg = json.dumps({"type": "heartbeat", "worker_id": worker_id})
                dealer_socket.send(heartbeat_msg.encode())
                last_heartbeat = current_time
            
            if dealer_socket in socks:
                try:
                    msg = dealer_socket.recv(zmq.NOBLOCK)
                    task = json.loads(msg.decode())
                    
                    if task["type"] == "task":
                        chunk_idx = task["chunk_idx"]
                        particles = task["particles"]
                        pairs = task["pairs"]
                        
                        logger.info(f"Worker {worker_id} received chunk {chunk_idx} with {len(pairs)} pairs")
                        start_time = time.time()
                        
                        potential, num_pairs = calculate_chunk_potential(
                            worker_id, chunk_idx, particles, pairs, dealer_socket, logger
                        )
                        
                        if speed_factor != 1.0:
                            extra_delay = (num_pairs * 0.0001) * (speed_factor - 1.0)
                            if extra_delay > 0:
                                time.sleep(min(extra_delay, 2.0))
                        
                        elapsed = time.time() - start_time
                        logger.info(f"Worker {worker_id} completed chunk {chunk_idx} in {elapsed:.3f}s, potential: {potential:.6f}")
                        
                        result = {
                            "type": "result",
                            "chunk_idx": chunk_idx,
                            "potential": potential,
                            "worker_id": worker_id,
                            "elapsed_time": elapsed,
                            "num_pairs": num_pairs
                        }
                        dealer_socket.send(json.dumps(result).encode())
                except zmq.Again:
                    pass
                
    except KeyboardInterrupt:
        logger.info(f"Worker {worker_id} interrupted")
    except Exception as e:
        logger.error(f"Worker {worker_id} error: {e}")
    finally:
        dealer_socket.close()
        context.term()
        logger.info(f"Worker {worker_id} stopped")

if __name__ == "__main__":
    worker_id = sys.argv[1] if len(sys.argv) > 1 else "0"
    main(worker_id)
