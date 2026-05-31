import os
import time
import json
import random
import argparse
from datetime import datetime, timezone
from dotenv import load_dotenv
import requests

load_dotenv()

WORKSHOPS = ["workshop-a", "workshop-b", "workshop-c"]
SENSORS_PER_WORKSHOP = 3
BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
INTERVAL = float(os.getenv("SIMULATOR_INTERVAL", "1.0"))

SENSOR_CONFIG = {
    "temperature": {"base": 25.0, "variance": 5.0, "anomaly_chance": 0.05, "anomaly_multiplier": 2.5},
    "vibration": {"base": 50.0, "variance": 20.0, "anomaly_chance": 0.03, "anomaly_multiplier": 3.0},
    "voltage": {"base": 220.0, "variance": 10.0, "anomaly_chance": 0.02, "anomaly_multiplier": 1.5},
}


def generate_sensor_data(workshop: str, sensor_id: str) -> dict:
    now = datetime.now(timezone.utc)
    
    temperature_config = SENSOR_CONFIG["temperature"]
    vibration_config = SENSOR_CONFIG["vibration"]
    voltage_config = SENSOR_CONFIG["voltage"]
    
    temperature = temperature_config["base"] + random.uniform(-temperature_config["variance"], temperature_config["variance"])
    if random.random() < temperature_config["anomaly_chance"]:
        temperature *= temperature_config["anomaly_multiplier"]
    
    vibration = vibration_config["base"] + random.uniform(-vibration_config["variance"], vibration_config["variance"])
    if random.random() < vibration_config["anomaly_chance"]:
        vibration *= vibration_config["anomaly_multiplier"]
    
    voltage = voltage_config["base"] + random.uniform(-voltage_config["variance"], voltage_config["variance"])
    if random.random() < voltage_config["anomaly_chance"]:
        voltage *= voltage_config["anomaly_multiplier"]
    
    return {
        "workshop": workshop,
        "sensorId": sensor_id,
        "temperature": round(temperature, 2),
        "vibration": round(vibration, 2),
        "voltage": round(voltage, 2),
        "timestamp": now.isoformat()
    }


def send_data(data: dict, batch: bool = False) -> bool:
    try:
        if batch:
            url = f"{BASE_URL}/api/sensor/data/batch"
            payload = {"data": data}
        else:
            url = f"{BASE_URL}/api/sensor/data"
            payload = data
        
        response = requests.post(url, json=payload, timeout=5)
        if response.status_code == 200:
            result = response.json()
            if result.get("code") == 0:
                return True
        print(f"Send failed: {response.status_code} - {response.text}")
        return False
    except Exception as e:
        print(f"Connection error: {e}")
        return False


def run_single_sensor_mode(workshop: str, sensor_id: str):
    print(f"Starting simulator for {workshop}/{sensor_id}, interval={INTERVAL}s")
    while True:
        data = generate_sensor_data(workshop, sensor_id)
        success = send_data(data)
        status = "✓" if success else "✗"
        print(f"{status} [{data['timestamp']}] {workshop}/{sensor_id} T={data['temperature']}°C V={data['vibration']}Hz U={data['voltage']}V")
        time.sleep(INTERVAL)


def run_batch_mode():
    print(f"Starting batch simulator, {len(WORKSHOPS)} workshops, {SENSORS_PER_WORKSHOP} sensors each, interval={INTERVAL}s")
    while True:
        batch_data = []
        for workshop in WORKSHOPS:
            for i in range(SENSORS_PER_WORKSHOP):
                sensor_id = f"sensor-{i+1:03d}"
                data = generate_sensor_data(workshop, sensor_id)
                batch_data.append(data)
        
        success = send_data(batch_data, batch=True)
        status = "✓" if success else "✗"
        print(f"{status} [{datetime.now(timezone.utc).isoformat()}] Sent {len(batch_data)} readings")
        time.sleep(INTERVAL)


def wait_for_backend():
    print(f"Waiting for backend at {BASE_URL}...")
    while True:
        try:
            response = requests.get(f"{BASE_URL}/api/health", timeout=2)
            if response.status_code == 200:
                print("Backend is ready!")
                return
        except Exception:
            pass
        print("Backend not ready, retrying...")
        time.sleep(2)


def main():
    parser = argparse.ArgumentParser(description="IoT Sensor Data Simulator")
    parser.add_argument("--workshop", type=str, help="Workshop name for single sensor mode")
    parser.add_argument("--sensor", type=str, help="Sensor ID for single sensor mode")
    parser.add_argument("--interval", type=float, default=INTERVAL, help="Send interval in seconds")
    parser.add_argument("--batch", action="store_true", help="Run in batch mode (all sensors)")
    parser.add_argument("--no-wait", action="store_true", help="Don't wait for backend")
    args = parser.parse_args()

    global INTERVAL
    INTERVAL = args.interval

    if not args.no_wait:
        wait_for_backend()

    if args.batch:
        run_batch_mode()
    elif args.workshop and args.sensor:
        run_single_sensor_mode(args.workshop, args.sensor)
    else:
        run_batch_mode()


if __name__ == "__main__":
    main()
