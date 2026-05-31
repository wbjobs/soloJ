"""API routes for quantum simulator."""

import time
import logging
from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from .schemas import (
    CircuitExecuteRequest,
    CircuitExecuteResponse,
    CircuitVisualizationResponse,
    CircuitOptimizeRequest,
    CircuitOptimizeResponse,
    AsyncTaskSubmitResponse,
    TaskStatusResponse,
    HealthResponse,
    MetricsResponse,
)
from ..quantum.simulator import QuantumCircuit
from ..cache.redis_cache import get_cache
from ..tasks.celery_worker import execute_circuit_task, optimize_circuit_task, get_task_status
from ..optimization.circuit_optimizer import optimize_circuit
from ..monitoring.health import (
    get_health_status,
    get_metrics_collector,
    get_gpu_metrics,
    get_active_tasks_count,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/circuit/execute", response_model=CircuitExecuteResponse)
async def execute_circuit(request: CircuitExecuteRequest) -> Dict[str, Any]:
    """Execute a quantum circuit synchronously.
    
    Args:
        request: Circuit execution request
        
    Returns:
        Execution results with probabilities and measurements
    """
    start_time = time.time()
    
    try:
        circuit = QuantumCircuit(request.num_qubits)
        
        for gate in request.gates:
            qubits = gate.qubits
            if gate.gate_type in ["H", "X", "Y", "Z"]:
                if len(qubits) != 1:
                    raise HTTPException(
                        status_code=400,
                        detail=f"{gate.gate_type} gate requires exactly 1 qubit"
                    )
                getattr(circuit, gate.gate_type.lower())(qubits[0])
            elif gate.gate_type == "CNOT":
                if len(qubits) != 2:
                    raise HTTPException(
                        status_code=400,
                        detail="CNOT gate requires exactly 2 qubits"
                    )
                circuit.cnot(qubits[0], qubits[1])
            elif gate.gate_type == "Toffoli":
                if len(qubits) != 3:
                    raise HTTPException(
                        status_code=400,
                        detail="Toffoli gate requires exactly 3 qubits"
                    )
                circuit.toffoli(qubits[0], qubits[1], qubits[2])
        
        circuit_hash = circuit.get_circuit_hash()
        cache = get_cache()
        cached_result = cache.get(circuit_hash)
        
        if cached_result:
            execution_time = (time.time() - start_time) * 1000
            metrics = get_metrics_collector()
            metrics.record_execution(execution_time, from_cache=True)
            
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
        measurements = circuit.measure(request.shots)
        
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
        
        metrics = get_metrics_collector()
        metrics.record_execution(execution_time, from_cache=False)
        
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
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error executing circuit: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/circuit/visualize", response_model=CircuitVisualizationResponse)
async def visualize_circuit(request: CircuitExecuteRequest) -> Dict[str, Any]:
    """Get circuit visualization data.
    
    Args:
        request: Circuit definition
        
    Returns:
        Visualization JSON data
    """
    try:
        circuit = QuantumCircuit(request.num_qubits)
        
        for gate in request.gates:
            qubits = gate.qubits
            if gate.gate_type in ["H", "X", "Y", "Z"]:
                getattr(circuit, gate.gate_type.lower())(qubits[0])
            elif gate.gate_type == "CNOT":
                circuit.cnot(qubits[0], qubits[1])
            elif gate.gate_type == "Toffoli":
                circuit.toffoli(qubits[0], qubits[1], qubits[2])
        
        return circuit.get_circuit_json()
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error visualizing circuit: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/circuit/async", response_model=AsyncTaskSubmitResponse)
async def submit_async_circuit(request: CircuitExecuteRequest) -> Dict[str, Any]:
    """Submit a quantum circuit for async execution.
    
    Args:
        request: Circuit execution request
        
    Returns:
        Task ID for status polling
    """
    try:
        gates_data = [
            {"gate_type": gate.gate_type, "qubits": gate.qubits}
            for gate in request.gates
        ]
        
        task = execute_circuit_task.delay(
            num_qubits=request.num_qubits,
            gates_data=gates_data,
            shots=request.shots,
        )
        
        return {
            "success": True,
            "task_id": task.id,
            "message": "Task submitted successfully. Use GET /circuit/async/{task_id} to check status.",
        }
    
    except Exception as e:
        logger.error(f"Error submitting async task: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to submit task")


@router.get("/circuit/async/{task_id}", response_model=TaskStatusResponse)
async def get_async_task_status(task_id: str) -> Dict[str, Any]:
    """Get status of an async circuit execution task.
    
    Args:
        task_id: Celery task ID
        
    Returns:
        Task status and result if complete
    """
    try:
        return get_task_status(task_id)
    except Exception as e:
        logger.error(f"Error getting task status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get task status")


@router.get("/health", response_model=HealthResponse)
async def health_check() -> Dict[str, Any]:
    """Health check endpoint.
    
    Returns:
        Health status of all services
    """
    return get_health_status()


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics() -> Dict[str, Any]:
    """Performance metrics endpoint.
    
    Returns:
        Performance and utilization metrics
    """
    metrics_collector = get_metrics_collector()
    base_metrics = metrics_collector.get_metrics()
    gpu_metrics = get_gpu_metrics()
    active_tasks = get_active_tasks_count()
    
    return {
        **base_metrics,
        "active_tasks": active_tasks,
        **gpu_metrics,
    }


@router.post("/circuit/optimize", response_model=CircuitOptimizeResponse)
async def optimize_circuit_endpoint(request: CircuitOptimizeRequest) -> Dict[str, Any]:
    """Optimize a quantum circuit synchronously.
    
    Performs gate cancellation (H, X, Y, Z) and Swap detection.
    
    Args:
        request: Circuit optimization request
        
    Returns:
        Optimization results with performance comparison
    """
    try:
        gates_data = [
            {"gate_type": gate.gate_type, "qubits": gate.qubits}
            for gate in request.gates
        ]
        
        result = optimize_circuit(
            num_qubits=request.num_qubits,
            gates_data=gates_data,
            measure_execution_time=request.measure_execution_time
        )
        
        return {
            "success": True,
            **result
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error optimizing circuit: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/circuit/optimize-and-execute", response_model=Dict[str, Any])
async def optimize_and_execute_circuit(request: CircuitOptimizeRequest) -> Dict[str, Any]:
    """Optimize a circuit and execute the optimized version.
    
    Args:
        request: Circuit optimization request with execution
        
    Returns:
        Optimization results and execution results
    """
    start_time = time.time()
    
    try:
        gates_data = [
            {"gate_type": gate.gate_type, "qubits": gate.qubits}
            for gate in request.gates
        ]
        
        opt_result = optimize_circuit(
            num_qubits=request.num_qubits,
            gates_data=gates_data,
            measure_execution_time=request.measure_execution_time
        )
        
        optimized_gates = opt_result["optimized_gates"]
        
        circuit = QuantumCircuit(request.num_qubits)
        
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
            execution_time = (time.time() - start_time) * 1000
            
            return {
                "success": True,
                "optimization": opt_result,
                "execution": {
                    "circuit_id": circuit_hash,
                    "probabilities": cached_result["probabilities"],
                    "measurements": cached_result.get("measurements"),
                    "state_vector": cached_result.get("state_vector"),
                    "execution_time_ms": execution_time,
                    "gpu_accelerated": circuit._gpu_available,
                    "from_cache": True,
                }
            }
        
        state_vector = circuit.execute()
        probabilities = circuit.get_probabilities()
        measurements = circuit.measure(request.shots if hasattr(request, 'shots') else 1024)
        
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
            "optimization": opt_result,
            "execution": {
                "circuit_id": circuit_hash,
                "probabilities": probabilities,
                "measurements": measurements,
                "state_vector": state_vector_list,
                "execution_time_ms": execution_time,
                "gpu_accelerated": circuit._gpu_available,
                "from_cache": False,
            }
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in optimize and execute: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/circuit/optimize/async", response_model=AsyncTaskSubmitResponse)
async def submit_async_optimization(request: CircuitOptimizeRequest) -> Dict[str, Any]:
    """Submit a quantum circuit for async optimization.
    
    Args:
        request: Circuit optimization request
        
    Returns:
        Task ID for status polling
    """
    try:
        gates_data = [
            {"gate_type": gate.gate_type, "qubits": gate.qubits}
            for gate in request.gates
        ]
        
        task = optimize_circuit_task.delay(
            num_qubits=request.num_qubits,
            gates_data=gates_data,
            measure_execution_time=request.measure_execution_time,
            execute_after_optimize=False,
        )
        
        return {
            "success": True,
            "task_id": task.id,
            "message": "Optimization task submitted successfully. Use GET /circuit/optimize/async/{task_id} to check status.",
        }
    
    except Exception as e:
        logger.error(f"Error submitting async optimization: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to submit optimization task")


@router.post("/circuit/optimize-and-execute/async", response_model=AsyncTaskSubmitResponse)
async def submit_async_optimize_and_execute(request: CircuitOptimizeRequest) -> Dict[str, Any]:
    """Submit a quantum circuit for async optimization and execution.
    
    Args:
        request: Circuit optimization request
        
    Returns:
        Task ID for status polling
    """
    try:
        gates_data = [
            {"gate_type": gate.gate_type, "qubits": gate.qubits}
            for gate in request.gates
        ]
        
        task = optimize_circuit_task.delay(
            num_qubits=request.num_qubits,
            gates_data=gates_data,
            measure_execution_time=request.measure_execution_time,
            execute_after_optimize=True,
            shots=request.shots if hasattr(request, 'shots') else 1024,
        )
        
        return {
            "success": True,
            "task_id": task.id,
            "message": "Optimize and execute task submitted successfully. Use GET /circuit/optimize/async/{task_id} to check status.",
        }
    
    except Exception as e:
        logger.error(f"Error submitting async optimize and execute: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to submit task")


@router.get("/circuit/optimize/async/{task_id}")
async def get_async_optimization_status(task_id: str) -> Dict[str, Any]:
    """Get status of an async optimization task.
    
    Args:
        task_id: Celery task ID
        
    Returns:
        Task status and result if complete
    """
    try:
        task = optimize_circuit_task.AsyncResult(task_id)
        
        result = {
            "task_id": task_id,
            "status": task.status,
        }
        
        if task.state == "SUCCESS":
            result["result"] = task.result
        elif task.state == "FAILURE":
            result["error"] = str(task.result)
        
        return result
    except Exception as e:
        logger.error(f"Error getting optimization task status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get task status")
