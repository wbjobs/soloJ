import sys
import os
import time
import threading
import argparse
import pickle
import io
from typing import Dict, List, Tuple
from dataclasses import dataclass, field

import numpy as np
import grpc
from concurrent import futures

from prometheus_client import start_http_server, Counter, Gauge, Histogram

sys.path.insert(0, os.path.dirname(__file__))
import federated_pb2
import federated_pb2_grpc

from model import TinyFaceModel, federated_averaging


FL_ROUND_DURATION = Histogram(
    'fl_round_duration_seconds',
    'Time spent on a federated learning round',
    buckets=(1.0, 5.0, 10.0, 30.0, 60.0)
)

FL_CLIENTS_PER_ROUND = Gauge(
    'fl_clients_per_round',
    'Number of clients that participated in each round'
)

FL_UPLOADED_WEIGHTS = Counter(
    'fl_uploaded_weights_total',
    'Total number of weight uploads from clients'
)

FL_GLOBAL_VERSION = Gauge(
    'fl_global_model_version',
    'Current version of the global model'
)

FL_AVERAGE_LOSS = Gauge(
    'fl_average_train_loss',
    'Average training loss across clients'
)

FL_AVERAGE_ACCURACY = Gauge(
    'fl_average_train_accuracy',
    'Average training accuracy across clients'
)


@dataclass
class ClientUpdate:
    client_id: str
    weights: Dict[str, np.ndarray]
    samples_count: int
    train_loss: float
    train_accuracy: float
    timestamp: float = field(default_factory=time.time)


@dataclass
class GlobalModel:
    weights: Dict[str, np.ndarray]
    version: str
    round: int
    timestamp: float


class FederatedServiceServicer(federated_pb2_grpc.FederatedServiceServicer):
    def __init__(self, num_expected_clients: int = 3, max_rounds: int = 5):
        self.num_expected_clients = num_expected_clients
        self.max_rounds = max_rounds

        self._lock = threading.Lock()
        self._client_updates: List[ClientUpdate] = []
        self._current_round = 0
        self._round_start_time = 0.0
        self._round_in_progress = False
        self._global_model: GlobalModel = None
        self._round_ready_event = threading.Event()

        self._init_global_model()

    def _init_global_model(self):
        model = TinyFaceModel()
        weights = model.get_weights()
        self._global_model = GlobalModel(
            weights=weights,
            version=f"v{self._current_round}",
            round=self._current_round,
            timestamp=time.time()
        )
        FL_GLOBAL_VERSION.set(self._current_round)
        print(f"[FL Server] Initial global model created, version: v{self._current_round}")

    def _weights_to_tensors(self, weights: Dict[str, np.ndarray]) -> List[federated_pb2.Tensor]:
        tensors = []
        for name, param in weights.items():
            buffer = io.BytesIO()
            pickle.dump(param, buffer)
            tensors.append(federated_pb2.Tensor(
                name=name,
                data=buffer.getvalue(),
                shape=list(param.shape),
                dtype=str(param.dtype)
            ))
        return tensors

    def _tensors_to_weights(self, tensors: List[federated_pb2.Tensor]) -> Dict[str, np.ndarray]:
        weights = {}
        for tensor in tensors:
            buffer = io.BytesIO(tensor.data)
            weights[tensor.name] = pickle.load(buffer)
        return weights

    def _perform_fedavg(self):
        if len(self._client_updates) < self.num_expected_clients:
            return False

        print(f"[FL Server] Performing FedAvg with {len(self._client_updates)} clients")

        weight_list = [
            (update.weights, update.samples_count)
            for update in self._client_updates
        ]

        avg_loss = np.mean([u.train_loss for u in self._client_updates])
        avg_acc = np.mean([u.train_accuracy for u in self._client_updates])
        FL_AVERAGE_LOSS.set(avg_loss)
        FL_AVERAGE_ACCURACY.set(avg_acc)
        FL_CLIENTS_PER_ROUND.set(len(self._client_updates))

        new_weights = federated_averaging(weight_list)
        self._current_round += 1

        self._global_model = GlobalModel(
            weights=new_weights,
            version=f"v{self._current_round}",
            round=self._current_round,
            timestamp=time.time()
        )
        FL_GLOBAL_VERSION.set(self._current_round)

        round_duration = time.time() - self._round_start_time
        FL_ROUND_DURATION.observe(round_duration)

        print(f"[FL Server] Round {self._current_round} completed:")
        print(f"  - Duration: {round_duration:.2f}s")
        print(f"  - Avg Loss: {avg_loss:.4f}")
        print(f"  - Avg Accuracy: {avg_acc:.4f}")
        print(f"  - New version: v{self._current_round}")

        self._client_updates = []
        self._round_in_progress = False
        self._round_ready_event.set()
        return True

    def StartTrainingRound(self, request, context):
        with self._lock:
            if self._round_in_progress:
                return federated_pb2.StartRoundResponse(
                    started=False,
                    message="Round already in progress"
                )

            if self._current_round >= self.max_rounds:
                return federated_pb2.StartRoundResponse(
                    started=False,
                    message=f"Max rounds ({self.max_rounds}) reached"
                )

            self._round_in_progress = True
            self._round_start_time = time.time()
            self._round_ready_event.clear()
            self._client_updates = []

            print(f"[FL Server] Round {self._current_round + 1} started, "
                  f"waiting for {self.num_expected_clients} clients")

        return federated_pb2.StartRoundResponse(
            started=True,
            message=f"Round {self._current_round + 1} started"
        )

    def UploadWeights(self, request, context):
        FL_UPLOADED_WEIGHTS.inc()

        weights = self._tensors_to_weights(request.weights)

        update = ClientUpdate(
            client_id=request.client_id,
            weights=weights,
            samples_count=request.samples_count,
            train_loss=request.train_loss,
            train_accuracy=request.train_accuracy
        )

        with self._lock:
            if not self._round_in_progress:
                return federated_pb2.UploadWeightsResponse(
                    accepted=False,
                    message="No round in progress",
                    current_round=self._current_round
                )

            self._client_updates.append(update)
            print(f"[FL Server] Received weights from client {request.client_id} "
                  f"(samples: {request.samples_count}, loss: {request.train_loss:.4f}, "
                  f"acc: {request.train_accuracy:.4f})")
            print(f"[FL Server] {len(self._client_updates)}/{self.num_expected_clients} clients uploaded")

            if len(self._client_updates) >= self.num_expected_clients:
                threading.Thread(target=self._perform_fedavg, daemon=True).start()

        return federated_pb2.UploadWeightsResponse(
            accepted=True,
            message="Weights accepted",
            current_round=self._current_round
        )

    def DownloadWeights(self, request, context):
        with self._lock:
            should_stop = self._current_round >= self.max_rounds

            if self._global_model is None:
                return federated_pb2.DownloadWeightsResponse(
                    round=self._current_round,
                    weights=[],
                    ready=False,
                    should_stop=should_stop,
                    global_model_version="none"
                )

            tensors = self._weights_to_tensors(self._global_model.weights)

            return federated_pb2.DownloadWeightsResponse(
                round=self._global_model.round,
                weights=tensors,
                ready=True,
                should_stop=should_stop,
                global_model_version=self._global_model.version
            )


