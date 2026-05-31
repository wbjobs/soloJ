"""Direct test of gate application logic."""

import numpy as np


# Copy the gate application functions from gates.py
def apply_two_qubit_gate(state, gate, control, target, num_qubits):
    """Apply a two-qubit gate to the state vector."""
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


def apply_three_qubit_gate(state, gate, control1, control2, target, num_qubits):
    """Apply a three-qubit gate to the state vector."""
    state = state.reshape([2] * num_qubits)
    gate = gate.reshape([2, 2, 2, 2, 2, 2])
    
    order = [control1, control2, target] + [i for i in range(num_qubits) if i not in [control1, control2, target]]
    inv_order = [0] * num_qubits
    for i, pos in enumerate(order):
        inv_order[pos] = i
    
    state = np.transpose(state, order)
    state = np.tensordot(gate, state, axes=([3, 4, 5], [0, 1, 2]))
    state = np.transpose(state, inv_order)
    
    return state.flatten()


def apply_single_qubit_gate(state, gate, qubit, num_qubits):
    """Apply a single-qubit gate to the state vector."""
    state = state.reshape([2] * num_qubits)
    gate = gate.reshape([2, 2])
    state = np.tensordot(gate, state, axes=([1], [qubit]))
    state = np.moveaxis(state, 0, qubit)
    return state.flatten()


# Gate matrices
def H():
    return np.array([[1, 1], [1, -1]], dtype=np.complex128) / np.sqrt(2)

def X():
    return np.array([[0, 1], [1, 0]], dtype=np.complex128)

def CNOT():
    return np.array([
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 1],
        [0, 0, 1, 0]
    ], dtype=np.complex128)

def Toffoli():
    return np.array([
        [1, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 1],
        [0, 0, 0, 0, 0, 0, 1, 0]
    ], dtype=np.complex128)


def print_state(state, num_qubits, label=""):
    if label:
        print(label)
    for i in range(2**num_qubits):
        if abs(state[i]) > 1e-10:
            bits = format(i, f'0{num_qubits}b')
            prob = abs(state[i])**2
            print(f"  |{bits}> : {state[i]:.4f} (p={prob:.4f})")


def test_comprehensive():
    """Comprehensive test of all gates in various positions."""
    print("="*70)
    print("COMPREHENSIVE GATE TEST")
    print("="*70)
    
    num_qubits = 5
    all_passed = True
    
    # Test 1: X gate on qubit 3
    print("\n--- Test 1: X(3) ---")
    state = np.zeros(2**num_qubits, dtype=np.complex128)
    state[0] = 1.0
    state = apply_single_qubit_gate(state, X(), 3, num_qubits)
    print_state(state, num_qubits, "After X(3):")
    expected = np.zeros(2**num_qubits, dtype=np.complex128)
    expected[2] = 1.0  # |00010>
    if np.allclose(state, expected):
        print("✓ X(3) correct")
    else:
        print("✗ X(3) WRONG")
        all_passed = False
    
    # Test 2: CNOT(3,4)
    print("\n--- Test 2: CNOT(3,4) on |00010> ---")
    state = np.zeros(2**num_qubits, dtype=np.complex128)
    state[2] = 1.0  # |00010>
    state = apply_two_qubit_gate(state, CNOT(), 3, 4, num_qubits)
    print_state(state, num_qubits, "After CNOT(3,4):")
    expected = np.zeros(2**num_qubits, dtype=np.complex128)
    expected[3] = 1.0  # |00011>
    if np.allclose(state, expected):
        print("✓ CNOT(3,4) correct")
    else:
        print("✗ CNOT(3,4) WRONG")
        all_passed = False
    
    # Test 3: Bell state H(3) + CNOT(3,4)
    print("\n--- Test 3: Bell state H(3) + CNOT(3,4) ---")
    state = np.zeros(2**num_qubits, dtype=np.complex128)
    state[0] = 1.0
    state = apply_single_qubit_gate(state, H(), 3, num_qubits)
    state = apply_two_qubit_gate(state, CNOT(), 3, 4, num_qubits)
    print_state(state, num_qubits, "Bell state:")
    # Expected: (|00000> + |00011>) / sqrt(2)
    correct = (abs(state[0])**2 > 0.49 and abs(state[3])**2 > 0.49 and 
               sum(abs(state)**2) > 0.99)
    if correct:
        print("✓ Bell state correct")
    else:
        print("✗ Bell state WRONG")
        all_passed = False
    
    # Test 4: CNOT with control > target
    print("\n--- Test 4: CNOT(4,3) on |00001> ---")
    state = np.zeros(2**num_qubits, dtype=np.complex128)
    state[1] = 1.0  # |00001> - q4=1
    state = apply_two_qubit_gate(state, CNOT(), 4, 3, num_qubits)
    print_state(state, num_qubits, "After CNOT(4,3):")
    expected = np.zeros(2**num_qubits, dtype=np.complex128)
    expected[3] = 1.0  # |00011>
    if np.allclose(state, expected):
        print("✓ CNOT(4,3) correct")
    else:
        print("✗ CNOT(4,3) WRONG")
        all_passed = False
    
    # Test 5: Non-adjacent qubits
    print("\n--- Test 5: CNOT(0,4) on |10000> ---")
    state = np.zeros(2**num_qubits, dtype=np.complex128)
    state[16] = 1.0  # |10000> - q0=1
    state = apply_two_qubit_gate(state, CNOT(), 0, 4, num_qubits)
    print_state(state, num_qubits, "After CNOT(0,4):")
    expected = np.zeros(2**num_qubits, dtype=np.complex128)
    expected[17] = 1.0  # |10001>
    if np.allclose(state, expected):
        print("✓ CNOT(0,4) correct")
    else:
        print("✗ CNOT(0,4) WRONG")
        all_passed = False
    
    # Test 6: Toffoli gate
    print("\n--- Test 6: Toffoli(0,2,4) on |10100> ---")
    state = np.zeros(2**num_qubits, dtype=np.complex128)
    state[20] = 1.0  # |10100> - q0=1, q2=1
    state = apply_three_qubit_gate(state, Toffoli(), 0, 2, 4, num_qubits)
    print_state(state, num_qubits, "After Toffoli(0,2,4):")
    expected = np.zeros(2**num_qubits, dtype=np.complex128)
    expected[21] = 1.0  # |10101>
    if np.allclose(state, expected):
        print("✓ Toffoli(0,2,4) correct")
    else:
        print("✗ Toffoli(0,2,4) WRONG")
        all_passed = False
    
    # Test 7: Multiple gates in sequence
    print("\n--- Test 7: Sequence X(0) + CNOT(0,2) + CNOT(2,4) ---")
    state = np.zeros(2**num_qubits, dtype=np.complex128)
    state[0] = 1.0
    state = apply_single_qubit_gate(state, X(), 0, num_qubits)  # |10000>
    state = apply_two_qubit_gate(state, CNOT(), 0, 2, num_qubits)  # |10100>
    state = apply_two_qubit_gate(state, CNOT(), 2, 4, num_qubits)  # |10101>
    print_state(state, num_qubits, "Final state:")
    expected = np.zeros(2**num_qubits, dtype=np.complex128)
    expected[21] = 1.0  # |10101>
    if np.allclose(state, expected):
        print("✓ Sequence correct")
    else:
        print("✗ Sequence WRONG")
        all_passed = False
    
    print("\n" + "="*70)
    if all_passed:
        print("ALL TESTS PASSED! ✓")
    else:
        print("SOME TESTS FAILED! ✗")
    print("="*70)
    
    return all_passed


if __name__ == "__main__":
    test_comprehensive()
