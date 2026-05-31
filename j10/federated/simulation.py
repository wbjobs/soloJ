import sys
import os
import time
import threading
import argparse
import subprocess
import signal
from typing import List

sys.path.insert(0, os.path.dirname(__file__))


class FederatedSimulation:
    def __init__(self, num_clients: int = 3, num_rounds: int = 3,
                 server_port: int = 50052, metrics_port: int = 8001):
        self.num_clients = num_clients
        self.num_rounds = num_rounds
        self.server_port = server_port
        self.metrics_port = metrics_port

        self.server_process = None
        self.client_processes: List[subprocess.Popen] = []
        self._stop_event = threading.Event()

        self.project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.federated_dir = os.path.dirname(os.path.abspath(__file__))

    def _run_server(self):
        env = os.environ.copy()
        env['PYTHONPATH'] = self.project_root + os.pathsep + self.federated_dir

        cmd = [
            sys.executable,
            os.path.join(self.federated_dir, 'fl_server.py'),
            '--port', str(self.server_port),
            '--metrics-port', str(self.metrics_port),
            '--num-clients', str(self.num_clients),
            '--max-rounds', str(self.num_rounds)
        ]

        print(f"[SIM] Starting FL server on port {self.server_port}")
        return subprocess.Popen(
            cmd,
            env=env,
            cwd=self.project_root,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

    def _run_client(self, client_id: str, wait_time: int = 2):
        env = os.environ.copy()
        env['PYTHONPATH'] = self.project_root + os.pathsep + self.federated_dir

        cmd = [
            sys.executable,
            os.path.join(self.federated_dir, 'fl_client.py'),
            '--client-id', client_id,
            '--server', f'localhost:{self.server_port}',
            '--local-epochs', '2',
            '--batch-size', '32',
            '--num-rounds', str(self.num_rounds),
            '--num-batches', '5',
            '--wait', str(wait_time),
            '--device', 'cpu'
        ]

        print(f"[SIM] Starting FL client '{client_id}'")
        return subprocess.Popen(
            cmd,
            env=env,
            cwd=self.project_root,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

    def _monitor_output(self, process, prefix: str):
        def monitor():
            try:
                for line in iter(process.stdout.readline, ''):
                    if line:
                        print(f"[{prefix}] {line.rstrip()}")
            except:
                pass

        thread = threading.Thread(target=monitor, daemon=True)
        thread.start()
        return thread

    def run(self):
        print("=" * 80)
        print("Federated Learning Simulation")
        print("=" * 80)
        print(f"Number of clients: {self.num_clients}")
        print(f"Number of rounds: {self.num_rounds}")
        print(f"Server port: {self.server_port}")
        print(f"Metrics port: {self.metrics_port}")
        print("=" * 80 + "\n")

        try:
            self.server_process = self._run_server()
            self._monitor_output(self.server_process, "SERVER")

            print(f"\n[SIM] Waiting for server to initialize... (3s)")
            time.sleep(3)

            if self.server_process.poll() is not None:
                print(f"[SIM] Server failed to start (exit code: {self.server_process.returncode})")
                return

            print(f"\n[SIM] Starting {self.num_clients} client processes...")
            for i in range(self.num_clients):
                client_id = f"edge-node-{i + 1:02d}"
                wait_time = 2 + i
                client_proc = self._run_client(client_id, wait_time)
                self.client_processes.append(client_proc)
                self._monitor_output(client_proc, f"CLIENT-{i + 1}")
                time.sleep(1)

            print(f"\n[SIM] All {self.num_clients} clients started")
            print(f"[SIM] Waiting for federated learning to complete...\n")

            import grpc
            import federated_pb2
            import federated_pb2_grpc

            channel = grpc.insecure_channel(f'localhost:{self.server_port}')
            stub = federated_pb2_grpc.FederatedServiceStub(channel)

            for round_idx in range(self.num_rounds):
                print(f"\n[SIM] Triggering round {round_idx + 1}...")
                try:
                    response = stub.StartTrainingRound(federated_pb2.StartRoundRequest(
                        round=round_idx + 1,
                        expected_clients=self.num_clients
                    ))
                    if response.started:
                        print(f"[SIM] Round {round_idx + 1} started successfully")
                    else:
                        print(f"[SIM] Failed to start round {round_idx + 1}: {response.message}")
                except grpc.RpcError as e:
                    print(f"[SIM] RPC error: {e}")

                round_wait = 15
                for i in range(round_wait):
                    if all(p.poll() is not None for p in self.client_processes):
                        break
                    time.sleep(1)
                    if i % 5 == 4:
                        print(f"[SIM] Waiting for round {round_idx + 1} to complete... ({i + 1}s)")

            print(f"\n[SIM] All rounds triggered, waiting for clients to finish...")
            timeout_start = time.time()
            while time.time() - timeout_start < 60:
                if all(p.poll() is not None for p in self.client_processes):
                    print(f"[SIM] All clients completed")
                    break
                time.sleep(2)

            channel.close()

        except KeyboardInterrupt:
            print("\n[SIM] Interrupted by user")
        finally:
            self._cleanup()

        print("\n" + "=" * 80)
        print("Federated Learning Simulation Complete!")
        print("=" * 80)

    def _cleanup(self):
        print("\n[SIM] Cleaning up processes...")

        for i, proc in enumerate(self.client_processes):
            if proc.poll() is None:
                print(f"[SIM] Terminating client {i + 1}...")
                try:
                    proc.terminate()
                    proc.wait(timeout=3)
                except:
                    proc.kill()

        if self.server_process and self.server_process.poll() is None:
            print("[SIM] Terminating server...")
            try:
                self.server_process.terminate()
                self.server_process.wait(timeout=3)
            except:
                self.server_process.kill()

        print("[SIM] Cleanup complete")


def main():
    parser = argparse.ArgumentParser(description='Federated Learning Simulation')
    parser.add_argument('--num-clients', type=int, default=3,
                        help='Number of edge clients (default: 3)')
    parser.add_argument('--num-rounds', type=int, default=3,
                        help='Number of training rounds (default: 3)')
    parser.add_argument('--server-port', type=int, default=50052,
                        help='FL server port (default: 50052)')
    parser.add_argument('--metrics-port', type=int, default=8001,
                        help='Prometheus metrics port (default: 8001)')
    args = parser.parse_args()

    sim = FederatedSimulation(
        num_clients=args.num_clients,
        num_rounds=args.num_rounds,
        server_port=args.server_port,
        metrics_port=args.metrics_port
    )
    sim.run()


if __name__ == '__main__':
    main()