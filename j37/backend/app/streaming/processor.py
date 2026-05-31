import faust
import numpy as np
import json
import asyncio
import traceback
from typing import Dict, List
from datetime import datetime

from app.config import (
    KAFKA_BOOTSTRAP_SERVERS,
    KAFKA_TOPIC_VIBRATION,
    SAMPLING_RATE,
    NUM_CHANNELS,
    WINDOW_SIZE,
    WINDOW_HOP,
)
from app.features.entropy import compute_features_for_channel
from app.models.detector import EnsembleAnomalyDetector, FaultClassifier


app = faust.App(
    "vibration-stream-processor",
    broker=f"kafka://{KAFKA_BOOTSTRAP_SERVERS}",
    value_serializer="json",
    store="memory://",
    consumer_auto_offset_reset="earliest",
)

vibration_topic = app.topic(KAFKA_TOPIC_VIBRATION, value_type=bytes)

features_topic = app.topic("vibration-features", value_serializer="json")

diagnostics_topic = app.topic("vibration-diagnostics", value_serializer="json")

dead_letter_topic = app.topic("vibration-dead-letter", value_serializer="json")


class SlidingWindowBuffer:
    def __init__(self, window_size: int, hop_size: int, num_channels: int):
        self.window_size = window_size
        self.hop_size = hop_size
        self.num_channels = num_channels
        self.buffer = np.zeros((0, num_channels), dtype=np.float32)
        self.samples_since_last_compute = 0
        self._pending_window = None

    def append(self, data: np.ndarray):
        if data.ndim == 1:
            data = data.reshape(-1, 1)
        self.buffer = np.vstack([self.buffer, data]) if self.buffer.shape[0] > 0 else data
        self.samples_since_last_compute += data.shape[0]

    def should_compute(self) -> bool:
        return self.samples_since_last_compute >= self.hop_size and self.buffer.shape[0] >= self.window_size

    def extract_window(self) -> np.ndarray:
        if self.buffer.shape[0] >= self.window_size:
            self._pending_window = self.buffer[-self.window_size:].copy()
        else:
            self._pending_window = self.buffer.copy()
        return self._pending_window

    def commit_window(self):
        self._pending_window = None
        self._trim()

    def rollback_window(self):
        self._pending_window = None

    def _trim(self):
        max_keep = self.window_size * 2
        if self.buffer.shape[0] > max_keep:
            self.buffer = self.buffer[-max_keep:]
        self.samples_since_last_compute = 0


buffers: Dict[str, SlidingWindowBuffer] = {}

detector = EnsembleAnomalyDetector()
classifier = FaultClassifier()


def get_or_create_buffer(sensor_id: str) -> SlidingWindowBuffer:
    if sensor_id not in buffers:
        buffers[sensor_id] = SlidingWindowBuffer(
            window_size=WINDOW_SIZE, hop_size=WINDOW_HOP, num_channels=NUM_CHANNELS
        )
    return buffers[sensor_id]


async def process_window(sensor_id: str, window_data: np.ndarray):
    all_features = []
    for ch_idx in range(window_data.shape[1]):
        ch_signal = window_data[:, ch_idx].astype(np.float64)
        feats = compute_features_for_channel(ch_signal)
        feats["channel_index"] = ch_idx
        all_features.append(feats)

    avg_features = {}
    for key in all_features[0]:
        if key == "channel_index":
            continue
        vals = [f[key] for f in all_features if key in f]
        if vals:
            avg_features[key] = float(np.mean(vals))

    feature_vector = np.array([avg_features.get(k, 0.0) for k in avg_features]).reshape(1, -1)

    fault_probs = classifier.classify(avg_features)

    anomaly_label = "normal"
    if detector.is_fitted:
        anomaly = detector.predict_anomaly(feature_vector)[0]
        anomaly_label = "anomaly" if anomaly == 1 else "normal"

    result = {
        "sensor_id": sensor_id,
        "timestamp": datetime.utcnow().isoformat(),
        "features": avg_features,
        "channel_features": all_features,
        "fault_probabilities": fault_probs,
        "anomaly_label": anomaly_label,
    }

    await features_topic.send(value=avg_features)
    await diagnostics_topic.send(value=result)
    return result


async def _handle_message_with_retry(payload_bytes, max_retries: int = 3):
    payload = json.loads(payload_bytes) if isinstance(payload_bytes, (bytes, str)) else payload_bytes
    sensor_id = payload.get("sensor_id", "default")
    data = np.array(payload["data"], dtype=np.float32)

    buf = get_or_create_buffer(sensor_id)
    buf.append(data)

    if buf.should_compute():
        window = buf.extract_window()
        last_error = None
        for attempt in range(max_retries):
            try:
                await process_window(sensor_id, window)
                buf.commit_window()
                return True
            except Exception as e:
                last_error = e
                if attempt < max_retries - 1:
                    await asyncio.sleep(0.5 * (attempt + 1))
        buf.rollback_window()
        await dead_letter_topic.send(value={
            "original_payload": payload,
            "error": str(last_error),
            "timestamp": datetime.utcnow().isoformat(),
            "stage": "window_processing",
        })
        return False

    return True


@app.agent(vibration_topic, ack_on_error=False)
async def process_vibration(stream):
    async for event in stream:
        try:
            message_value = event.value if hasattr(event, 'value') else event
            success = await _handle_message_with_retry(message_value)
            if success:
                await event.ack()
            else:
                await event.ack()
        except json.JSONDecodeError as e:
            await dead_letter_topic.send(value={
                "error": f"JSON decode error: {str(e)}",
                "timestamp": datetime.utcnow().isoformat(),
                "stage": "deserialization",
            })
            await event.ack()
        except KeyError as e:
            await dead_letter_topic.send(value={
                "error": f"Missing key: {str(e)}",
                "timestamp": datetime.utcnow().isoformat(),
                "stage": "validation",
            })
            await event.ack()
        except Exception as e:
            await dead_letter_topic.send(value={
                "error": f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}",
                "timestamp": datetime.utcnow().isoformat(),
                "stage": "unknown",
            })
            await event.ack()


if __name__ == "__main__":
    app.main()
