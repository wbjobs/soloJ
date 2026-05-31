import os
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from typing import Dict, List, Tuple, Optional
import logging
from datetime import datetime

from .surrogate_model import BandGapDataset

logger = logging.getLogger(__name__)


class BandGapNN(nn.Module):
    def __init__(self, input_dim: int = 8, hidden_dims: List[int] = None):
        super().__init__()

        if hidden_dims is None:
            hidden_dims = [128, 256, 128, 64]

        layers = []
        prev_dim = input_dim

        for hidden_dim in hidden_dims:
            layers.extend([
                nn.Linear(prev_dim, hidden_dim),
                nn.BatchNorm1d(hidden_dim),
                nn.ReLU(),
                nn.Dropout(0.2)
            ])
            prev_dim = hidden_dim

        layers.append(nn.Linear(prev_dim, 1))

        self.network = nn.Sequential(*layers)
        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.kaiming_normal_(m.weight, nonlinearity='relu')
                nn.init.constant_(m.bias, 0.01)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.network(x)


class EnsembleNN:
    def __init__(self, n_models: int = 5, input_dim: int = 8, hidden_dims: List[int] = None):
        self.n_models = n_models
        self.models = [BandGapNN(input_dim, hidden_dims) for _ in range(n_models)]
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        for model in self.models:
            model.to(self.device)

    def train_all(self, X_train: np.ndarray, y_train: np.ndarray,
                  X_val: np.ndarray = None, y_val: np.ndarray = None,
                  epochs: int = 200, batch_size: int = 32, lr: float = 1e-3):

        training_stats = []

        for i, model in enumerate(self.models):
            logger.info(f"Training model {i+1}/{self.n_models}...")
            stats = self._train_single(
                model, X_train, y_train, X_val, y_val, epochs, batch_size, lr
            )
            training_stats.append(stats)

        return training_stats

    def _train_single(self, model: nn.Module, X_train: np.ndarray, y_train: np.ndarray,
                      X_val: np.ndarray, y_val: np.ndarray, epochs: int,
                      batch_size: int, lr: float) -> Dict:

        X_t = torch.tensor(X_train, dtype=torch.float32, device=self.device)
        y_t = torch.tensor(y_train, dtype=torch.float32, device=self.device)

        dataset = TensorDataset(X_t, y_t)
        loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

        optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-5)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, mode='min', factor=0.5, patience=10, verbose=False
        )

        criterion = nn.MSELoss()
        best_val_loss = float('inf')
        best_state = None
        patience_counter = 0

        stats = {'train_loss': [], 'val_loss': []}

        for epoch in range(epochs):
            model.train()
            train_loss = 0.0
            n_batches = 0

            for batch_X, batch_y in loader:
                optimizer.zero_grad()
                pred = model(batch_X)
                loss = criterion(pred, batch_y)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()
                train_loss += loss.item()
                n_batches += 1

            train_loss /= max(n_batches, 1)
            stats['train_loss'].append(train_loss)

            if X_val is not None and y_val is not None:
                model.eval()
                with torch.no_grad():
                    X_v = torch.tensor(X_val, dtype=torch.float32, device=self.device)
                    y_v = torch.tensor(y_val, dtype=torch.float32, device=self.device)
                    val_pred = model(X_v)
                    val_loss = criterion(val_pred, y_v).item()
                stats['val_loss'].append(val_loss)
                scheduler.step(val_loss)

                if val_loss < best_val_loss:
                    best_val_loss = val_loss
                    best_state = model.state_dict().copy()
                    patience_counter = 0
                else:
                    patience_counter += 1

                if patience_counter >= 30:
                    logger.info(f"Early stopping at epoch {epoch}")
                    break

            if epoch % 50 == 0:
                logger.info(f"  Epoch {epoch}: train={train_loss:.4f}, val={stats['val_loss'][-1] if X_val is not None else 'N/A'}")

        if best_state is not None:
            model.load_state_dict(best_state)

        return stats

    def predict(self, X: np.ndarray, return_std: bool = False) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        if len(self.models) == 0:
            raise ValueError("No trained models")

        self.eval()
        X_t = torch.tensor(X, dtype=torch.float32, device=self.device)

        predictions = []
        with torch.no_grad():
            for model in self.models:
                pred = model(X_t).cpu().numpy()
                predictions.append(pred)

        predictions = np.array(predictions)
        mean_pred = np.mean(predictions, axis=0)

        if return_std:
            std_pred = np.std(predictions, axis=0)
            return mean_pred, std_pred
        return mean_pred, None

    def eval(self):
        for model in self.models:
            model.eval()

    def train(self):
        for model in self.models:
            model.train()

    def save(self, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        state_dicts = [model.state_dict() for model in self.models]
        torch.save({
            'models': state_dicts,
            'n_models': self.n_models
        }, path)
        logger.info(f"Model saved to {path}")

    def load(self, path: str):
        checkpoint = torch.load(path, map_location=self.device)
        if len(self.models) != checkpoint['n_models']:
            self.models = [BandGapNN() for _ in range(checkpoint['n_models'])]
        for i, model in enumerate(self.models):
            model.load_state_dict(checkpoint['models'][i])
            model.to(self.device)
        logger.info(f"Model loaded from {path}")


class SurrogateModelTrainer:
    def __init__(self, hdf5_path: str = None):
        self.dataset = BandGapDataset(hdf5_path)
        self.model = EnsembleNN(n_models=5)
        self.is_trained = False
        self.model_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'data', 'models', 'surrogate_model.pt'
        )

    def prepare_data(self, use_synthetic_if_empty: bool = True,
                     n_synthetic: int = 2000) -> bool:

        X_train, X_test, y_train, y_test = None, None, None, None

        X_h5, y_h5 = self.dataset.load_from_hdf5(max_files=50)
        if len(X_h5) > 0:
            logger.info(f"Using {len(X_h5)} real HDF5 samples")
            X_train, X_test, y_train, y_test = self.dataset.train_test_split(0.2)

        if X_train is None or len(X_train) < 100:
            if use_synthetic_if_empty:
                logger.warning(f"Insufficient real data ({len(X_h5)}), using synthetic data")
                self.dataset.generate_synthetic_data(n_synthetic)
                X_train, X_test, y_train, y_test = self.dataset.train_test_split(0.2)
            else:
                logger.error("Not enough data to train model")
                return False

        X_train_norm = self.dataset.normalize_X(X_train)
        X_test_norm = self.dataset.normalize_X(X_test)
        y_train_norm = self.dataset.normalize_y(y_train)
        y_test_norm = self.dataset.normalize_y(y_test)

        self.X_train = X_train_norm
        self.X_test = X_test_norm
        self.y_train = y_train_norm
        self.y_test = y_test_norm

        logger.info(f"Training data: {len(X_train_norm)}, Test data: {len(X_test_norm)}")
        return True

    def train(self, epochs: int = 200) -> Dict:
        if not hasattr(self, 'X_train'):
            if not self.prepare_data():
                raise RuntimeError("Failed to prepare training data")

        stats = self.model.train_all(
            self.X_train, self.y_train,
            self.X_test, self.y_test,
            epochs=epochs
        )

        self.is_trained = True
        self.save()

        train_score, train_std = self.model.predict(self.X_train, return_std=True)
        test_score, test_std = self.model.predict(self.X_test, return_std=True)

        train_rmse = np.sqrt(np.mean((train_score - self.y_train) ** 2))
        test_rmse = np.sqrt(np.mean((test_score - self.y_test) ** 2))

        train_mae = np.mean(np.abs(train_score - self.y_train))
        test_mae = np.mean(np.abs(test_score - self.y_test))

        result = {
            'training_stats': stats,
            'train_rmse': float(train_rmse),
            'test_rmse': float(test_rmse),
            'train_mae': float(train_mae),
            'test_mae': float(test_mae),
            'n_train_samples': len(self.X_train),
            'n_test_samples': len(self.X_test),
            'timestamp': datetime.now().isoformat()
        }

        logger.info(f"Training complete. Test RMSE: {test_rmse:.4f}, Test MAE: {test_mae:.4f}")
        return result

    def predict(self, params: Dict[str, float], return_std: bool = False) -> Tuple[float, Optional[float]]:
        if not self.is_trained:
            if not self.load():
                raise RuntimeError("Model not trained and no saved model found")

        param_vec = np.array([[float(params.get(name, 0.0))
                              for name in self.dataset.PARAM_NAMES]], dtype=np.float32)
        param_norm = self.dataset.normalize_X(param_vec)

        pred, std = self.model.predict(param_norm, return_std=return_std)

        pred_denorm = float(self.dataset.denormalize_y(pred[0])[0])
        std_denorm = float(std[0]) * self.dataset.y_std if std is not None else None

        return pred_denorm, std_denorm

    def predict_batch(self, params_list: List[Dict[str, float]],
                      return_std: bool = False) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        if not self.is_trained:
            if not self.load():
                raise RuntimeError("Model not trained and no saved model found")

        param_mat = np.array([
            [float(params.get(name, 0.0)) for name in self.dataset.PARAM_NAMES]
            for params in params_list
        ], dtype=np.float32)

        param_norm = self.dataset.normalize_X(param_mat)
        pred, std = self.model.predict(param_norm, return_std=return_std)

        pred_denorm = self.dataset.denormalize_y(pred).flatten()
        std_denorm = std.flatten() * self.dataset.y_std if std is not None else None

        return pred_denorm, std_denorm

    def save(self):
        self.model.save(self.model_path)

    def load(self) -> bool:
        if os.path.exists(self.model_path):
            self.model.load(self.model_path)
            self.is_trained = True
            return True
        return False

    def get_model_info(self) -> Dict:
        return {
            'is_trained': self.is_trained,
            'model_path': self.model_path,
            'n_models': self.model.n_models,
            'param_names': self.dataset.PARAM_NAMES,
            'param_ranges': self.dataset.param_ranges if hasattr(self.dataset, 'param_ranges') else {}
        }
