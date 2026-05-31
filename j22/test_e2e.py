"""End-to-end test simulating real API usage."""

import sys
sys.path.insert(0, '.')

# Use numpy instead of cupy for testing
import numpy as np
np_complex128 = np.complex128

# Mock cupy
class MockCuPy:
    @staticmethod
    def array(data, dtype=None):
        return np.array(data, dtype=dtype)
    
    @staticmethod
    def zeros(shape, dtype=None):
        return np.zeros(shape, dtype=dtype)
    
    @staticmethod
    def sqrt(x):
        return np.sqrt(x)
    
    @staticmethod
    def abs(x):
        return np.abs(x)
    
    @staticmethod
    def asnumpy(x):
        return np.array(x)
    
    @staticmethod
    def tensordot(a, b, axes):
        return np.tensordot(a, b, axes)
    
    @staticmethod
    def moveaxis(a, source, destination):
        return np.moveaxis(a, source, destination)
    
    @staticmethod
    def transpose(a, axes):
        return np.transpose(a, axes)
    
    @staticmethod
    def reshape(a, shape):
        return np.reshape(a, shape)
    
    @staticmethod
    def flatten(a):
        return a.flatten()
    
    class cuda:
        class Device:
            def __init__(self, idx):
                pass
            @property
            def compute_capability(self):
                return (7, 0)

# Replace cupy with mock
import app.quantum.gates as gates_module
import app.quantum.simulator as simulator_module
gates_module.cp = MockCuPy()
simulator_module.cp = MockCuPy()

from app.quantum.simulator import QuantumCircuit


def test_user_scenario():
    """Test the exact scenario user described: 5 qubits, CNOT control=3, target=4."""
    print("="*70)
    print("Testing user scenario: 5 qubits, CNOT(3,4)")
    print("="*70)
    
    # Create circuit with 5 qubits
    qc = QuantumCircuit(5)
    
    # Apply gates to create a known state before CNOT
    # Put qubit 3 in |1> state using X gate
    qc.x(3)
    
    # Get visualization to see the circuit
    viz = qc.get_circuit_json()
    print(f"\nCircuit before CNOT:")
    print(f"  Operations: {viz['operations']}")
    
    # Execute to see state before CNOT
    qc.execute()
    state_before = qc.get_state_vector()
    probs_before = qc.get_probabilities()
    
    print(f"\nState before CNOT(3,4):")
    for bits, prob in probs_before.items():
        if prob > 0.001:
            print(f"  |{bits}> : {prob:.4f}")
    
    # Now apply CNOT(3,4)
    qc.cnot(3, 4)
    
    viz = qc.get_circuit_json()
    print(f"\nCircuit after adding CNOT:")
    print(f"  Operations: {[op['gate_type'] + str(op['qubits']) for op in viz['operations']]}")
    
    # Execute
    state_after = qc.execute()
    probs_after = qc.get_probabilities()
    
    print(f"\nState after CNOT(3,4):")
    for bits, prob in probs_after.items():
        if prob > 0.001:
            print(f"  |{bits}> : {prob:.4f}")
    
    # Expected: |00010> (X(3)) → CNOT(3,4) → |00011>
    # q3=1, q4=0 should become q3=1, q4=1
    print(f"\nExpected: |00010> → |00011>")
    
    if '00011' in probs_after and abs(probs_after['00011'] - 1.0) < 0.001:
        print("\n✓ CORRECT! CNOT(3,4) works as expected.")
    else:
        print("\n✗ WRONG! CNOT(3,4) did not produce expected result.")
        return False
    
    return True


def test_bell_state_34():
    """Test Bell state creation on qubits 3 and 4."""
    print("\n" + "="*70)
    print("Testing Bell state on qubits 3,4: H(3) + CNOT(3,4)")
    print("="*70)
    
    qc = QuantumCircuit(5)
    qc.h(3)
    qc.cnot(3, 4)
    
    probs = qc.get_probabilities()
    
    print(f"\nBell state probabilities:")
    for bits, prob in sorted(probs.items()):
        if prob > 0.001:
            print(f"  |{bits}> : {prob:.4f}")
    
    # Expected: (|00000> + |00011>) / sqrt(2)
    expected = {'00000': 0.5, '00011': 0.5}
    
    correct = True
    for bits, prob in expected.items():
        if bits not in probs or abs(probs[bits] - prob) > 0.01:
            correct = False
            break
    
    if correct and len([p for p in probs.values() if p > 0.01]) == 2:
        print("\n✓ CORRECT! Bell state (|00000> + |00011>)/√2 created.")
        return True
    else:
        print("\n✗ WRONG! Bell state not created correctly.")
        print(f"  Expected only |00000> and |00011> with 50% each.")
        return False


def test_multiple_cnots():
    """Test multiple CNOT gates in sequence."""
    print("\n" + "="*70)
    print("Testing multiple CNOTs: CNOT(0,2), CNOT(2,4)")
    print("="*70)
    
    qc = QuantumCircuit(5)
    qc.x(0)  # |10000>
    qc.cnot(0, 2)  # |10100>
    qc.cnot(2, 4)  # |10101>
    
    probs = qc.get_probabilities()
    
    print(f"\nFinal state probabilities:")
    for bits, prob in probs.items():
        if prob > 0.001:
            print(f"  |{bits}> : {prob:.4f}")
    
    if '10101' in probs and abs(probs['10101'] - 1.0) < 0.001:
        print("\n✓ CORRECT! |10000> → CNOT(0,2) → |10100> → CNOT(2,4) → |10101>")
        return True
    else:
        print("\n✗ WRONG! Expected |10101>")
        return False


def test_toffoli():
    """Test Toffoli gate."""
    print("\n" + "="*70)
    print("Testing Toffoli gate: Toffoli(1,2,4) with |110> on those qubits")
    print("="*70)
    
    qc = QuantumCircuit(5)
    qc.x(1)
    qc.x(2)
    # |01100>
    qc.toffoli(1, 2, 4)
    # Should flip qubit 4 → |01101>
    
    probs = qc.get_probabilities()
    
    print(f"\nFinal state probabilities:")
    for bits, prob in probs.items():
        if prob > 0.001:
            print(f"  |{bits}> : {prob:.4f}")
    
    if '01101' in probs and abs(probs['01101'] - 1.0) < 0.001:
        print("\n✓ CORRECT! Toffoli(1,2,4) flips target when both controls are 1.")
        return True
    else:
        print("\n✗ WRONG! Expected |01101>")
        return False


if __name__ == "__main__":
    all_passed = True
    
    all_passed &= test_user_scenario()
    all_passed &= test_bell_state_34()
    all_passed &= test_multiple_cnots()
    all_passed &= test_toffoli()
    
    print("\n" + "="*70)
    if all_passed:
        print("ALL TESTS PASSED! ✓")
    else:
        print("SOME TESTS FAILED! ✗")
    print("="*70)
