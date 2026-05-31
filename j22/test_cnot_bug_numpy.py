"""Test script to verify CNOT gate behavior using NumPy."""

import numpy as np


def test_cnot_bug():
    num_qubits = 5
    
    # Create state |00010>
    state = np.zeros(2**num_qubits, dtype=np.complex128)
    # Index = q0*16 + q1*8 + q2*4 + q3*2 + q4*1
    # |00010> = 0*16 + 0*8 + 0*4 + 1*2 + 0*1 = 2
    state[2] = 1.0
    
    print(f"Initial state |00010> (index 2):")
    print_state(state, num_qubits)
    
    # Apply CNOT(control=3, target=4)
    state_old = apply_two_qubit_gate_old(state.copy(), CNOT(), 3, 4, num_qubits)
    
    print("\nAfter CNOT(3,4) - OLD implementation:")
    print_state(state_old, num_qubits)
    
    # Expected: |00011> (index 3)
    expected = np.zeros(2**num_qubits, dtype=np.complex128)
    expected[3] = 1.0
    print("\nExpected state |00011> (index 3):")
    print_state(expected, num_qubits)
    
    # Test new implementation
    state_new = apply_two_qubit_gate_new(state.copy(), CNOT(), 3, 4, num_qubits)
    
    print("\nAfter CNOT(3,4) - NEW implementation:")
    print_state(state_new, num_qubits)
    
    # Check correctness
    if np.allclose(state_new, expected):
        print("\n✓ NEW implementation is CORRECT!")
    else:
        print("\n✗ NEW implementation is still wrong!")
    
    if np.allclose(state_old, expected):
        print("✓ OLD implementation is CORRECT!")
    else:
        print("✗ OLD implementation is WRONG!")
    
    # Test another case: CNOT(0,1) on |10>
    print("\n" + "="*50)
    print("Test 2: CNOT(0,1) on |10> (2 qubits)")
    print("="*50)
    
    num_qubits2 = 2
    state2 = np.zeros(4, dtype=np.complex128)
    state2[2] = 1.0  # |10>
    
    print(f"Initial state |10> (index 2):")
    print_state(state2, num_qubits2)
    
    expected2 = np.zeros(4, dtype=np.complex128)
    expected2[3] = 1.0  # |11>
    
    result_old = apply_two_qubit_gate_old(state2.copy(), CNOT(), 0, 1, num_qubits2)
    result_new = apply_two_qubit_gate_new(state2.copy(), CNOT(), 0, 1, num_qubits2)
    
    print("\nOLD result:")
    print_state(result_old, num_qubits2)
    print("NEW result:")
    print_state(result_new, num_qubits2)
    print("Expected:")
    print_state(expected2, num_qubits2)
    
    # Test CNOT(1,0) on |01> (reverse order)
    print("\n" + "="*50)
    print("Test 3: CNOT(1,0) on |01> (2 qubits)")
    print("="*50)
    
    state3 = np.zeros(4, dtype=np.complex128)
    state3[1] = 1.0  # |01>, q1=1 (control), q0=0 (target)
    
    print(f"Initial state |01> (index 1):")
    print_state(state3, num_qubits2)
    
    # CNOT(1,0): control=1, target=0
    # When control=1 (MSB), target=0 (LSB) is flipped
    # |01> → |11> (index 3)
    expected3 = np.zeros(4, dtype=np.complex128)
    expected3[3] = 1.0  # |11>
    
    result_old3 = apply_two_qubit_gate_old(state3.copy(), CNOT(), 1, 0, num_qubits2)
    result_new3 = apply_two_qubit_gate_new(state3.copy(), CNOT(), 1, 0, num_qubits2)
    
    print("\nOLD result:")
    print_state(result_old3, num_qubits2)
    print("NEW result:")
    print_state(result_new3, num_qubits2)
    print("Expected:")
    print_state(expected3, num_qubits2)


def CNOT():
    return np.array([
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 1],
        [0, 0, 1, 0]
    ], dtype=np.complex128)


def apply_two_qubit_gate_old(state, gate, control, target, num_qubits):
    """Original (buggy) implementation."""
    state = state.reshape([2] * num_qubits)
    gate = gate.reshape([2, 2, 2, 2])
    
    order = [control, target] + [i for i in range(num_qubits) if i not in [control, target]]
    inv_order = [0] * num_qubits
    for i, pos in enumerate(order):
        inv_order[pos] = i
    
    state = np.transpose(state, order)
    state = np.tensordot(gate, state, axes=([2, 3], [0, 1]))
    state = np.transpose(state, inv_order)
    
    return state.flatten()


def apply_two_qubit_gate_new(state, gate, control, target, num_qubits):
    """Fixed implementation."""
    state = state.reshape([2] * num_qubits)
    gate = gate.reshape([2, 2, 2, 2])
    
    # gate dimensions: [control_out, target_out, control_in, target_in]
    # Contract gate axes (2,3) = (control_in, target_in) with state axes (control, target)
    state = np.tensordot(gate, state, axes=([2, 3], [control, target]))
    
    # Result dimensions: [control_out, target_out] + [all other qubits in original order]
    # We need to place control_out and target_out back to their original positions
    
    # Build the transpose order:
    # For each original qubit position i, find where it is in the result
    result_axis_for_qubit = []
    next_other_axis = 2  # axes 0 and 1 are control_out and target_out
    
    for i in range(num_qubits):
        if i == control:
            result_axis_for_qubit.append(0)
        elif i == target:
            result_axis_for_qubit.append(1)
        else:
            result_axis_for_qubit.append(next_other_axis)
            next_other_axis += 1
    
    state = np.transpose(state, result_axis_for_qubit)
    
    return state.flatten()


def print_state(state, num_qubits):
    for i in range(2**num_qubits):
        if abs(state[i]) > 1e-10:
            bits = format(i, f'0{num_qubits}b')
            print(f"  |{bits}> : {state[i]:.4f}")


if __name__ == "__main__":
    test_cnot_bug()
