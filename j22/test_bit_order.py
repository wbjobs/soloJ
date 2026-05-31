"""Test to check qubit ordering conventions."""

import numpy as np


def apply_two_qubit_gate(state, gate, control, target, num_qubits):
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


def test_bit_order():
    """Demonstrate bit ordering."""
    print("="*70)
    print("QUBIT BIT ORDERING DEMONSTRATION")
    print("="*70)
    
    num_qubits = 5
    
    print("\nOur implementation uses BIG-ENDIAN (MSB first):")
    print("  State index = q0*16 + q1*8 + q2*4 + q3*2 + q4*1")
    print("  Bitstring format: q0 q1 q2 q3 q4")
    print("  |00001> means q4=1, others=0 (LSB is last qubit)")
    print()
    
    # Test: X gate on qubit 0
    state = np.zeros(2**num_qubits, dtype=np.complex128)
    state[0] = 1.0
    state = apply_single_qubit_gate(state, X(), 0, num_qubits)
    
    print("X(0) - flip qubit 0 (MSB):")
    for i in range(2**num_qubits):
        if abs(state[i]) > 1e-10:
            bits = format(i, f'0{num_qubits}b')
            print(f"  Index {i}: |{bits}>  (q0={bits[0]}, q1={bits[1]}, q2={bits[2]}, q3={bits[3]}, q4={bits[4]})")
    
    # Test: X gate on qubit 4
    state = np.zeros(2**num_qubits, dtype=np.complex128)
    state[0] = 1.0
    state = apply_single_qubit_gate(state, X(), 4, num_qubits)
    
    print("\nX(4) - flip qubit 4 (LSB):")
    for i in range(2**num_qubits):
        if abs(state[i]) > 1e-10:
            bits = format(i, f'0{num_qubits}b')
            print(f"  Index {i}: |{bits}>  (q0={bits[0]}, q1={bits[1]}, q2={bits[2]}, q3={bits[3]}, q4={bits[4]})")
    
    print("\n" + "-"*70)
    print("If you expect LITTLE-ENDIAN (LSB first, q0 is LSB):")
    print("  State index = q4*16 + q3*8 + q2*4 + q1*2 + q0*1")
    print("  This would give different results!")
    print("="*70)


def test_cnot_big_endian():
    """Show CNOT behavior with big-endian."""
    print("\n" + "="*70)
    print("CNOT(3,4) BEHAVIOR WITH BIG-ENDIAN")
    print("="*70)
    
    num_qubits = 5
    
    # Create |00010> = q3=1, q4=0
    state = np.zeros(2**num_qubits, dtype=np.complex128)
    state[2] = 1.0
    
    bits = format(2, f'0{num_qubits}b')
    print(f"\nInitial state: |{bits}> (index 2)")
    print(f"  q0={bits[0]}, q1={bits[1]}, q2={bits[2]}, q3={bits[3]}, q4={bits[4]}")
    print(f"  Control qubit 3 = {bits[3]}, Target qubit 4 = {bits[4]}")
    
    # Apply CNOT(3,4)
    state = apply_two_qubit_gate(state, CNOT(), 3, 4, num_qubits)
    
    for i in range(2**num_qubits):
        if abs(state[i]) > 1e-10:
            bits = format(i, f'0{num_qubits}b')
            print(f"\nAfter CNOT(3,4): |{bits}> (index {i})")
            print(f"  q0={bits[0]}, q1={bits[1]}, q2={bits[2]}, q3={bits[3]}, q4={bits[4]}")
            print(f"  Control qubit 3 = {bits[3]}, Target qubit 4 = {bits[4]}")
    
    print("\nEXPECTED (big-endian):")
    print("  Control=1 (q3=1) → flip target (q4)")
    print("  |00010> → |00011>")
    print("\nIf you expected something different, check your bit ordering convention!")


if __name__ == "__main__":
    test_bit_order()
    test_cnot_big_endian()
