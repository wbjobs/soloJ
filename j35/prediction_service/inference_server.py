import os
import time
from collections import deque
import numpy as np
import onnxruntime as ort
from flask import Flask, request, jsonify
from model import encode_features, SEQUENCE_LENGTH, NUM_SKILLS

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
ONNX_PATH = os.path.join(MODEL_DIR, "skill_predictor.onnx")

app = Flask(__name__)

session = None
player_cache = {}


def get_session():
    global session
    if session is None:
        session = ort.InferenceSession(ONNX_PATH)
    return session


def predict_top3(input_array):
    sess = get_session()
    start = time.perf_counter()
    logits = sess.run(None, {"input": input_array})[0]
    elapsed = (time.perf_counter() - start) * 1000
    probs = np.exp(logits[0]) / np.sum(np.exp(logits[0]))
    top3_idx = np.argsort(probs)[::-1][:3]
    top3_probs = probs[top3_idx]
    result = []
    for idx, prob in zip(top3_idx, top3_probs):
        result.append({
            "skill_id": int(idx) + 1,
            "probability": round(float(prob), 4)
        })
    return result, round(elapsed, 2)


@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    player_id = str(data.get("player_id", "default"))

    if player_id in player_cache and len(player_cache[player_id]) >= SEQUENCE_LENGTH:
        ops = list(player_cache[player_id])[-SEQUENCE_LENGTH:]
        features = [encode_features(
            op["skill_id"], op["pos_x"], op["pos_y"],
            op["target_dist"], op["cooldown_ratio"], op["hp_pct"]
        ) for op in ops]
        input_array = np.array([features], dtype=np.float32)
        top3, latency = predict_top3(input_array)
        return jsonify({
            "player_id": player_id,
            "predictions": top3,
            "latency_ms": latency
        })

    return jsonify({
        "player_id": player_id,
        "predictions": [],
        "message": f"Insufficient history ({len(player_cache.get(player_id, []))}/{SEQUENCE_LENGTH})"
    })


@app.route("/update", methods=["POST"])
def update():
    data = request.get_json()
    player_id = str(data.get("player_id", "default"))
    op = {
        "skill_id": int(data["skill_id"]),
        "pos_x": float(data["pos_x"]),
        "pos_y": float(data["pos_y"]),
        "target_dist": float(data["target_dist"]),
        "cooldown_ratio": float(data["cooldown_ratio"]),
        "hp_pct": float(data["hp_pct"]),
    }

    if player_id not in player_cache:
        player_cache[player_id] = deque(maxlen=SEQUENCE_LENGTH + 10)
    player_cache[player_id].append(op)

    if len(player_cache[player_id]) >= SEQUENCE_LENGTH:
        ops = list(player_cache[player_id])[-SEQUENCE_LENGTH:]
        features = [encode_features(
            o["skill_id"], o["pos_x"], o["pos_y"],
            o["target_dist"], o["cooldown_ratio"], o["hp_pct"]
        ) for o in ops]
        input_array = np.array([features], dtype=np.float32)
        top3, latency = predict_top3(input_array)
        return jsonify({
            "player_id": player_id,
            "predictions": top3,
            "cache_size": len(player_cache[player_id]),
            "latency_ms": latency
        })

    return jsonify({
        "player_id": player_id,
        "predictions": [],
        "cache_size": len(player_cache[player_id]),
        "message": f"Collecting history ({len(player_cache[player_id])}/{SEQUENCE_LENGTH})"
    })


if __name__ == "__main__":
    print(f"Loading ONNX model from {ONNX_PATH}")
    get_session()
    print("Model loaded. Starting inference server on port 5001...")
    app.run(host="0.0.0.0", port=5001)
