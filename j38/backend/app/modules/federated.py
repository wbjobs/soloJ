import numpy as np
import time
import logging
import uuid
from typing import Optional, List, Dict, Any, Tuple
import warnings
from datetime import datetime

warnings.filterwarnings("ignore")

from ..models import (
    FusionResult, UserRecord, FederatedUpdateRequest,
    VisualFeatures, AudioFeatures, TextFeatures
)
from ..database import MongoDB

logger = logging.getLogger(__name__)


class FederatedLearningClient:
    def __init__(
        self,
        client_id: Optional[str] = None,
        server_address: str = "localhost:8080",
        enable_federation: bool = True
    ):
        self.client_id = client_id or f"client_{uuid.uuid4().hex[:8]}"
        self.server_address = server_address
        self.enable_federation = enable_federation

        self.round_num = 0
        self.local_epochs = 3
        self.batch_size = 32
        self.learning_rate = 0.001
        self.min_learning_rate = 1e-6
        self.learning_rate_decay = 0.95

        self.max_grad_norm = 1.0
        self.max_grad_value = 0.5
        self.weight_decay = 1e-4
        self.gradient_clip_threshold = 5.0

        self.gradient_norms_history = []
        self.explosion_detected = False
        self.explosion_count = 0

        self.model_weights = self._initialize_model_weights()
        self.optimizer_state = self._initialize_optimizer()

        self._flwr_client = None
        self._db = MongoDB()

        if self.enable_federation:
            self._init_flower_client()

    def _initialize_model_weights(self) -> Dict[str, np.ndarray]:
        weights = {}
        scale = 0.01

        weights["visual_projection"] = self._he_init((23, 64), 23)
        weights["audio_projection"] = self._he_init((23, 64), 23)
        weights["text_projection"] = self._he_init((18, 64), 18)

        weights["visual_bias"] = np.zeros(64)
        weights["audio_bias"] = np.zeros(64)
        weights["text_bias"] = np.zeros(64)

        weights["attn_q"] = self._he_init((64, 64), 64)
        weights["attn_k"] = self._he_init((64, 64), 64)
        weights["attn_v"] = self._he_init((64, 64), 64)
        weights["attn_o"] = self._he_init((64, 64), 64)

        weights["fc1"] = self._he_init((192, 128), 192)
        weights["fc2"] = self._he_init((128, 64), 128)
        weights["fc3"] = self._he_init((64, 1), 64)

        weights["bias1"] = np.zeros(128)
        weights["bias2"] = np.zeros(64)
        weights["bias3"] = np.zeros(1)

        return weights

    def _he_init(self, shape: Tuple[int, ...], fan_in: int) -> np.ndarray:
        scale = np.sqrt(2.0 / fan_in)
        return np.random.randn(*shape) * scale

    def _clip_gradient(self, grad: np.ndarray, max_value: float) -> np.ndarray:
        return np.clip(grad, -max_value, max_value)

    def _normalize_gradient(self, grad: np.ndarray, max_norm: float) -> np.ndarray:
        norm = np.linalg.norm(grad)
        if norm > max_norm:
            grad = grad * (max_norm / (norm + 1e-8))
        return grad

    def _apply_weight_decay(self, weight: np.ndarray, grad: np.ndarray, 
                            decay: float, lr: float) -> np.ndarray:
        return grad + decay * weight

    def _compute_total_gradient_norm(self, grads: Dict[str, np.ndarray]) -> float:
        total_norm = 0.0
        for grad in grads.values():
            if grad is not None:
                param_norm = np.linalg.norm(grad)
                total_norm += param_norm ** 2
        return np.sqrt(total_norm)

    def _detect_gradient_explosion(self, grad_norm: float) -> bool:
        self.gradient_norms_history.append(grad_norm)
        
        if len(self.gradient_norms_history) > 10:
            self.gradient_norms_history.pop(0)
        
        if len(self.gradient_norms_history) >= 3:
            avg_norm = np.mean(self.gradient_norms_history)
            if grad_norm > self.gradient_clip_threshold * avg_norm:
                self.explosion_detected = True
                self.explosion_count += 1
                logger.warning(
                    f"Gradient explosion detected! Norm: {grad_norm:.4f}, "
                    f"Avg: {avg_norm:.4f}, Count: {self.explosion_count}"
                )
                return True
        
        if grad_norm > self.gradient_clip_threshold * 10:
            self.explosion_detected = True
            self.explosion_count += 1
            logger.warning(
                f"Extreme gradient norm detected: {grad_norm:.4f}"
            )
            return True
        
        return False

    def _handle_gradient_explosion(self):
        logger.info("Handling gradient explosion...")
        
        self.learning_rate = max(
            self.learning_rate * 0.5,
            self.min_learning_rate
        )
        
        self.model_weights = self._initialize_model_weights()
        self.optimizer_state = self._initialize_optimizer()
        
        self.gradient_norms_history.clear()
        self.explosion_detected = False
        
        logger.info(f"Learning rate adjusted to {self.learning_rate}")

    def _stabilize_gradients(self, grads: Dict[str, np.ndarray], 
                              weights: Dict[str, np.ndarray], 
                              lr: float) -> Dict[str, np.ndarray]:
        stabilized_grads = {}
        
        for key, grad in grads.items():
            if grad is None or key not in weights:
                continue
            
            grad = self._clip_gradient(grad, self.max_grad_value)
            
            grad = self._normalize_gradient(grad, self.max_grad_norm)
            
            if "bias" not in key:
                grad = self._apply_weight_decay(weights[key], grad, self.weight_decay, lr)
            
            stabilized_grads[key] = grad
        
        total_norm = self._compute_total_gradient_norm(stabilized_grads)
        
        if self._detect_gradient_explosion(total_norm):
            self._handle_gradient_explosion()
            return None
        
        return stabilized_grads

    def _update_learning_rate(self, epoch_loss: float):
        if self.round_num > 0 and self.round_num % 5 == 0:
            self.learning_rate = max(
                self.learning_rate * self.learning_rate_decay,
                self.min_learning_rate
            )
            logger.info(f"Learning rate decayed to {self.learning_rate}")

    def _initialize_optimizer(self) -> Dict[str, np.ndarray]:
        return {
            key: np.zeros_like(value)
            for key, value in self.model_weights.items()
        }

    def _init_flower_client(self):
        try:
            import flwr as fl
            self.fl = fl

            class MDSClient(fl.client.NumPyClient):
                def __init__(self, parent):
                    self.parent = parent

                def get_parameters(self, config):
                    return [
                        self.parent.model_weights[key].tolist()
                        for key in sorted(self.parent.model_weights.keys())
                    ]

                def set_parameters(self, parameters):
                    for i, key in enumerate(sorted(self.parent.model_weights.keys())):
                        self.parent.model_weights[key] = np.array(parameters[i])

                def fit(self, parameters, config):
                    self.set_parameters(parameters)
                    losses, sample_count = self.parent._local_training()
                    return self.get_parameters(config), sample_count, {"loss": np.mean(losses)}

                def evaluate(self, parameters, config):
                    self.set_parameters(parameters)
                    loss, accuracy, sample_count = self.parent._local_evaluation()
                    return float(loss), sample_count, {"accuracy": float(accuracy)}

            self._flwr_client = MDSClient(self)
            logger.info(f"Flower client initialized for {self.client_id}")
        except ImportError as e:
            logger.warning(f"Flower not available, federated learning disabled: {e}")
            self.enable_federation = False
        except Exception as e:
            logger.warning(f"Failed to initialize Flower client: {e}")
            self.enable_federation = False

    def _prepare_training_data(self) -> List[Dict[str, Any]]:
        try:
            samples = self._db.get_training_samples(limit=1000)
            training_data = []

            for sample in samples:
                try:
                    visual_features = sample.get("visual_features", {})
                    audio_features = sample.get("audio_features", {})
                    text_features = sample.get("text_features", {})
                    fusion_result = sample.get("fusion_result", {})

                    visual_vec = np.array(visual_features.get("feature_vector", np.zeros(23)))
                    audio_vec = np.array(audio_features.get("feature_vector", np.zeros(23)))
                    text_vec = np.array(text_features.get("feature_vector", np.zeros(18)))

                    label = fusion_result.get("depression_score", 50.0) / 100.0

                    if len(visual_vec) == 23 and len(audio_vec) == 23 and len(text_vec) == 18:
                        training_data.append({
                            "visual": visual_vec,
                            "audio": audio_vec,
                            "text": text_vec,
                            "label": label,
                            "session_id": sample.get("session_id", "")
                        })
                except Exception as e:
                    logger.warning(f"Failed to process training sample: {e}")
                    continue

            logger.info(f"Prepared {len(training_data)} training samples")
            return training_data

        except Exception as e:
            logger.error(f"Failed to prepare training data: {e}")
            return []

    def _normalize(self, x: np.ndarray) -> np.ndarray:
        mean = np.mean(x, axis=-1, keepdims=True)
        std = np.std(x, axis=-1, keepdims=True) + 1e-8
        return (x - mean) / std

    def _sigmoid(self, x: np.ndarray) -> np.ndarray:
        return 1 / (1 + np.exp(-np.clip(x, -10, 10)))

    def _relu(self, x: np.ndarray) -> np.ndarray:
        return np.maximum(0, x)

    def _forward_pass(
        self,
        visual: np.ndarray,
        audio: np.ndarray,
        text: np.ndarray
    ) -> Tuple[float, Dict[str, np.ndarray]]:
        visual = self._normalize(visual)
        audio = self._normalize(audio)
        text = self._normalize(text)

        v_proj = np.matmul(visual, self.model_weights["visual_projection"]) + self.model_weights["visual_bias"]
        a_proj = np.matmul(audio, self.model_weights["audio_projection"]) + self.model_weights["audio_bias"]
        t_proj = np.matmul(text, self.model_weights["text_projection"]) + self.model_weights["text_bias"]

        combined = np.stack([v_proj, a_proj, t_proj], axis=0)

        Q = np.matmul(combined, self.model_weights["attn_q"])
        K = np.matmul(combined, self.model_weights["attn_k"])
        V = np.matmul(combined, self.model_weights["attn_v"])

        d_k = Q.shape[-1]
        attn_scores = np.matmul(Q, K.T) / np.sqrt(d_k)
        attn_weights = self._softmax(attn_scores)
        attn_output = np.matmul(attn_weights, V)
        attn_output = np.matmul(attn_output.reshape(-1), self.model_weights["attn_o"].reshape(64, 64))

        flattened = combined.reshape(-1) + attn_output

        x = self._relu(np.matmul(flattened, self.model_weights["fc1"]) + self.model_weights["bias1"])
        x = self._relu(np.matmul(x, self.model_weights["fc2"]) + self.model_weights["bias2"])
        logit = np.matmul(x, self.model_weights["fc3"]) + self.model_weights["bias3"]

        prediction = self._sigmoid(logit)[0]

        cache = {
            "v_proj": v_proj,
            "a_proj": a_proj,
            "t_proj": t_proj,
            "combined": combined,
            "Q": Q,
            "K": K,
            "V": V,
            "attn_weights": attn_weights,
            "attn_output": attn_output,
            "flattened": flattened,
            "fc1_out": x,
            "fc2_out": x,
            "logit": logit,
            "prediction": prediction
        }

        return prediction, cache

    def _softmax(self, x: np.ndarray) -> np.ndarray:
        x = x - np.max(x, axis=-1, keepdims=True)
        exp_x = np.exp(x)
        return exp_x / np.sum(exp_x, axis=-1, keepdims=True)

    def _compute_loss(self, prediction: float, label: float) -> float:
        eps = 1e-7
        prediction = np.clip(prediction, eps, 1 - eps)
        return -(label * np.log(prediction) + (1 - label) * np.log(1 - prediction))

    def _compute_gradients(
        self,
        cache: Dict[str, np.ndarray],
        prediction: float,
        label: float,
        visual: np.ndarray,
        audio: np.ndarray,
        text: np.ndarray
    ) -> Dict[str, np.ndarray]:
        grads = {}

        d_pred = prediction - label

        d_logit = d_pred * prediction * (1 - prediction)
        grads["fc3"] = np.outer(cache["fc2_out"], d_logit)
        grads["bias3"] = d_logit

        d_fc2 = np.matmul(d_logit.reshape(1, -1), self.model_weights["fc3"].T).squeeze()
        d_fc2_relu = d_fc2 * (cache["fc2_out"] > 0)
        grads["fc2"] = np.outer(cache["fc1_out"], d_fc2_relu)
        grads["bias2"] = d_fc2_relu

        d_fc1 = np.matmul(d_fc2_relu.reshape(1, -1), self.model_weights["fc2"].T).squeeze()
        d_fc1_relu = d_fc1 * (cache["fc1_out"] > 0)
        grads["fc1"] = np.outer(cache["flattened"], d_fc1_relu)
        grads["bias1"] = d_fc1_relu

        d_flattened = np.matmul(d_fc1_relu.reshape(1, -1), self.model_weights["fc1"].T).squeeze()
        d_combined = d_flattened.reshape(3, 64)

        d_attn_output = np.matmul(d_flattened.reshape(1, -1), self.model_weights["attn_o"].T).squeeze()
        grads["attn_o"] = np.outer(cache["attn_output"], d_attn_output)

        grads["visual_projection"] = np.outer(visual, d_combined[0])
        grads["audio_projection"] = np.outer(audio, d_combined[1])
        grads["text_projection"] = np.outer(text, d_combined[2])

        grads["visual_bias"] = d_combined[0]
        grads["audio_bias"] = d_combined[1]
        grads["text_bias"] = d_combined[2]

        return grads

    def _local_training(self) -> Tuple[List[float], int]:
        training_data = self._prepare_training_data()
        if not training_data:
            return [], 0

        losses = []
        sample_count = len(training_data)
        grad_norm_log = []

        for epoch in range(self.local_epochs):
            np.random.shuffle(training_data)
            epoch_loss = 0.0
            epoch_grad_norms = []

            for i, sample in enumerate(training_data):
                prediction, cache = self._forward_pass(
                    sample["visual"], sample["audio"], sample["text"]
                )
                loss = self._compute_loss(prediction, sample["label"])
                epoch_loss += loss

                grads = self._compute_gradients(
                    cache, prediction, sample["label"],
                    sample["visual"], sample["audio"], sample["text"]
                )

                stabilized_grads = self._stabilize_gradients(
                    grads, self.model_weights, self.learning_rate
                )

                if stabilized_grads is None:
                    logger.warning("Skipping update due to gradient explosion")
                    continue

                grad_norm = self._compute_total_gradient_norm(stabilized_grads)
                epoch_grad_norms.append(grad_norm)

                for key in self.model_weights:
                    if key in stabilized_grads:
                        grad = stabilized_grads[key]
                        self.optimizer_state[key] = 0.9 * self.optimizer_state[key] + 0.1 * grad ** 2
                        self.model_weights[key] -= (
                            self.learning_rate * grad /
                            (np.sqrt(self.optimizer_state[key]) + 1e-7)
                        )

            avg_loss = epoch_loss / len(training_data)
            losses.append(avg_loss)
            
            avg_grad_norm = np.mean(epoch_grad_norms) if epoch_grad_norms else 0.0
            grad_norm_log.append(avg_grad_norm)
            
            logger.info(
                f"Epoch {epoch + 1}/{self.local_epochs}, Loss: {avg_loss:.4f}, "
                f"Avg Grad Norm: {avg_grad_norm:.4f}"
            )

            self._update_learning_rate(avg_loss)

        return losses, sample_count

    def _aggregate_gradients_safely(
        self,
        client_gradients: List[Dict[str, np.ndarray]],
        client_weights: Optional[List[float]] = None
    ) -> Dict[str, np.ndarray]:
        if not client_gradients:
            return {}

        if client_weights is None:
            client_weights = [1.0 / len(client_gradients)] * len(client_gradients)

        client_weights = np.array(client_weights) / np.sum(client_weights)

        aggregated = {}
        all_keys = set()
        for grads in client_gradients:
            all_keys.update(grads.keys())

        for key in all_keys:
            grads_list = []
            valid_weights = []
            
            for i, grads in enumerate(client_gradients):
                if key in grads and grads[key] is not None:
                    grad = grads[key].copy()
                    
                    grad_norm = np.linalg.norm(grad)
                    if grad_norm > self.gradient_clip_threshold:
                        grad = grad * (self.gradient_clip_threshold / (grad_norm + 1e-8))
                    
                    if not np.any(np.isnan(grad)) and not np.any(np.isinf(grad)):
                        grads_list.append(grad)
                        valid_weights.append(client_weights[i])
            
            if not grads_list:
                aggregated[key] = np.zeros_like(list(client_gradients[0].values())[0])
                continue
            
            valid_weights = np.array(valid_weights) / np.sum(valid_weights)
            
            stacked = np.stack(grads_list)
            median = np.median(stacked, axis=0)
            
            mad = np.median(np.abs(stacked - median), axis=0) + 1e-8
            
            filtered_grads = []
            filtered_weights = []
            
            for i, grad in enumerate(grads_list):
                z_score = np.abs(grad - median) / mad
                if np.all(z_score < 3.0):
                    filtered_grads.append(grad)
                    filtered_weights.append(valid_weights[i])
            
            if not filtered_grads:
                aggregated[key] = median
                continue
            
            filtered_weights = np.array(filtered_weights) / np.sum(filtered_weights)
            
            aggregated[key] = np.zeros_like(filtered_grads[0])
            for i, grad in enumerate(filtered_grads):
                aggregated[key] += filtered_weights[i] * grad
            
            agg_norm = np.linalg.norm(aggregated[key])
            if agg_norm > self.gradient_clip_threshold:
                aggregated[key] = aggregated[key] * (
                    self.gradient_clip_threshold / (agg_norm + 1e-8)
                )

        return aggregated

    def get_training_stats(self) -> Dict[str, Any]:
        return {
            "client_id": self.client_id,
            "round_num": self.round_num,
            "learning_rate": self.learning_rate,
            "explosion_count": self.explosion_count,
            "recent_grad_norms": self.gradient_norms_history[-10:] if self.gradient_norms_history else [],
            "max_grad_norm": max(self.gradient_norms_history) if self.gradient_norms_history else 0.0,
            "avg_grad_norm": np.mean(self.gradient_norms_history) if self.gradient_norms_history else 0.0
        }

    def _local_evaluation(self) -> Tuple[float, float, int]:
        training_data = self._prepare_training_data()
        if not training_data:
            return 0.0, 0.0, 0

        total_loss = 0.0
        correct = 0
        sample_count = len(training_data)

        for sample in training_data:
            prediction, _ = self._forward_pass(
                sample["visual"], sample["audio"], sample["text"]
            )
            loss = self._compute_loss(prediction, sample["label"])
            total_loss += loss

            predicted_class = prediction > 0.5
            actual_class = sample["label"] > 0.5
            if predicted_class == actual_class:
                correct += 1

        avg_loss = total_loss / sample_count
        accuracy = correct / sample_count

        return avg_loss, accuracy, sample_count

    def train_local(self) -> Dict[str, Any]:
        start_time = time.time()
        logger.info(f"Starting local training for client {self.client_id}")

        try:
            losses, sample_count = self._local_training()
            loss = np.mean(losses) if losses else 0.0

            weights_dict = {
                key: value.tolist()
                for key, value in self.model_weights.items()
            }

            result = {
                "client_id": self.client_id,
                "round_num": self.round_num,
                "loss": float(loss),
                "sample_count": sample_count,
                "model_weights": weights_dict,
                "training_time_ms": (time.time() - start_time) * 1000
            }

            self.round_num += 1

            update_request = FederatedUpdateRequest(
                client_id=self.client_id,
                round_num=self.round_num,
                model_weights=weights_dict,
                sample_count=sample_count,
                metrics={"loss": float(loss)}
            )

            self._db.save_federated_update(update_request.model_dump())

            logger.info(f"Local training completed, loss: {loss:.4f}, samples: {sample_count}")

            return result

        except Exception as e:
            logger.error(f"Local training failed: {e}")
            return {
                "client_id": self.client_id,
                "round_num": self.round_num,
                "loss": 0.0,
                "sample_count": 0,
                "error": str(e)
            }

    def update_global_weights(self, global_weights: Dict[str, List[float]]) -> bool:
        try:
            for key, value in global_weights.items():
                if key in self.model_weights:
                    self.model_weights[key] = np.array(value)

            version_data = {
                "version": self.round_num,
                "weights": global_weights,
                "timestamp": datetime.utcnow(),
                "client_id": self.client_id
            }
            self._db.save_model_version(version_data)

            logger.info(f"Global weights updated for round {self.round_num}")
            return True

        except Exception as e:
            logger.error(f"Failed to update global weights: {e}")
            return False

    def start_federated_client(self):
        if not self.enable_federation or self._flwr_client is None:
            logger.warning("Federated learning not available")
            return False

        try:
            self.fl.client.start_numpy_client(
                server_address=self.server_address,
                client=self._flwr_client
            )
            return True
        except Exception as e:
            logger.error(f"Failed to start federated client: {e}")
            return False

    def get_model_weights_dict(self) -> Dict[str, List[float]]:
        return {
            key: value.tolist()
            for key, value in self.model_weights.items()
        }

    def mark_sample_used(self, session_id: str):
        try:
            self._db.update_record_training_status(session_id, True)
        except Exception as e:
            logger.error(f"Failed to mark sample used: {e}")
