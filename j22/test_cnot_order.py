"""Test CNOT when control > target."""

import numpy as np


def CNOT():
    return np.array([
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 1],
        [0, 0, 1, 0]
    ], dtype=np.complex128)


def apply_two_qubit_gate_old(state, gate, control, target, num_qubits):
    state = state.reshape([2] * num_qubits)
    gate = gate.reshape([2, 2, 2, 2])
    
    order = [control, target] + [i for i in range(num_qubits) if i not in [control, target]]
    inv_order = [0] * num_qubits
    for i, pos in enumerate(order):
        inv_order[pos] = i
    
    print(f"  control={control}, target={target}")
    print(f"  order: {order}")
    print(f"  inv_order: {inv_order}")
    
    state = np.transpose(state, order)
    print(f"  After transpose shape: {state.shape}")
    
    state = np.tensordot(gate, state, axes=([2, 3], [0, 1]))
    print(f"  After tensordot shape: {state.shape}")
    
    state = np.transpose(state, inv_order)
    print(f"  After inv transpose shape: {state.shape}")
    
    return state.flatten()


def test_control_greater_than_target():
    """Test CNOT when control index > target index."""
    print("="*60)
    print("Test: CNOT(4, 3) - control > target (5 qubits)")
    print("="*60)
    
    num_qubits = 5
    
    # Initial state |00001> = q4=1, q3=0
    # CNOT(4,3): control=4, target=3
    # When control=4 is |1>, flip target=3
    # |00001> (q4=1,q3=0) → |00011> (q4=1,q3=1)
    state = np.zeros(2**num_qubits, dtype=np.complex128)
    state[1] = 1.0  # |00001>
    
    print(f"Initial state |00001> (index 1):")
    print_state(state, num_qubits)
    
    state = apply_two_qubit_gate_old(state, CNOT(), 4, 3, num_qubits)
    
    print(f"\nAfter CNOT(4,3):")
    print_state(state, num_qubits)
    
    expected = np.zeros(2**num_qubits, dtype=np.complex128)
    expected[3] = 1.0  # |00011>
    
    if np.allclose(state, expected):
        print("\n✓ CORRECT! |00001> → |00011>")
    else:
        print("\n✗ WRONG! Expected |00011>")
        print_state(expected, num_qubits, "Expected:")


def test_control_less_than_target():
    """Test CNOT when control index < target index."""
    print("\n" + "="*60)
    print("Test: CNOT(3, 4) - control < target (5 qubits)")
    print("="*60)
    
    num_qubits = 5
    
    # Initial state |00010> = q3=1, q4=0
    # CNOT(3,4): control=3, target=4
    # |00010> → |00011>
    state = np.zeros(2**num_qubits, dtype=np.complex128)
    state[2] = 1.0  # |00010>
    
    print(f"Initial state |00010> (index 2):")
    print_state(state, num_qubits)
    
    state = apply_two_qubit_gate_old(state, CNOT(), 3, 4, num_qubits)
    
    print(f"\nAfter CNOT(3,4):")
    print_state(state, num_qubits)
    
    expected = np.zeros(2**num_qubits, dtype=np.complex128)
    expected[3] = 1.0  # |00011>
    
    if np.allclose(state, expected):
        print("\n✓ CORRECT! |00010> → |00011>")
    else:
        print("\n✗ WRONG! Expected |00011>")
        print_state(expected, num_qubits, "Expected:")


def print_state(state, num_qubits, label=""):
    if label:
        print(label)
    for i in range(2**num_qubits):
        if abs(state[i]) > 1e-10:
            bits = format(i, f'0{num_qubits}b')
            print(f"  |{bits}> : {state[i]:.4f}")


if __name__ == "__main__":
    test_control_less_than_target()
    test_control_greater_than_target()
