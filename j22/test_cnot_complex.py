"""Test more complex CNOT scenarios."""

import numpy as np


def CNOT():
    return np.array([
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 1],
        [0, 0, 1, 0]
    ], dtype=np.complex128)


def H():
    return np.array([[1, 1], [1, -1]], dtype=np.complex128) / np.sqrt(2)


def apply_single_qubit_gate(state, gate, qubit, num_qubits):
    state = state.reshape([2] * num_qubits)
    gate = gate.reshape([2, 2])
    state = np.tensordot(gate, state, axes=([1], [qubit]))
    state = np.moveaxis(state, 0, qubit)
    return state.flatten()


def apply_two_qubit_gate_old(state, gate, control, target, num_qubits):
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
    state = state.reshape([2] * num_qubits)
    gate = gate.reshape([2, 2, 2, 2])
    
    state = np.tensordot(gate, state, axes=([2, 3], [control, target]))
    
    result_axis_for_qubit = []
    next_other_axis = 2
    
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


def print_state(state, num_qubits, label=""):
    print(f"\n{label}")
    for i in range(2**num_qubits):
        if abs(state[i]) > 1e-10:
            bits = format(i, f'0{num_qubits}b')
            prob = abs(state[i])**2
            print(f"  |{bits}> : {state[i]:.4f} (p={prob:.4f}")


def test_bell_state_3():
    """Test Bell state on qubits 3 and 4 in 5-qubit system."""
    print("="*60)
    print("Test: Bell state on qubits 3 and 4 (5 qubits total)")
    print("="*60)
    
    num_qubits = 5
    
    # Initialize |00000>
    state_old = np.zeros(2**num_qubits, dtype=np.complex128)
    state_old[0] = 1.0
    state_new = state_old.copy()
    
    print_state(state_old, num_qubits, "Initial state |00000>")
    
    # Apply H to qubit 3
    state_old = apply_single_qubit_gate(state_old, H(), 3, num_qubits)
    state_new = apply_single_qubit_gate(state_new, H(), 3, num_qubits)
    print_state(state_old, num_qubits, "After H(3)")
    
    # Apply CNOT(3,4)
    state_old = apply_two_qubit_gate_old(state_old, CNOT(), 3, 4, num_qubits)
    state_new = apply_two_qubit_gate_new(state_new, CNOT(), 3, 4, num_qubits)
    
    print_state(state_old, num_qubits, "OLD: After CNOT(3,4)")
    print_state(state_new, num_qubits, "NEW: After CNOT(3,4)")
    
    # Expected: (|00000> + |00011>) / sqrt(2)
    print("\nExpected Bell state: (|00000> + |00011>) / sqrt(2)")
    print("  qubits 3 and 4 should be entangled")
    
    # Check probabilities
    prob_00000_old = abs(state_old[0])**2
    prob_00011_old = abs(state_old[3])**2
    prob_00000_new = abs(state_new[0])**2
    prob_00011_new = abs(state_new[3])**2
    
    print(f"\nOLD: |00000> probability: {prob_00000_old:.4f}")
    print(f"OLD: |00011> probability: {prob_00011_old:.4f}")
    print(f"NEW: |00000> probability: {prob_00000_new:.4f}")
    print(f"NEW: |00011> probability: {prob_00011_new:.4f}")
    
    if abs(prob_00000_old - 0.5) < 0.01 and abs(prob_00011_old - 0.5) < 0.01:
        print("\n✓ OLD is correct!")
    else:
        print("\n✗ OLD is wrong!")


def test_ghz_state():
    """Test GHZ state with non-adjacent qubits."""
    print("\n" + "="*60)
    print("Test: GHZ state on qubits 0, 2, 4 (5 qubits total)")
    print("="*60)
    
    num_qubits = 5
    
    state_old = np.zeros(2**num_qubits, dtype=np.complex128)
    state_old[0] = 1.0
    state_new = state_old.copy()
    
    print_state(state_old, num_qubits, "Initial state |00000>")
    
    # H(0)
    state_old = apply_single_qubit_gate(state_old, H(), 0, num_qubits)
    state_new = apply_single_qubit_gate(state_new, H(), 0, num_qubits)
    
    # CNOT(0,2)
    state_old = apply_two_qubit_gate_old(state_old, CNOT(), 0, 2, num_qubits)
    state_new = apply_two_qubit_gate_new(state_new, CNOT(), 0, 2, num_qubits)
    
    # CNOT(2,4)
    state_old = apply_two_qubit_gate_old(state_old, CNOT(), 2, 4, num_qubits)
    state_new = apply_two_qubit_gate_new(state_new, CNOT(), 2, 4, num_qubits)
    
    print_state(state_old, num_qubits, "OLD: After H(0), CNOT(0,2), CNOT(2,4)")
    print_state(state_new, num_qubits, "NEW: After H(0), CNOT(0,2), CNOT(2,4)")
    
    # Expected: (|00000> + |10101>) / sqrt(2)
    print("\nExpected GHZ: (|00000> + |10101>) / sqrt(2)")
    
    prob_00000_old = abs(state_old[0])**2
    prob_10101_old = abs(state_old[21])**2  # 10101 = 16+4+1=21
    prob_00000_new = abs(state_new[0])**2
    prob_10101_new = abs(state_new[21])**2
    
    print(f"\nOLD: |00000> probability: {prob_00000_old:.4f}")
    print(f"OLD: |10101> probability: {prob_10101_old:.4f}")
    print(f"NEW: |00000> probability: {prob_00000_new:.4f}")
    print(f"NEW: |10101> probability: {prob_10101_new:.4f}")
    
    if abs(prob_00000_old - 0.5) < 0.01 and abs(prob_10101_old - 0.5) < 0.01:
        print("\n✓ OLD is correct!")
    else:
        print("\n✗ OLD is wrong!")


if __name__ == "__main__":
    test_bell_state_3()
    test_ghz_state()
