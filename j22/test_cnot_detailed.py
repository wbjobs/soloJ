"""Test CNOT with qubits in between."""

import numpy as np


def apply_two_qubit_gate(state, gate, control, target, num_qubits):
    state = state.reshape([2] * num_qubits)
    gate = gate.reshape([2, 2, 2, 2])
    
    order = [control, target] + [i for i in range(num_qubits) if i not in [control, target]]
    inv_order = [0] * num_qubits
    for i, pos in enumerate(order):
        inv_order[pos] = i
    
    print(f"  control={control}, target={target}")
    print(f"  order = {order}")
    print(f"  inv_order = {inv_order}")
    
    state = np.transpose(state, order)
    print(f"  After transpose, state.shape = {state.shape}")
    
    print(f"  gate shape: {gate.shape}")
    
    state = np.tensordot(gate, state, axes=([2, 3], [0, 1]))
    print(f"  After tensordot, state.shape = {state.shape}")
    
    state = np.transpose(state, inv_order)
    print(f"  After inv transpose, state.shape = {state.shape}")
    
    return state.flatten()


def apply_single_qubit_gate(state, gate, qubit, num_qubits):
    state = state.reshape([2] * num_qubits)
    gate = gate.reshape([2, 2])
    state = np.tensordot(gate, state, axes=([1], [qubit]))
    state = np.moveaxis(state, 0, qubit)
    return state.flatten()


def CNOT():
    return np.array([
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 1],
        [0, 0, 1, 0]
    ], dtype=np.complex128)


def X():
    return np.array([[0, 1], [1, 0]], dtype=np.complex128)


def H():
    return np.array([[1, 1], [1, -1]], dtype=np.complex128) / np.sqrt(2)


def print_state(state, num_qubits, label=""):
    if label:
        print(f"\n{label}")
    for i in range(2**num_qubits):
        if abs(state[i]) > 1e-10:
            bits = format(i, f'0{num_qubits}b')
            print(f"  |{bits}> : {state[i]:.4f}")


def test_cnot_1_3():
    """Test CNOT(1,3) - control and target with qubit 2 in between."""
    print("="*70)
    print("Test: CNOT(1,3) in 5-qubit system")
    print("Qubit 2 is between control (1) and target (3)")
    print("="*70)
    
    num_qubits = 5
    
    # Initial state: |01000> = q1=1, q3=0
    # After CNOT(1,3): control=1, target=3
    # Expected: |01010> (q1=1, q3=1)
    
    state = np.zeros(2**num_qubits, dtype=np.complex128)
    state[8] = 1.0  # |01000>
    
    print_state(state, num_qubits, "Initial state |01000>")
    
    state = apply_two_qubit_gate(state, CNOT(), 1, 3, num_qubits)
    
    print_state(state, num_qubits, "After CNOT(1,3)")
    
    expected = np.zeros(2**num_qubits, dtype=np.complex128)
    expected[10] = 1.0  # |01010>
    
    if np.allclose(state, expected):
        print("\n✓ CORRECT! |01000> → |01010>")
    else:
        print("\n✗ WRONG!")
        print_state(expected, num_qubits, "Expected |01010>")


def test_cnot_0_4():
    """Test CNOT(0,4) - control and target at extremes."""
    print("\n" + "="*70)
    print("Test: CNOT(0,4) - first and last qubit")
    print("="*70)
    
    num_qubits = 5
    
    # Initial state: |10000> = q0=1
    # After CNOT(0,4): expected |10001>
    
    state = np.zeros(2**num_qubits, dtype=np.complex128)
    state[16] = 1.0  # |10000>
    
    print_state(state, num_qubits, "Initial state |10000>")
    
    state = apply_two_qubit_gate(state, CNOT(), 0, 4, num_qubits)
    
    print_state(state, num_qubits, "After CNOT(0,4)")
    
    expected = np.zeros(2**num_qubits, dtype=np.complex128)
    expected[17] = 1.0  # |10001>
    
    if np.allclose(state, expected):
        print("\n✓ CORRECT! |10000> → |10001>")
    else:
        print("\n✗ WRONG!")


def test_swap_test():
    """Test a more complex circuit."""
    print("\n" + "="*70)
    print("Test: H(0) + CNOT(0,2) + CNOT(2,4)")
    print("="*70)
    
    num_qubits = 5
    
    state = np.zeros(2**num_qubits, dtype=np.complex128)
    state[0] = 1.0
    
    state = apply_single_qubit_gate(state, H(), 0, num_qubits)
    state = apply_two_qubit_gate(state, CNOT(), 0, 2, num_qubits)
    state = apply_two_qubit_gate(state, CNOT(), 2, 4, num_qubits)
    
    print_state(state, num_qubits, "Final state:")
    
    # Expected: (|00000> + |10101>) / sqrt(2)
    print("\nExpected: (|00000> + |10101>) / sqrt(2)")
    print("  Probability of |00000>: 0.5")
    print("  Probability of |10101>: 0.5")
    
    p0 = abs(state[0])**2
    p21 = abs(state[21])**2
    print(f"\nActual: |00000> = {p0:.4f}, |10101> = {p21:.4f}")
    
    if abs(p0 - 0.5) < 0.01 and abs(p21 - 0.5) < 0.01:
        print("✓ CORRECT!")
    else:
        print("✗ WRONG!")


if __name__ == "__main__":
    test_cnot_1_3()
    test_cnot_0_4()
    test_swap_test()
