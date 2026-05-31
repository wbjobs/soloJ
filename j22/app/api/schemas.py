"""Pydantic schemas for API requests and responses."""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from enum import Enum


class GateType(str, Enum):
    """Supported quantum gate types."""
    H = "H"
    X = "X"
    Y = "Y"
    Z = "Z"
    CNOT = "CNOT"
    TOFFOLI = "Toffoli"


class GateRequest(BaseModel):
    """Request model for applying a quantum gate."""
    gate_type: GateType
    qubits: List[int]
    
    @field_validator('qubits')
    @classmethod
    def validate_qubits(cls, v, info):
        if not v:
            raise ValueError("At least one qubit must be specified")
        if len(v) != len(set(v)):
            raise ValueError("Duplicate qubit indices are not allowed")
        return v


class CircuitCreateRequest(BaseModel):
    """Request model for creating a quantum circuit."""
    num_qubits: int = Field(..., ge=1, le=25, description="Number of qubits (1-25)")


class CircuitExecuteRequest(BaseModel):
    """Request model for executing a quantum circuit."""
    num_qubits: int = Field(..., ge=1, le=25)
    gates: List[GateRequest]
    shots: Optional[int] = Field(1024, ge=1, le=100000)


class CircuitExecuteResponse(BaseModel):
    """Response model for circuit execution."""
    success: bool
    circuit_id: str
    probabilities: Dict[str, float]
    measurements: Optional[Dict[str, int]] = None
    state_vector: Optional[List[Dict[str, float]]] = None
    execution_time_ms: float
    gpu_accelerated: bool
    from_cache: bool


class AsyncTaskSubmitResponse(BaseModel):
    """Response model for async task submission."""
    success: bool
    task_id: str
    message: str


class TaskStatusResponse(BaseModel):
    """Response model for task status."""
    task_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class CircuitVisualizationResponse(BaseModel):
    """Response model for circuit visualization."""
    num_qubits: int
    operations: List[Dict[str, Any]]
    gate_count: int
    gpu_accelerated: bool


class CircuitOptimizeRequest(BaseModel):
    """Request model for circuit optimization."""
    num_qubits: int = Field(..., ge=1, le=25)
    gates: List[GateRequest]
    measure_execution_time: Optional[bool] = Field(False, description="Whether to measure execution time")


class CircuitOptimizeResponse(BaseModel):
    """Response model for circuit optimization."""
    success: bool
    original_gate_count: int
    optimized_gate_count: int
    gates_removed: int
    optimization_ratio: float
    optimizations_applied: List[Dict[str, Any]]
    original_gates: List[Dict[str, Any]]
    optimized_gates: List[Dict[str, Any]]
    original_execution_time_ms: Optional[float] = None
    optimized_execution_time_ms: Optional[float] = None
    speedup_factor: Optional[float] = None


class CircuitOptimizeAndExecuteRequest(BaseModel):
    """Request model for optimize and execute."""
    num_qubits: int = Field(..., ge=1, le=25)
    gates: List[GateRequest]
    shots: Optional[int] = Field(1024, ge=1, le=100000)
    measure_execution_time: Optional[bool] = Field(True)


class HealthResponse(BaseModel):
    """Response model for health check."""
    status: str
    gpu_available: bool
    redis_connected: bool
    celery_connected: bool
    timestamp: float


class MetricsResponse(BaseModel):
    """Response model for performance metrics."""
    total_circuits_executed: int
    cache_hits: int
    cache_misses: int
    avg_execution_time_ms: float
    active_tasks: int
    gpu_memory_used_mb: Optional[float]
    gpu_utilization: Optional[float]
