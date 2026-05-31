import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src'))

if __name__ == '__main__':
    from rq import Worker, Queue, Connection
    import redis
    
    conn = redis.Redis(host='localhost', port=6379, db=0)
    
    with Connection(conn):
        worker = Worker(Queue('optimization'), connection=conn)
        worker.work()
