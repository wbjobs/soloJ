import numpy as np
from datetime import datetime, timedelta
import json
import httpx
import asyncio
from typing import List

API_BASE = "http://localhost:8000/api/v1"
SAMPLING_RATE = 50000
NUM_CHANNELS = 24
DURATION_SECONDS = 0.1


def generate_normal_signal(n_samples: int, fs: int = SAMPLING_RATE) -> np.ndarray:
    t = np.arange(n_samples) / fs
    signal = 0.1 * np.sin(2 * np.pi * 50 * t)
    signal += 0.05 * np.sin(2 * np.pi * 120 * t)
    signal += 0.02 * np.random.randn(n_samples)
    return signal


def generate_bearing_fault_signal(
    n_samples: int, fault_freq: float = 89.0, fs: int = SAMPLING_RATE
) -> np.ndarray:
    t = np.arange(n_samples) / fs
    signal = 0.1 * np.sin(2 * np.pi * 50 * t)
    signal += 0.05 * np.sin(2 * np.pi * 120 * t)
    for harmonic in range(1, 6):
        amplitude = 0.3 / harmonic
        signal += amplitude * np.sin(2 * np.pi * fault_freq * harmonic * t)
    impulse_period = int(fs / fault_freq)
    impulse_train = np.zeros(n_samples)
    for i in range(0, n_samples, impulse_period):
        decay = np.exp(-np.arange(min(200, n_samples - i)) / 30.0)
        impulse_train[i : i + len(decay)] += decay * 0.5
    signal += impulse_train
    signal += 0.02 * np.random.randn(n_samples)
    return signal


def generate_gear_wear_signal(n_samples: int, fs: int = SAMPLING_RATE) -> np.ndarray:
    t = np.arange(n_samples) / fs
    signal = 0.1 * np.sin(2 * np.pi * 50 * t)
    gear_mesh_freq = 315.0
    signal += 0.2 * np.sin(2 * np.pi * gear_mesh_freq * t)
    signal += 0.1 * np.sin(2 * np.pi * gear_mesh_freq * 2 * t)
    modulation = 1.0 + 0.3 * np.sin(2 * np.pi * 8.3 * t)
    signal *= modulation
    signal += 0.03 * np.random.randn(n_samples)
    return signal


def generate_misalignment_signal(n_samples: int, fs: int = SAMPLING_RATE) -> np.ndarray:
    t = np.arange(n_samples) / fs
    signal = 0.15 * np.sin(2 * np.pi * 50 * t)
    signal += 0.12 * np.sin(2 * np.pi * 100 * t)
    signal += 0.08 * np.sin(2 * np.pi * 150 * t)
    signal += 0.02 * np.random.randn(n_samples)
    return signal


async def upload_batch(
    sensor_id: str,
    signal_generator,
    num_batches: int = 5,
    channel_pattern: str = "mixed",
):
    n_samples = int(DURATION_SECONDS * SAMPLING_RATE)
    async with httpx.AsyncClient(timeout=30.0) as client:
        for batch_idx in range(num_batches):
            data = []
            for ch_idx in range(NUM_CHANNELS):
                if channel_pattern == "fault":
                    ch_signal = signal_generator(n_samples)
                elif channel_pattern == "mixed":
                    if ch_idx < 8:
                        ch_signal = signal_generator(n_samples)
                    elif ch_idx < 16:
                        ch_signal = generate_normal_signal(n_samples)
                    else:
                        ch_signal = generate_normal_signal(n_samples) * 0.5
                else:
                    ch_signal = generate_normal_signal(n_samples)
                data.append(ch_signal.tolist())

            payload = {
                "sensor_id": sensor_id,
                "data": data,
                "timestamp": datetime.utcnow().isoformat(),
                "sampling_rate": SAMPLING_RATE,
            }

            try:
                resp = await client.post(f"{API_BASE}/upload", json=payload)
                print(f"Batch {batch_idx + 1}/{num_batches}: {resp.status_code} - {resp.json().get('message', '')}")
            except Exception as e:
                print(f"Batch {batch_idx + 1} error: {e}")

            await asyncio.sleep(0.1)


async def main():
    print("=== Uploading normal baseline data ===")
    await upload_batch("sensor-001", generate_normal_signal, num_batches=10, channel_pattern="normal")

    print("\n=== Uploading bearing fault data ===")
    await upload_batch("sensor-001", generate_bearing_fault_signal, num_batches=5, channel_pattern="fault")

    print("\n=== Uploading gear wear data ===")
    await upload_batch("sensor-001", generate_gear_wear_signal, num_batches=3, channel_pattern="mixed")

    print("\n=== Uploading misalignment data ===")
    await upload_batch("sensor-001", generate_misalignment_signal, num_batches=3, channel_pattern="mixed")

    print("\n=== Done! ===")


if __name__ == "__main__":
    asyncio.run(main())
