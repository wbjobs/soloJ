"""Quantum circuit simulator using CuPy for GPU acceleration."""

import cupy as cp
import hashlib
import json
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict

from .gates import (
    QuantumGates,
    apply_single_qubit_gate,
    apply_two_qubit_gate,
    apply_three_qubit_gate,
    measure_all,
    get_probability_distribution
)


MAX_QUBITS = 25


@dataclass
class GateOperation:
    """Represents a quantum gate operation in the circuit."""
    gate_type: str
    qubits: List[int]
    params: Dict[str, Any] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class QuantumCircuit:
    """Quantum circuit simulator with GPU acceleration."""
    
    def __init__(self, num_qubits: int):
        """Initialize a quantum circuit.
        
        Args:
            num_qubits: Number of qubits (max 25)
        """
        if num_qubits < 1 or num_qubits > MAX_QUBITS:
            raise ValueError(f"Number of qubits must be between 1 and {MAX_QUBITS}")
        
        self.num_qubits = num_qubits
        self.operations: List[GateOperation] = []
        self._state: Optional[cp.ndarray] = None
        self._gpu_available = self._check_gpu()
    
    def _check_gpu(self) -> bool:
        """Check if GPU is available."""
        try:
            cp.cuda.Device(0).compute_capability
            return True
        except Exception:
            return False
    
    def _initialize_state(self) -> cp.ndarray:
        """Initialize the state vector to |0...0>."""
        size = 2 ** self.num_qubits
        state = cp.zeros(size, dtype=cp.complex128)
        state[0] = 1.0
        return state
    
    def h(self, qubit: int) -> None:
        """Apply Hadamard gate."""
        self._validate_qubit(qubit)
        self.operations.append(GateOperation("H", [qubit]))
    
    def x(self, qubit: int) -> None:
        """Apply Pauli-X gate."""
        self._validate_qubit(qubit)
        self.operations.append(GateOperation("X", [qubit]))
    
    def y(self, qubit: int) -> None:
        """Apply Pauli-Y gate."""
        self._validate_qubit(qubit)
        self.operations.append(GateOperation("Y", [qubit]))
    
    def z(self, qubit: int) -> None:
        """Apply Pauli-Z gate."""
        self._validate_qubit(qubit)
        self.operations.append(GateOperation("Z", [qubit]))
    
    def cnot(self, control: int, target: int) -> None:
        """Apply CNOT gate."""
        self._validate_qubit(control)
        self._validate_qubit(target)
        if control == target:
            raise ValueError("Control and target qubits must be different")
        self.operations.append(GateOperation("CNOT", [control, target]))
    
    def toffoli(self, control1: int, control2: int, target: int) -> None:
        """Apply Toffoli gate (CCNOT)."""
        self._validate_qubit(control1)
        self._validate_qubit(control2)
        self._validate_qubit(target)
        if len({control1, control2, target}) != 3:
            raise ValueError("All qubits must be distinct")
        self.operations.append(GateOperation("Toffoli", [control1, control2, target]))
    
    def _validate_qubit(self, qubit: int) -> None:
        """Validate qubit index."""
        if qubit < 0 or qubit >= self.num_qubits:
            raise ValueError(f"Qubit index must be between 0 and {self.num_qubits - 1}")
    
    def execute(self) -> cp.ndarray:
        """Execute the circuit and return the final state vector.
        
        Returns:
            Final state vector as CuPy array
        """
        state = self._initialize_state()
        
        for op in self.operations:
            gate_matrix = self._get_gate_matrix(op.gate_type)
            
            if op.gate_type in ["H", "X", "Y", "Z"]:
                state = apply_single_qubit_gate(
                    state, gate_matrix, op.qubits[0], self.num_qubits
                )
            elif op.gate_type == "CNOT":
                state = apply_two_qubit_gate(
                    state, gate_matrix, op.qubits[0], op.qubits[1], self.num_qubits
                )
            elif op.gate_type == "Toffoli":
                state = apply_three_qubit_gate(
                    state, gate_matrix, op.qubits[0], op.qubits[1], op.qubits[2], self.num_qubits
                )
        
        self._state = state
        return state
    
    def _get_gate_matrix(self, gate_type: str) -> cp.ndarray:
        """Get the matrix for a gate type."""
        gate_map = {
            "H": QuantumGates.H,
            "X": QuantumGates.X,
            "Y": QuantumGates.Y,
            "Z": QuantumGates.Z,
            "CNOT": QuantumGates.CNOT,
            "Toffoli": QuantumGates.Toffoli,
        }
        return gate_map[gate_type]()
    
    def measure(self, shots: int = 1024) -> Dict[str, int]:
        """Measure all qubits.
        
        Args:
            shots: Number of measurement shots
            
        Returns:
            Dictionary of measurement counts
        """
        if self._state is None:
            self.execute()
        return measure_all(self._state, self.num_qubits, shots)
    
    def get_probabilities(self) -> Dict[str, float]:
        """Get probability distribution.
        
        Returns:
            Dictionary mapping bitstrings to probabilities
        """
        if self._state is None:
            self.execute()
        return get_probability_distribution(self._state, self.num_qubits)
    
    def get_state_vector(self) -> List[complex]:
        """Get the state vector as a list of complex numbers.
        
        Returns:
            State vector as list
        """
        if self._state is None:
            self.execute()
        return [complex(x.real, x.imag) for x in cp.asnumpy(self._state)]
    
    def get_circuit_json(self) -> Dict[str, Any]:
        """Get JSON representation for visualization.
        
        Returns:
            Circuit visualization data
        """
        return {
            "num_qubits": self.num_qubits,
            "operations": [op.to_dict() for op in self.operations],
            "gate_count": len(self.operations),
            "gpu_accelerated": self._gpu_available,
        }
    
    def get_circuit_hash(self) -> str:
        """Generate a unique hash for the circuit.
        
        Returns:
            Hash string for caching
        """
        circuit_data = json.dumps(self.get_circuit_json(), sort_keys=True)
        return hashlib.sha256(circuit_data.encode()).hexdigest()