def serve():
    parser = argparse.ArgumentParser(description='Federated Learning Central Server')
    parser.add_argument('--port', type=int, default=50052,
                        help='gRPC server port (default: 50052)')
    parser.add_argument('--metrics-port', type=int, default=8001,
                        help='Prometheus metrics port (default: 8001)')
    parser.add_argument('--num-clients', type=int, default=3,
                        help='Number of expected clients per round (default: 3)')
    parser.add_argument('--max-rounds', type=int, default=5,
                        help='Maximum number of training rounds (default: 5)')
    parser.add_argument('--max-workers', type=int, default=10,
                        help='Max gRPC thread pool workers (default: 10)')
    args = parser.parse_args()

    print(f"[FL Server] Starting Prometheus metrics server on port {args.metrics_port}")
    start_http_server(args.metrics_port)

    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=args.max_workers),
        options=[
            ('grpc.max_send_message_length', 100 * 1024 * 1024),
            ('grpc.max_receive_message_length', 100 * 1024 * 1024),
        ]
    )

    servicer = FederatedServiceServicer(
        num_expected_clients=args.num_clients,
        max_rounds=args.max_rounds
    )
    federated_pb2_grpc.add_FederatedServiceServicer_to_server(servicer, server)

    server.add_insecure_port(f'[::]:{args.port}')
    server.start()

    print(f"[FL Server] gRPC server listening on port {args.port}")
    print(f"[FL Server] Expected clients per round: {args.num_clients}")
    print(f"[FL Server] Max training rounds: {args.max_rounds}")
    print(f"[FL Server] Metrics available at http://localhost:{args.metrics_port}")
    print("[FL Server] Press Ctrl+C to stop")

    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        print("\n[FL Server] Shutting down...")
        server.stop(0)


if __name__ == '__main__':
    serve()