import zmq
import json
import time
import threading

def test_router():
    context = zmq.Context()
    router = context.socket(zmq.ROUTER)
    router.bind("tcp://*:5555")
    print("ROUTER bound to tcp://*:5555")
    
    poller = zmq.Poller()
    poller.register(router, zmq.POLLIN)
    
    start_time = time.time()
    while time.time() - start_time < 10:
        socks = dict(poller.poll(timeout=100))
        if router in socks:
            try:
                frames = router.recv_multipart(zmq.NOBLOCK)
                print(f"Received {len(frames)} frames:")
                for i, f in enumerate(frames):
                    print(f"  Frame {i}: {f}")
                if len(frames) >= 2:
                    worker_id = frames[0].decode()
                    data = json.loads(frames[1].decode())
                    print(f"Worker: {worker_id}, Data: {data}")
            except Exception as e:
                print(f"Error: {e}")
        time.sleep(0.01)
    
    router.close()
    context.term()

if __name__ == "__main__":
    test_router()
