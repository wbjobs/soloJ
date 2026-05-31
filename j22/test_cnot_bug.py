"""Test script to verify CNOT gate behavior."""

import numpy as np
import cupy as cp


# Test the bug: 5 qubits, CNOT control=3, target=4
# Initial state: |00010> (q3=1, q4=0)
# Expected after CNOT(3,4): |00011> (q3=1, q4=1)

def test_cnot_bug():
    num_qubits = 5
    
    # Create state |00010>
    state = cp.zeros(2**num_qubits, dtype=cp.complex128)
    # Index = q0*16 + q1*8 + q2*4 + q3*2 + q4*1
    # |00010> = 0*16 + 0*8 + 0*4 + 1*2 + 0*1 = 2
    state[2] = 1.0
    
    print(f"Initial state |00010> (index 2):")
    print_state(state, num_qubits)
    
    # Apply CNOT(control=3, target=4)
    state = apply_two_qubit_gate_old(state, CNOT(), 3, 4, num_qubits)
    
    print("\nAfter CNOT(3,4) - OLD implementation:")
    print_state(state, num_qubits)
    
    # Expected: |00011> (index 3)
    expected = cp.zeros(2**num_qubits, dtype=cp.complex128)
    expected[3] = 1.0
    print("\nExpected state |00011> (index 3):")
    print_state(expected, num_qubits)
    
    # Test new implementation
    state2 = cp.zeros(2**num_qubits, dtype=cp.complex128)
    state2[2] = 1.0
    state2 = apply_two_qubit_gate_new(state2, CNOT(), 3, 4, num_qubits)
    
    print("\nAfter CNOT(3,4) - NEW implementation:")
    print_state(state2, num_qubits)
    
    # Check correctness
    if cp.allclose(state2, expected):
        print("\n✓ NEW implementation is CORRECT!")
    else:
        print("\n✗ NEW implementation is still wrong!")


def CNOT():
    return cp.array([
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 1],
        [0, 0, 1, 0]
    ], dtype=cp.complex128)


def apply_two_qubit_gate_old(state, gate, control, target, num_qubits):
    """Original (buggy) implementation."""
    state = state.reshape([2] * num_qubits)
    gate = gate.reshape([2, 2, 2, 2])
    
    order = [control, target] + [i for i in range(num_qubits) if i not in [control, target]]
    inv_order = [0] * num_qubits
    for i, pos in enumerate(order):
        inv_order[pos] = i
    
    state = cp.transpose(state, order)
    # BUG: axes=([2, 3], [0, 1]) contracts gate's input axes with state's first two axes
    # but the resulting tensor dimensions are in wrong order for the inverse transpose
    state = cp.tensordot(gate, state, axes=([2, 3], [0, 1]))
    state = cp.transpose(state, inv_order)
    
    return state.flatten()


def apply_two_qubit_gate_new(state, gate, control, target, num_qubits):
    """Fixed implementation."""
    state = state.reshape([2] * num_qubits)
    gate = gate.reshape([2, 2, 2, 2])
    
    # gate dimensions: [control_out, target_out, control_in, target_in]
    # We need to contract control_in, target_in with the control, target axes of state
    
    # Instead of transposing, we can directly specify which axes to contract
    # Contract gate axes (2,3) = (control_in, target_in) with state axes (control, target)
    state = cp.tensordot(gate, state, axes=([2, 3], [control, target]))
    
    # Result dimensions: [control_out, target_out] + [all other qubits in order]
    # We need to place control_out and target_out back to their original positions
    
    # Build the correct inverse order
    result_axis = 0
    new_shape = []
    for i in range(num_qubits):
        if i == control:
            new_shape.append(0)  # control_out is at result axis 0
        elif i == target:
            new_shape.append(1)  # target_out is at result axis 1
        else:
            result_axis += 1
            new_shape.append(result_axis)
    
    state = cp.transpose(state, new_shape)
    
    return state.flatten()


def print_state(state, num_qubits):
    state_np = cp.asnumpy(state)
    for i in range(2**num_qubits):
        if abs(state_np[i]) > 1e-10:
            bits = format(i, f'0{num_qubits}b')
            print(f"  |{bits}> : {state_np[i]:.4f}")


if __name__ == "__main__":
    test_cnot_bug()
