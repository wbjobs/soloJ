import io
import pickle
from typing import Dict, List, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F


class TinyFaceModel(nn.Module):
    def __init__(self, num_classes_gender=2, num_classes_age=8):
        super(TinyFaceModel, self).__init__()

        self.conv1 = nn.Conv2d(3, 16, kernel_size=3, stride=2, padding=1)
        self.bn1 = nn.BatchNorm2d(16)
        self.conv2 = nn.Conv2d(16, 32, kernel_size=3, stride=2, padding=1)
        self.bn2 = nn.BatchNorm2d(32)
        self.conv3 = nn.Conv2d(32, 64, kernel_size=3, stride=2, padding=1)
        self.bn3 = nn.BatchNorm2d(64)

        self.dropout = nn.Dropout(0.25)
        self.fc = nn.Linear(64 * 8 * 8, 128)

        self.gender_head = nn.Linear(128, num_classes_gender)
        self.age_head = nn.Linear(128, num_classes_age)

        self._initialize_weights()

    def _initialize_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.Linear):
                nn.init.normal_(m.weight, 0, 0.01)
                nn.init.constant_(m.bias, 0)

    def forward(self, x):
        x = F.relu(self.bn1(self.conv1(x)))
        x = F.max_pool2d(x, 2)
        x = F.relu(self.bn2(self.conv2(x)))
        x = F.max_pool2d(x, 2)
        x = F.relu(self.bn3(self.conv3(x)))

        x = x.view(x.size(0), -1)
        x = self.dropout(x)
        x = F.relu(self.fc(x))

        gender_logits = self.gender_head(x)
        age_logits = self.age_head(x)

        return gender_logits, age_logits

    def get_weights(self) -> Dict[str, np.ndarray]:
        return {name: param.detach().cpu().numpy()
                for name, param in self.state_dict().items()}

    def set_weights(self, weights: Dict[str, np.ndarray]):
        state_dict = {}
        for name, param in weights.items():
            state_dict[name] = torch.from_numpy(param)
        self.load_state_dict(state_dict)

    def get_gradients(self) -> Dict[str, np.ndarray]:
        grads = {}
        for name, param in self.named_parameters():
            if param.grad is not None:
                grads[name] = param.grad.detach().cpu().numpy()
        return grads

    def serialize_weights(self) -> bytes:
        weights = self.get_weights()
        buffer = io.BytesIO()
        pickle.dump(weights, buffer)
        return buffer.getvalue()

    @classmethod
    def deserialize_weights(cls, data: bytes) -> Dict[str, np.ndarray]:
        buffer = io.BytesIO(data)
        return pickle.load(buffer)


def federated_averaging(weight_list: List[Tuple[Dict[str, np.ndarray], int]]) -> Dict[str, np.ndarray]:
    if not weight_list:
        raise ValueError("No weights provided for averaging")

    total_samples = sum(samples for _, samples in weight_list)

    avg_weights = {}
    for weights, samples in weight_list:
        weight_scalar = samples / total_samples if total_samples > 0 else 1.0 / len(weight_list)

        for name, param in weights.items():
            if name not in avg_weights:
                avg_weights[name] = param * weight_scalar
            else:
                avg_weights[name] += param * weight_scalar

    return avg_weights


def create_mock_face_data(num_samples=32, img_size=64):
    images = np.random.randn(num_samples, 3, img_size, img_size).astype(np.float32)
    genders = np.random.randint(0, 2, num_samples)
    ages = np.random.randint(0, 8, num_samples)

    images = torch.from_numpy(images)
    genders = torch.from_numpy(genders).long()
    ages = torch.from_numpy(ages).long()

    return images, genders, ages


def train_step(model, images, genders, ages, optimizer, device='cpu'):
    model.train()
    images = images.to(device)
    genders = genders.to(device)
    ages = ages.to(device)

    optimizer.zero_grad()

    gender_logits, age_logits = model(images)

    gender_loss = F.cross_entropy(gender_logits, genders)
    age_loss = F.cross_entropy(age_logits, ages)
    total_loss = gender_loss + age_loss

    total_loss.backward()
    optimizer.step()

    gender_pred = gender_logits.argmax(dim=1)
    age_pred = age_logits.argmax(dim=1)
    gender_acc = (gender_pred == genders).float().mean().item()
    age_acc = (age_pred == ages).float().mean().item()
    avg_acc = (gender_acc + age_acc) / 2

    return total_loss.item(), avg_acc