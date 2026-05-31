import os
import csv
import random
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader
from model import SkillPredictor, encode_features, SEQUENCE_LENGTH, NUM_SKILLS

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
CSV_PATH = os.path.join(DATA_DIR, "training_data.csv")
PT_PATH = os.path.join(MODEL_DIR, "skill_predictor.pt")

BATCH_SIZE = 64
EPOCHS = 30
LEARNING_RATE = 0.001
TRAIN_RATIO = 0.8


class SkillSequenceDataset(Dataset):
    def __init__(self, sequences, labels):
        self.sequences = torch.tensor(sequences, dtype=torch.float32)
        self.labels = torch.tensor(labels, dtype=torch.long)

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return self.sequences[idx], self.labels[idx]


def load_csv(path):
    rows = []
    with open(path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def build_sequences(rows):
    by_player = {}
    for row in rows:
        pid = int(row["player_id"])
        if pid not in by_player:
            by_player[pid] = []
        features = encode_features(
            int(row["skill_id"]),
            float(row["pos_x"]),
            float(row["pos_y"]),
            float(row["target_dist"]),
            float(row["cooldown_ratio"]),
            float(row["hp_pct"])
        )
        skill_id = int(row["skill_id"])
        by_player[pid].append((features, skill_id))

    sequences = []
    labels = []
    for pid, ops in by_player.items():
        if len(ops) < SEQUENCE_LENGTH + 1:
            continue
        for i in range(len(ops) - SEQUENCE_LENGTH):
            seq = [ops[j][0] for j in range(i, i + SEQUENCE_LENGTH)]
            label = ops[i + SEQUENCE_LENGTH][1] - 1
            sequences.append(seq)
            labels.append(label)

    return sequences, labels


def train_epoch(model, dataloader, criterion, optimizer, device):
    model.train()
    total_loss = 0.0
    correct = 0
    total = 0
    for sequences, labels in dataloader:
        sequences = sequences.to(device)
        labels = labels.to(device)
        optimizer.zero_grad()
        logits = model(sequences)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * sequences.size(0)
        preds = logits.argmax(dim=-1)
        correct += (preds == labels).sum().item()
        total += sequences.size(0)
    avg_loss = total_loss / total
    accuracy = correct / total
    return avg_loss, accuracy


def eval_epoch(model, dataloader, criterion, device):
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0
    with torch.no_grad():
        for sequences, labels in dataloader:
            sequences = sequences.to(device)
            labels = labels.to(device)
            logits = model(sequences)
            loss = criterion(logits, labels)
            total_loss += loss.item() * sequences.size(0)
            preds = logits.argmax(dim=-1)
            correct += (preds == labels).sum().item()
            total += sequences.size(0)
    avg_loss = total_loss / total
    accuracy = correct / total
    return avg_loss, accuracy


def main():
    os.makedirs(MODEL_DIR, exist_ok=True)

    rows = load_csv(CSV_PATH)
    sequences, labels = build_sequences(rows)

    if len(sequences) == 0:
        print("No training sequences found. Run generate_sample_data.py first.")
        return

    print(f"Total sequences: {len(sequences)}")

    indices = list(range(len(sequences)))
    random.shuffle(indices)
    split = int(len(indices) * TRAIN_RATIO)
    train_idx = indices[:split]
    val_idx = indices[split:]

    train_seqs = [sequences[i] for i in train_idx]
    train_labels = [labels[i] for i in train_idx]
    val_seqs = [sequences[i] for i in val_idx]
    val_labels = [labels[i] for i in val_idx]

    train_dataset = SkillSequenceDataset(train_seqs, train_labels)
    val_dataset = SkillSequenceDataset(val_seqs, val_labels)

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = SkillPredictor().to(device)
    criterion = torch.nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)

    best_val_loss = float("inf")
    for epoch in range(1, EPOCHS + 1):
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc = eval_epoch(model, val_loader, criterion, device)
        print(f"Epoch {epoch:3d}/{EPOCHS} | "
              f"Train Loss: {train_loss:.4f} Acc: {train_acc:.4f} | "
              f"Val Loss: {val_loss:.4f} Acc: {val_acc:.4f}")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save({
                "model_state_dict": model.state_dict(),
                "epoch": epoch,
                "val_loss": val_loss,
                "val_acc": val_acc,
            }, PT_PATH)
            print(f"  -> Best model saved (val_loss={val_loss:.4f})")

    print(f"Training complete. Best val loss: {best_val_loss:.4f}")
    print(f"Model saved to {PT_PATH}")


if __name__ == "__main__":
    main()
