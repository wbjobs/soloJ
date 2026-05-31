# Quantum Circuit Simulator API

RESTful API for quantum circuit simulation with GPU acceleration using CuPy.

## Features

- **GPU-Accelerated Simulation**: Uses CuPy for fast quantum state vector operations
- **Support for up to 25 qubits**: Simulate large quantum circuits
- **Quantum Gates**: Hadamard, Pauli-X/Y/Z, CNOT, Toffoli
- **Measurement Operations**: Get probability distributions and measurement counts
- **Redis Caching**: Circuit results cached with 300-second TTL
- **Async Task Support**: Celery for long-running circuit executions
- **Health Check & Monitoring**: Performance metrics endpoint
- **Circuit Visualization**: JSON representation of circuits

## Tech Stack

- **FastAPI**: Modern, fast web framework
- **CuPy**: GPU-accelerated array computing
- **Redis**: Caching and Celery broker
- **Celery**: Distributed task queue
- **Pydantic**: Data validation

## Installation

### Prerequisites

- Python 3.9+
- NVIDIA GPU with CUDA (for GPU acceleration)
- Redis server

### Install Dependencies

```bash
pip install -r requirements.txt
```

## Running the Application

### Quick Start (Windows)

```bash
start.bat
```

### Quick Start (Linux/Mac)

```bash
chmod +x start.sh
./start.sh
```

### Manual Start

1. **Start Redis server**:
   ```bash
   redis-server
   ```

2. **Start Celery worker**:
   ```bash
   celery -A app.tasks.celery_worker.celery_app worker --loglevel=info --pool=solo
   ```

3. **Start FastAPI server**:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Quantum Circuit Operations

- `POST /api/v1/circuit/execute` - Execute a circuit synchronously
- `POST /api/v1/circuit/visualize` - Get circuit visualization JSON
- `POST /api/v1/circuit/async` - Submit async circuit execution
- `GET /api/v1/circuit/async/{task_id}` - Get async task status

### Monitoring

- `GET /api/v1/health` - Health check endpoint
- `GET /api/v1/metrics` - Performance metrics

## Example Usage

### Synchronous Execution

```python
import requests

response = requests.post(
    "http://localhost:8000/api/v1/circuit/execute",
    json={
        "num_qubits": 3,
        "gates": [
            {"gate_type": "H", "qubits": [0]},
            {"gate_type": "CNOT", "qubits": [0, 1]},
            {"gate_type": "Toffoli", "qubits": [0, 1, 2]}
        ],
        "shots": 1024
    }
)
result = response.json()
print(result["probabilities"])
```

### Async Execution

```python
import requests

# Submit task
response = requests.post(
    "http://localhost:8000/api/v1/circuit/async",
    json={
        "num_qubits": 20,
        "gates": [{"gate_type": "H", "qubits": [i]} for i in range(20)],
        "shots": 1024
    }
)
task_id = response.json()["task_id"]

# Check status
status = requests.get(f"http://localhost:8000/api/v1/circuit/async/{task_id}")
print(status.json())
```

## Circuit Visualization

The visualization endpoint returns JSON data:

```json
{
  "num_qubits": 3,
  "operations": [
    {"gate_type": "H", "qubits": [0], "params": null},
    {"gate_type": "CNOT", "qubits": [0, 1], "params": null}
  ],
  "gate_count": 2,
  "gpu_accelerated": true
}
```

## Project Structure

```
quantum-simulator/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app entry
│   ├── config.py            # Configuration
│   ├── quantum/
│   │   ├── __init__.py
│   │   ├── simulator.py     # QuantumCircuit class
│   │   └── gates.py         # Gate definitions & operations
│   ├── optimization/
│   │   ├── __init__.py
│   │   └── circuit_optimizer.py  # Circuit optimization
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes.py        # API routes
│   │   └── schemas.py       # Pydantic models
│   ├── cache/
│   │   ├── __init__.py
│   │   └── redis_cache.py   # Redis caching
│   ├── tasks/
│   │   ├── __init__.py
│   │   └── celery_worker.py # Celery tasks
│   └── monitoring/
│       ├── __init__.py
│       └── health.py        # Health & metrics
├── requirements.txt
├── start.bat
└── start.sh
```
