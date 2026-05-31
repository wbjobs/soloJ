"""Test the fixed gate implementation."""

import numpy as np


def apply_two_qubit_gate_new(state, gate, control, target, num_qubits):
    """New implementation."""
    state = state.reshape([2] * num_qubits)
    gate = gate.reshape([2, 2, 2, 2])
    
    state = np.tensordot(gate, state, axes=([2, 3], [control, target]))
    
    remaining = iter(range(2, num_qubits + 2))
    new_axes = []
    for i in range(num_qubits):
        if i == control:
            new_axes.append(0)
        elif i == target:
            new_axes.append(1)
        else:
            new_axes.append(next(remaining))
    
    state = np.transpose(state, new_axes)
    
    return state.flatten()


def apply_two_qubit_gate_old(state, gate, control, target, num_qubits):
    """Original implementation."""
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


def apply_three_qubit_gate_new(state, gate, control1, control2, target, num_qubits):
    """New implementation."""
    state = state.reshape([2] * num_qubits)
    gate = gate.reshape([2, 2, 2, 2, 2, 2])
    
    state = np.tensordot(gate, state, axes=([3, 4, 5], [control1, control2, target]))
    
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
    
    state = np.transpose(state, new_axes)
    
    return state.flatten()


def apply_three_qubit_gate_old(state, gate, control1, control2, target, num_qubits):
    """Original implementation."""
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


def X():
    return np.array([[0, 1], [1, 0]], dtype=np.complex128)


def apply_single_qubit_gate(state, gate, qubit, num_qubits):
    state = state.reshape([2] * num_qubits)
    gate = gate.reshape([2, 2])
    state = np.tensordot(gate, state, axes=([1], [qubit]))
    state = np.moveaxis(state, 0, qubit)
    return state.flatten()


def print_state(state, num_qubits, label=""):
    if label:
        print(f"\n{label}")
    for i in range(2**num_qubits):
        if abs(state[i]) > 1e-10:
            bits = format(i, f'0{num_qubits}b')
            print(f"  |{bits}> : {state[i]:.4f}")


def test_cnot_all_positions():
    """Test CNOT in all possible positions."""
    print("="*70)
    print("Testing CNOT for ALL control/target combinations")
    print("="*70)
    
    num_qubits = 5
    all_passed = True
    
    for control in range(num_qubits):
        for target in range(num_qubits):
            if control == target:
                continue
            
            # Create state with control qubit = 1
            state = np.zeros(2**num_qubits, dtype=np.complex128)
            state[0] = 1.0
            state = apply_single_qubit_gate(state, X(), control, num_qubits)
            
            # Get initial bitstring
            initial_bits = None
            for i in range(2**num_qubits):
                if abs(state[i]) > 1e-10:
                    initial_bits = format(i, f'0{num_qubits}b')
                    break
            
            if initial_bits is None:
                print(f"ERROR: No state found for CNOT({control},{target})")
                all_passed = False
                continue
            
            # Apply CNOT
            state_new = apply_two_qubit_gate_new(state.copy(), CNOT(), control, target, num_qubits)
            state_old = apply_two_qubit_gate_old(state.copy(), CNOT(), control, target, num_qubits)
            
            # Get final bitstrings
            final_bits_new = None
            for i in range(2**num_qubits):
                if abs(state_new[i]) > 1e-10:
                    final_bits_new = format(i, f'0{num_qubits}b')
            
            final_bits_old = None
            for i in range(2**num_qubits):
                if abs(state_old[i]) > 1e-10:
                    final_bits_old = format(i, f'0{num_qubits}b')
            
            # Expected: flip target bit
            expected_bits = list(initial_bits)
            expected_bits[target] = '1' if expected_bits[target] == '0' else '0'
            expected_bits = ''.join(expected_bits)
            
            # Check both implementations
            match_new = final_bits_new == expected_bits
            match_old = final_bits_old == expected_bits
            match_both = np.allclose(state_new, state_old)
            
            if match_new and match_old and match_both:
                status = "✓"
            else:
                status = "✗"
                all_passed = False
            
            print(f"CNOT({control},{target}): |{initial_bits}> → |{final_bits_new}> (expected |{expected_bits}>) {status}")
    
    print("\n" + "="*70)
    if all_passed:
        print("ALL CNOT TESTS PASSED! ✓")
    else:
        print("SOME CNOT TESTS FAILED! ✗")
    print("="*70)
    
    return all_passed


def test_toffoli_all_positions():
    """Test Toffoli in various positions."""
    print("\n" + "="*70)
    print("Testing Toffoli gate")
    print("="*70)
    
    num_qubits = 5
    all_passed = True
    
    test_cases = [
        (0, 1, 2),
        (0, 2, 4),
        (1, 2, 3),
        (0, 3, 4),
    ]
    
    for c1, c2, t in test_cases:
        # Create state with both controls = 1
        state = np.zeros(2**num_qubits, dtype=np.complex128)
        state[0] = 1.0
        state = apply_single_qubit_gate(state, X(), c1, num_qubits)
        state = apply_single_qubit_gate(state, X(), c2, num_qubits)
        
        initial_bits = None
        for i in range(2**num_qubits):
            if abs(state[i]) > 1e-10:
                initial_bits = format(i, f'0{num_qubits}b')
        
        state_new = apply_three_qubit_gate_new(state.copy(), Toffoli(), c1, c2, t, num_qubits)
        state_old = apply_three_qubit_gate_old(state.copy(), Toffoli(), c1, c2, t, num_qubits)
        
        final_bits_new = None
        for i in range(2**num_qubits):
            if abs(state_new[i]) > 1e-10:
                final_bits_new = format(i, f'0{num_qubits}b')
        
        final_bits_old = None
        for i in range(2**num_qubits):
            if abs(state_old[i]) > 1e-10:
                final_bits_old = format(i, f'0{num_qubits}b')
        
        expected_bits = list(initial_bits)
        expected_bits[t] = '1' if expected_bits[t] == '0' else '0'
        expected_bits = ''.join(expected_bits)
        
        match = final_bits_new == expected_bits and final_bits_old == expected_bits
        match_both = np.allclose(state_new, state_old)
        
        if match and match_both:
            status = "✓"
        else:
            status = "✗"
            all_passed = False
        
        print(f"Toffoli({c1},{c2},{t}): |{initial_bits}> → |{final_bits_new}> (expected |{expected_bits}>) {status}")
    
    if all_passed:
        print("\nALL TOFFOLI TESTS PASSED! ✓")
    else:
        print("\nSOME TOFFOLI TESTS FAILED! ✗")
    
    return all_passed


if __name__ == "__main__":
    cnot_passed = test_cnot_all_positions()
    toffoli_passed = test_toffoli_all_positions()
    
    if cnot_passed and toffoli_passed:
        print("\n" + "="*70)
        print("ALL TESTS PASSED! ✓")
        print("="*70)
    else:
        print("\n" + "="*70)
        print("SOME TESTS FAILED! ✗")
        print("="*70)
