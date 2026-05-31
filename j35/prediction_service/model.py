import torch
import torch.nn as nn

NUM_SKILLS = 10
FEATURE_DIM = 15
SEQUENCE_LENGTH = 20
HIDDEN_SIZE = 128
NUM_LAYERS = 2
DROPOUT = 0.2


class SkillPredictor(nn.Module):
    def __init__(self, feature_dim=FEATURE_DIM, hidden_size=HIDDEN_SIZE,
                 num_layers=NUM_LAYERS, num_skills=NUM_SKILLS, dropout=DROPOUT):
        super(SkillPredictor, self).__init__()
        self.feature_dim = feature_dim
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.num_skills = num_skills

        self.lstm = nn.LSTM(
            input_size=feature_dim,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0
        )

        self.fc = nn.Sequential(
            nn.Linear(hidden_size, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, num_skills)
        )

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        last_hidden = lstm_out[:, -1, :]
        logits = self.fc(last_hidden)
        return logits

    def predict_top3(self, x):
        logits = self.forward(x)
        probs = torch.softmax(logits, dim=-1)
        top3_probs, top3_indices = torch.topk(probs, k=3, dim=-1)
        return top3_indices, top3_probs


def encode_features(skill_id, pos_x, pos_y, target_dist, cooldown_ratio, hp_pct):
    one_hot = [0.0] * NUM_SKILLS
    idx = int(skill_id) - 1
    if 0 <= idx < NUM_SKILLS:
        one_hot[idx] = 1.0
    features = one_hot + [
        float(pos_x),
        float(pos_y),
        float(target_dist),
        float(cooldown_ratio),
        float(hp_pct)
    ]
    return features
