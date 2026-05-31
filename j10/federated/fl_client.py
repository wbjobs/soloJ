import sys
import os
import time
import argparse
import pickle
import io
from typing import Dict, List

import numpy as np
import torch
import torch.optim as optim
import grpc

sys.path.insert(0, os.path.dirname(__file__))
import federated_pb2
import federated_pb2_grpc

from model import TinyFaceModel, train_step, create_mock_face_data


class FederatedClient:
    def __init__(self, client_id: str, server_addr: str,
                 local_epochs: int = 3,
                 batch_size: int = 32,
                 lr: float = 0.001,
                 device: str = 'cpu'):
        self.client_id = client_id
        self.server_addr = server_addr
        self.local_epochs = local_epochs
        self.batch_size = batch_size
        self.lr = lr
        self.device = device

        self.model = TinyFaceModel().to(device)
        self.optimizer = optim.Adam(self.model.parameters(), lr=lr)

        self.current_round = 0
        self.local_samples_count = 0

        self._setup_channel()

    def _setup_channel(self):
        options = [
            ('grpc.max_send_message_length', 100 * 1024 * 1024),
            ('grpc.max_receive_message_length', 100 * 1024 * 1024),
        ]
        self.channel = grpc.insecure_channel(self.server_addr, options=options)
        self.stub = federated_pb2_grpc.FederatedServiceStub(self.channel)

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

    def download_global_model(self) -> bool:
        print(f"[Client {self.client_id}] Downloading global model...")

        request = federated_pb2.DownloadWeightsRequest(
            client_id=self.client_id,
            current_round=self.current_round
        )

        try:
            response = self.stub.DownloadWeights(request, timeout=30)
        except grpc.RpcError as e:
            print(f"[Client {self.client_id}] Failed to download model: {e}")
            return False

        if not response.ready:
            print(f"[Client {self.client_id}] Global model not ready")
            return False

        if response.should_stop:
            print(f"[Client {self.client_id}] Server indicated training should stop")
            return False

        weights = self._tensors_to_weights(response.weights)
        self.model.set_weights(weights)
        self.current_round = response.round

        print(f"[Client {self.client_id}] Loaded global model version: {response.global_model_version}")
        return True

    def local_train(self, num_batches: int = 10) -> Dict:
        print(f"[Client {self.client_id}] Starting local training for {self.local_epochs} epochs...")

        total_loss = 0.0
        total_acc = 0.0
        total_samples = 0

        self.model.train()

        for epoch in range(self.local_epochs):
            epoch_loss = 0.0
            epoch_acc = 0.0
            batches_done = 0

            for batch_idx in range(num_batches):
                images, genders, ages = create_mock_face_data(
                    num_samples=self.batch_size,
                    img_size=64
                )

                loss, acc = train_step(
                    self.model, images, genders, ages,
                    self.optimizer, self.device
                )

                epoch_loss += loss
                epoch_acc += acc
                batches_done += 1
                total_samples += self.batch_size

                if (batch_idx + 1) % 5 == 0:
                    print(f"[Client {self.client_id}] Epoch {epoch + 1}/{self.local_epochs}, "
                          f"Batch {batch_idx + 1}/{num_batches}, "
                          f"Loss: {loss:.4f}, Acc: {acc:.4f}")

            avg_epoch_loss = epoch_loss / batches_done if batches_done > 0 else 0
            avg_epoch_acc = epoch_acc / batches_done if batches_done > 0 else 0
            total_loss += avg_epoch_loss
            total_acc += avg_epoch_acc

        avg_loss = total_loss / self.local_epochs
        avg_acc = total_acc / self.local_epochs
        self.local_samples_count = total_samples

        print(f"[Client {self.client_id}] Local training complete: "
              f"Avg Loss: {avg_loss:.4f}, Avg Acc: {avg_acc:.4f}, "
              f"Samples: {total_samples}")

        return {
            'loss': avg_loss,
            'accuracy': avg_acc,
            'samples': total_samples
        }

    def upload_weights(self, train_stats: Dict) -> bool:
        print(f"[Client {self.client_id}] Uploading weights to server...")

        weights = self.model.get_weights()
        tensors = self._weights_to_tensors(weights)

        request = federated_pb2.UploadWeightsRequest(
            client_id=self.client_id,
            round=self.current_round,
            weights=tensors,
            samples_count=train_stats['samples'],
            train_loss=train_stats['loss'],
            train_accuracy=train_stats['accuracy']
        )

        try:
            response = self.stub.UploadWeights(request, timeout=30)
        except grpc.RpcError as e:
            print(f"[Client {self.client_id}] Failed to upload weights: {e}")
            return False

        if response.accepted:
            print(f"[Client {self.client_id}] Weights accepted by server")
            return True
        else:
            print(f"[Client {self.client_id}] Weights rejected: {response.message}")
            return False

    def run_round(self, num_batches: int = 10) -> bool:
        print(f"\n{'=' * 60}")
        print(f"[Client {self.client_id}] Starting round {self.current_round + 1}")
        print(f"{'=' * 60}")

        if not self.download_global_model():
            return False

        train_stats = self.local_train(num_batches=num_batches)

        if not self.upload_weights(train_stats):
            return False

        print(f"[Client {self.client_id}] Round {self.current_round} complete\n")
        return True

    def run(self, num_rounds: int = 5, num_batches: int = 10, wait_between_rounds: int = 5):
        print(f"[Client {self.client_id}] Starting federated learning client")
        print(f"[Client {self.client_id}] Server: {self.server_addr}")
        print(f"[Client {self.client_id}] Local epochs: {self.local_epochs}")
        print(f"[Client {self.client_id}] Batch size: {self.batch_size}")

        for round_idx in range(num_rounds):
            try:
                success = self.run_round(num_batches=num_batches)
                if not success:
                    print(f"[Client {self.client_id}] Round failed, stopping")
                    break

                if round_idx < num_rounds - 1:
                    print(f"[Client {self.client_id}] Waiting {wait_between_rounds}s before next round...")
                    time.sleep(wait_between_rounds)

            except KeyboardInterrupt:
                print(f"\n[Client {self.client_id}] Interrupted by user")
                break
            except Exception as e:
                print(f"[Client {self.client_id}] Error: {e}")
                import traceback
                traceback.print_exc()
                break

        self.channel.close()
        print(f"[Client {self.client_id}] Client stopped")


