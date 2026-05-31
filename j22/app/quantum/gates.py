"""Quantum gate definitions using CuPy for GPU acceleration."""

import cupy as cp
import numpy as np
from typing import Tuple


class QuantumGates:
    """Quantum gate matrices implemented with CuPy."""

    @staticmethod
    def H() -> cp.ndarray:
        """Hadamard gate."""
        return cp.array([[1, 1], [1, -1]], dtype=cp.complex128) / cp.sqrt(2)

    @staticmethod
    def X() -> cp.ndarray:
        """Pauli-X gate (NOT gate)."""
        return cp.array([[0, 1], [1, 0]], dtype=cp.complex128)

    @staticmethod
    def Y() -> cp.ndarray:
        """Pauli-Y gate."""
        return cp.array([[0, -1j], [1j, 0]], dtype=cp.complex128)

    @staticmethod
    def Z() -> cp.ndarray:
        """Pauli-Z gate."""
        return cp.array([[1, 0], [0, -1]], dtype=cp.complex128)

    @staticmethod
    def CNOT() -> cp.ndarray:
        """CNOT gate (2-qubit)."""
        return cp.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 0, 1],
            [0, 0, 1, 0]
        ], dtype=cp.complex128)

    @staticmethod
    def Toffoli() -> cp.ndarray:
        """Toffoli gate (3-qubit, CCNOT)."""
        return cp.array([
            [1, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 1],
            [0, 0, 0, 0, 0, 0, 1, 0]
        ], dtype=cp.complex128)


def apply_single_qubit_gate(
    state: cp.ndarray,
    gate: cp.ndarray,
    qubit: int,
    num_qubits: int
) -> cp.ndarray:
    """Apply a single-qubit gate to the state vector.
    
    Args:
        state: Current state vector
        gate: 2x2 gate matrix
        qubit: Target qubit index
        num_qubits: Total number of qubits
        
    Returns:
        New state vector after gate application
    """
    state = state.reshape([2] * num_qubits)
    gate = gate.reshape([2, 2])
    
    axes = list(range(num_qubits))
    axes.remove(qubit)
    axes = [qubit] + axes
    
    state = cp.tensordot(gate, state, axes=([1], [qubit]))
    state = cp.moveaxis(state, 0, qubit)
    
    return state.flatten()


def apply_two_qubit_gate(
    state: cp.ndarray,
    gate: cp.ndarray,
    control: int,
    target: int,
    num_qubits: int
) -> cp.ndarray:
    """Apply a two-qubit gate to the state vector.
    
    Args:
        state: Current state vector
        gate: 4x4 gate matrix
        control: Control qubit index
        target: Target qubit index
        num_qubits: Total number of qubits
        
    Returns:
        New state vector after gate application
    """
    state = state.reshape([2] * num_qubits)
    gate = gate.reshape([2, 2, 2, 2])
    
    state = cp.tensordot(gate, state, axes=([2, 3], [control, target]))
    
    remaining = iter(range(2, num_qubits + 2))
    new_axes = []
    for i in range(num_qubits):
        if i == control:
            new_axes.append(0)
        elif i == target:
            new_axes.append(1)
        else:
            new_axes.append(next(remaining))
    
    state = cp.transpose(state, new_axes)
    
    return state.flatten()


def apply_three_qubit_gate(
    state: cp.ndarray,
    gate: cp.ndarray,
    control1: int,
    control2: int,
    target: int,
    num_qubits: int
) -> cp.ndarray:
    """Apply a three-qubit gate to the state vector.
    
    Args:
        state: Current state vector
        gate: 8x8 gate matrix
        control1: First control qubit index
        control2: Second control qubit index
        target: Target qubit index
        num_qubits: Total number of qubits
        
    Returns:
        New state vector after gate application
    """
    state = state.reshape([2] * num_qubits)
    gate = gate.reshape([2, 2, 2, 2, 2, 2])
    
    state = cp.tensordot(gate, state, axes=([3, 4, 5], [control1, control2, target]))
    
    remaining = iter(range(3, num_qubits + 3))
    new_axes = []
    for i in range(num_qubits):
        if i == control1:
            new_axes.append(0)
        elif i == control2:
            new_axes.append(1)
        elif i == target:
            new_axes.append(2)
        else:
            new_axes.append(next(remaining))
    
    state = cp.transpose(state, new_axes)
    
    return state.flatten()


def measure_all(state: cp.ndarray, num_qubits: int, shots: int = 1024) -> dict:
    """Measure all qubits and return measurement statistics.
    
    Args:
        state: State vector
        num_qubits: Number of qubits
        shots: Number of measurement shots
        
    Returns:
        Dictionary mapping bitstrings to counts
    """
    probabilities = cp.abs(state) ** 2
    probabilities = cp.asnumpy(probabilities)
    
    outcomes = np.arange(2 ** num_qubits)
    samples = np.random.choice(outcomes, size=shots, p=probabilities)
    
    counts = {}
    for sample in samples:
        bitstring = format(sample, f'0{num_qubits}b')
        counts[bitstring] = counts.get(bitstring, 0) + 1
    
    return counts


def get_probability_distribution(state: cp.ndarray, num_qubits: int) -> dict:
    """Get the probability distribution of all basis states.
    
    Args:
        state: State vector
        num_qubits: Number of qubits
        
    Returns:
        Dictionary mapping bitstrings to probabilities
    """
    probabilities = cp.abs(state) ** 2
    probabilities = cp.asnumpy(probabilities)
    
    dist = {}
    for i in range(2 ** num_qubits):
        bitstring = format(i, f'0{num_qubits}b')
        prob = float(probabilities[i])
        if prob > 1e-15:
            dist[bitstring] = prob
    
    return dist
