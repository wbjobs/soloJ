"""Celery configuration and async tasks for quantum circuit execution."""

import time
import logging
from celery import Celery
from typing import Dict, Any

from ..quantum.simulator import QuantumCircuit
from ..cache.redis_cache import get_cache
from ..optimization.circuit_optimizer import optimize_circuit

logger = logging.getLogger(__name__)

celery_app = Celery(
    "quantum_tasks",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0"
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    worker_prefetch_multiplier=1,
)


@celery_app.task(bind=True, name="execute_circuit_task")
def execute_circuit_task(
    self,
    num_qubits: int,
    gates_data: list,
    shots: int = 1024
) -> Dict[str, Any]:
    """Execute a quantum circuit as an async task.
    
    Args:
        num_qubits: Number of qubits
        gates_data: List of gate operations
        shots: Number of measurement shots
        
    Returns:
        Execution results
    """
    start_time = time.time()
    
    try:
        circuit = QuantumCircuit(num_qubits)
        
        for gate_info in gates_data:
            gate_type = gate_info["gate_type"]
            qubits = gate_info["qubits"]
            
            if gate_type in ["H", "X", "Y", "Z"]:
                getattr(circuit, gate_type.lower())(qubits[0])
            elif gate_type == "CNOT":
                circuit.cnot(qubits[0], qubits[1])
            elif gate_type == "Toffoli":
                circuit.toffoli(qubits[0], qubits[1], qubits[2])
        
        circuit_hash = circuit.get_circuit_hash()
        cache = get_cache()
        cached_result = cache.get(circuit_hash)
        
        if cached_result:
            execution_time = (time.time() - start_time) * 1000
            return {
                "success": True,
                "circuit_id": circuit_hash,
                "probabilities": cached_result["probabilities"],
                "measurements": cached_result.get("measurements"),
                "state_vector": cached_result.get("state_vector"),
                "execution_time_ms": execution_time,
                "gpu_accelerated": circuit._gpu_available,
                "from_cache": True,
            }
        
        state_vector = circuit.execute()
        probabilities = circuit.get_probabilities()
        measurements = circuit.measure(shots)
        
        state_vector_list = [
            {"real": float(x.real), "imag": float(x.imag)} 
            for x in state_vector
        ]
        
        cache_result = {
            "probabilities": probabilities,
            "measurements": measurements,
            "state_vector": state_vector_list,
        }
        cache.set(circuit_hash, cache_result)
        
        execution_time = (time.time() - start_time) * 1000
        
        return {
            "success": True,
            "circuit_id": circuit_hash,
            "probabilities": probabilities,
            "measurements": measurements,
            "state_vector": state_vector_list,
            "execution_time_ms": execution_time,
            "gpu_accelerated": circuit._gpu_available,
            "from_cache": False,
        }
    
    except Exception as e:
        logger.error(f"Task execution failed: {str(e)}")
        raise self.retry(exc=e, countdown=5, max_retries=3)


@celery_app.task(bind=True, name="optimize_circuit_task")
def optimize_circuit_task(
    self,
    num_qubits: int,
    gates_data: list,
    measure_execution_time: bool = False,
    execute_after_optimize: bool = False,
    shots: int = 1024
) -> Dict[str, Any]:
    """Optimize a quantum circuit as an async task.
    
    Args:
        num_qubits: Number of qubits
        gates_data: List of gate operations
        measure_execution_time: Whether to measure execution time
        execute_after_optimize: Whether to execute the optimized circuit
        shots: Number of measurement shots if executing
        
    Returns:
        Optimization results
    """
    start_time = time.time()
    
    try:
        optimization_result = optimize_circuit(
            num_qubits,
            gates_data,
            measure_execution_time
        )
        
        result = {
            "success": True,
            "optimization": optimization_result,
            "optimization_time_ms": (time.time() - start_time) * 1000,
        }
        
        if execute_after_optimize:
            optimized_gates = optimization_result["optimized_gates"]
            
            circuit = QuantumCircuit(num_qubits)
            for gate_info in optimized_gates:
                gate_type = gate_info["gate_type"]
                qubits = gate_info["qubits"]
                
                if gate_type in ["H", "X", "Y", "Z"]:
                    getattr(circuit, gate_type.lower())(qubits[0])
                elif gate_type == "CNOT":
                    circuit.cnot(qubits[0], qubits[1])
                elif gate_type == "Toffoli":
                    circuit.toffoli(qubits[0], qubits[1], qubits[2])
            
            circuit_hash = circuit.get_circuit_hash()
            cache = get_cache()
            cached_result = cache.get(circuit_hash)
            
            if cached_result:
                execution_result = {
                    "circuit_id": circuit_hash,
                    "probabilities": cached_result["probabilities"],
                    "measurements": cached_result.get("measurements"),
                    "state_vector": cached_result.get("state_vector"),
                    "from_cache": True,
                }
            else:
                circuit.execute()
                probabilities = circuit.get_probabilities()
                measurements = circuit.measure(shots)
                
                state_vector_list = [
                    {"real": float(x.real), "imag": float(x.imag)} 
                    for x in circuit.get_state_vector()
                ]
                
                cache_result = {
                    "probabilities": probabilities,
                    "measurements": measurements,
                    "state_vector": state_vector_list,
                }
                cache.set(circuit_hash, cache_result)
                
                execution_result = {
                    "circuit_id": circuit_hash,
                    "probabilities": probabilities,
                    "measurements": measurements,
                    "state_vector": state_vector_list,
                    "from_cache": False,
                }
            
            result["execution_result"] = execution_result
        
        return result
    
    except Exception as e:
        logger.error(f"Optimization task failed: {str(e)}")
        raise self.retry(exc=e, countdown=5, max_retries=3)


def get_task_status(task_id: str) -> Dict[str, Any]:
    """Get the status of an async task.
    
    Args:
        task_id: Celery task ID
        
    Returns:
        Task status information
    """
    task = execute_circuit_task.AsyncResult(task_id)
    
    result = {
        "task_id": task_id,
        "status": task.status,
    }
    
    if task.state == "SUCCESS":
        result["result"] = task.result
    elif task.state == "FAILURE":
        result["error"] = str(task.result)
    
    return result


def is_celery_available() -> bool:
    """Check if Celery broker is available.
    
    Returns:
        True if Celery can connect
    """
    try:
        celery_app.control.ping(timeout=1)
        return True
    except Exception:
        return False