def main():
    parser = argparse.ArgumentParser(description='Federated Learning Edge Client')
    parser.add_argument('--client-id', type=str, required=True,
                        help='Unique client ID')
    parser.add_argument('--server', type=str, default='localhost:50052',
                        help='Federated server address (default: localhost:50052)')
    parser.add_argument('--local-epochs', type=int, default=3,
                        help='Number of local training epochs (default: 3)')
    parser.add_argument('--batch-size', type=int, default=32,
                        help='Batch size for local training (default: 32)')
    parser.add_argument('--lr', type=float, default=0.001,
                        help='Learning rate (default: 0.001)')
    parser.add_argument('--num-rounds', type=int, default=5,
                        help='Number of training rounds (default: 5)')
    parser.add_argument('--num-batches', type=int, default=10,
                        help='Number of batches per epoch (default: 10)')
    parser.add_argument('--wait', type=int, default=5,
                        help='Wait time between rounds in seconds (default: 5)')
    parser.add_argument('--device', type=str, default='cpu',
                        help='Device to use (cpu/cuda, default: cpu)')
    args = parser.parse_args()

    client = FederatedClient(
        client_id=args.client_id,
        server_addr=args.server,
        local_epochs=args.local_epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        device=args.device
    )
    client.run(
        num_rounds=args.num_rounds,
        num_batches=args.num_batches,
        wait_between_rounds=args.wait
    )


if __name__ == '__main__':
    main()