"""Example client for testing the Quantum Simulator API."""

import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1"


def test_health_check():
    """Test the health check endpoint."""
    print("Testing Health Check...")
    response = requests.get(f"{BASE_URL}/health")
    print(json.dumps(response.json(), indent=2))
    print()


def test_bell_state():
    """Test creating a Bell state."""
    print("Testing Bell State Circuit...")
    payload = {
        "num_qubits": 2,
        "gates": [
            {"gate_type": "H", "qubits": [0]},
            {"gate_type": "CNOT", "qubits": [0, 1]}
        ],
        "shots": 1024
    }
    
    response = requests.post(f"{BASE_URL}/circuit/execute", json=payload)
    result = response.json()
    print(f"Success: {result['success']}")
    print(f"Probabilities: {json.dumps(result['probabilities'], indent=2)}")
    print(f"GPU Accelerated: {result['gpu_accelerated']}")
    print(f"From Cache: {result['from_cache']}")
    print(f"Execution Time: {result['execution_time_ms']:.2f} ms")
    print()


def test_visualization():
    """Test circuit visualization."""
    print("Testing Circuit Visualization...")
    payload = {
        "num_qubits": 3,
        "gates": [
            {"gate_type": "H", "qubits": [0]},
            {"gate_type": "X", "qubits": [1]},
            {"gate_type": "CNOT", "qubits": [0, 1]},
            {"gate_type": "Toffoli", "qubits": [0, 1, 2]}
        ]
    }
    
    response = requests.post(f"{BASE_URL}/circuit/visualize", json=payload)
    print(json.dumps(response.json(), indent=2))
    print()


def test_async_execution():
    """Test async circuit execution."""
    print("Testing Async Execution...")
    payload = {
        "num_qubits": 5,
        "gates": [
            {"gate_type": "H", "qubits": [0]},
            {"gate_type": "H", "qubits": [1]},
            {"gate_type": "H", "qubits": [2]},
            {"gate_type": "CNOT", "qubits": [0, 3]},
            {"gate_type": "Toffoli", "qubits": [1, 2, 4]}
        ],
        "shots": 1024
    }
    
    response = requests.post(f"{BASE_URL}/circuit/async", json=payload)
    task_id = response.json()["task_id"]
    print(f"Task ID: {task_id}")
    
    for _ in range(10):
        status = requests.get(f"{BASE_URL}/circuit/async/{task_id}")
        result = status.json()
        print(f"Status: {result['status']}")
        if result["status"] == "SUCCESS":
            print(f"Probabilities: {json.dumps(result['result']['probabilities'], indent=2)}")
            break
        elif result["status"] == "FAILURE":
            print(f"Error: {result.get('error')}")
            break
        time.sleep(1)
    print()


def test_metrics():
    """Test metrics endpoint."""
    print("Testing Metrics...")
    response = requests.get(f"{BASE_URL}/metrics")
    print(json.dumps(response.json(), indent=2))
    print()


if __name__ == "__main__":
    print("=" * 50)
    print("Quantum Simulator API Test Client")
    print("=" * 50)
    print()
    
    try:
        test_health_check()
        test_bell_state()
        test_visualization()
        test_async_execution()
        test_metrics()
        
        print("All tests completed!")
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to the API server.")
        print("Please make sure the server is running at http://localhost:8000")
    except Exception as e:
        print(f"Error: {e}")
