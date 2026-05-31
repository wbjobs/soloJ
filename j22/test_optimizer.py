"""Test the quantum circuit optimization module."""

import sys
sys.path.insert(0, '.')

from app.optimization.circuit_optimizer import CircuitOptimizer, GateInfo


def test_hh_cancellation():
    """Test cancellation of adjacent H gates."""
    print("="*70)
    print("Test 1: H-H Cancellation")
    print("="*70)
    
    num_qubits = 3
    gates = [
        GateInfo("H", [0]),
        GateInfo("H", [0]),  # Should cancel with first H
        GateInfo("X", [1]),
    ]
    
    optimizer = CircuitOptimizer(num_qubits)
    result = optimizer.optimize(gates, measure_execution_time=True)
    
    print(f"Original gates: {len(gates)}")
    print(f"Optimized gates: {len(result.optimized_gates)}")
    print(f"Gates removed: {result.gates_removed}")
    print(f"Optimization ratio: {result.optimization_ratio:.2%}")
    
    print("\nOptimizations applied:")
    for opt in result.optimizations_applied:
        print(f"  - {opt['description']}")
    
    assert len(result.optimized_gates) == 1, "Should have only X gate left"
    assert result.optimized_gates[0].gate_type == "X"
    assert result.optimizations_applied[0]["type"] == "gate_cancellation"
    print("\n✓ H-H cancellation test passed!")


def test_xx_cancellation():
    """Test cancellation of adjacent X gates."""
    print("\n" + "="*70)
    print("Test 2: X-X Cancellation")
    print("="*70)
    
    num_qubits = 3
    gates = [
        GateInfo("X", [0]),
        GateInfo("H", [1]),
        GateInfo("X", [0]),  # Should NOT cancel (not adjacent)
        GateInfo("Y", [2]),
        GateInfo("Y", [2]),  # Should cancel
    ]
    
    optimizer = CircuitOptimizer(num_qubits)
    result = optimizer.optimize(gates)
    
    print(f"Original gates: {len(gates)}")
    print(f"Optimized gates: {len(result.optimized_gates)}")
    print(f"Gates removed: {result.gates_removed}")
    
    print("\nOptimizations applied:")
    for opt in result.optimizations_applied:
        print(f"  - {opt['description']}")
    
    assert len(result.optimized_gates) == 3, "Should have 3 gates left"
    assert len(result.optimizations_applied) == 1, "Should have only Y-Y cancellation"
    print("\n✓ X-X cancellation test passed!")


def test_swap_detection():
    """Test detection of Swap gate (3 CNOTs)."""
    print("\n" + "="*70)
    print("Test 3: Swap Gate Detection")
    print("="*70)
    
    num_qubits = 3
    # Swap implemented as 3 CNOTs: CNOT(a,b) -> CNOT(b,a) -> CNOT(a,b)
    gates = [
        GateInfo("H", [0]),
        GateInfo("CNOT", [0, 1]),  # Start of swap
        GateInfo("CNOT", [1, 0]),
        GateInfo("CNOT", [0, 1]),  # End of swap
        GateInfo("X", [2]),
    ]
    
    optimizer = CircuitOptimizer(num_qubits)
    result = optimizer.optimize(gates)
    
    print(f"Original gates: {len(gates)}")
    print(f"Optimized gates: {len(result.optimized_gates)}")
    print(f"Gates removed: {result.gates_removed}")
    
    print("\nOptimizations applied:")
    for opt in result.optimizations_applied:
        print(f"  - {opt['description']}")
    
    assert len(result.optimized_gates) == 2, "Should have H and X gates left"
    assert len(result.optimizations_applied) == 1, "Should have swap detection"
    assert result.optimizations_applied[0]["type"] == "swap_detection"
    print("\n✓ Swap detection test passed!")


def test_multiple_optimizations():
    """Test multiple optimization passes."""
    print("\n" + "="*70)
    print("Test 4: Multiple Optimizations")
    print("="*70)
    
    num_qubits = 4
    gates = [
        GateInfo("H", [0]),
        GateInfo("H", [0]),  # Cancel
        GateInfo("X", [1]),
        GateInfo("X", [1]),  # Cancel
        GateInfo("CNOT", [2, 3]),  # Swap start
        GateInfo("CNOT", [3, 2]),
        GateInfo("CNOT", [2, 3]),  # Swap end
        GateInfo("Z", [0]),
        GateInfo("Z", [0]),  # Cancel
    ]
    
    optimizer = CircuitOptimizer(num_qubits)
    result = optimizer.optimize(gates, measure_execution_time=True)
    
    print(f"Original gates: {len(gates)}")
    print(f"Optimized gates: {len(result.optimized_gates)}")
    print(f"Gates removed: {result.gates_removed}")
    print(f"Optimization ratio: {result.optimization_ratio:.2%}")
    print(f"Estimated original time: {result.original_execution_time_ms:.4f} ms")
    print(f"Estimated optimized time: {result.optimized_execution_time_ms:.4f} ms")
    if result.speedup_factor:
        print(f"Speedup factor: {result.speedup_factor:.2f}x")
    
    print("\nOptimizations applied:")
    for opt in result.optimizations_applied:
        print(f"  - {opt['description']}")
    
    assert len(result.optimized_gates) == 0, "All gates should be optimized away"
    assert result.gates_removed == 9
    print("\n✓ Multiple optimizations test passed!")


def test_no_optimization_possible():
    """Test when no optimizations can be applied."""
    print("\n" + "="*70)
    print("Test 5: No Optimization Possible")
    print("="*70)
    
    num_qubits = 3
    gates = [
        GateInfo("H", [0]),
        GateInfo("X", [1]),
        GateInfo("CNOT", [0, 1]),
        GateInfo("Y", [2]),
    ]
    
    optimizer = CircuitOptimizer(num_qubits)
    result = optimizer.optimize(gates)
    
    print(f"Original gates: {len(gates)}")
    print(f"Optimized gates: {len(result.optimized_gates)}")
    print(f"Gates removed: {result.gates_removed}")
    print(f"Optimizations applied: {len(result.optimizations_applied)}")
    
    assert len(result.optimized_gates) == len(gates)
    assert len(result.optimizations_applied) == 0
    print("\n✓ No optimization test passed!")


def test_empty_circuit():
    """Test optimization of empty circuit."""
    print("\n" + "="*70)
    print("Test 6: Empty Circuit")
    print("="*70)
    
    num_qubits = 3
    gates = []
    
    optimizer = CircuitOptimizer(num_qubits)
    result = optimizer.optimize(gates)
    
    print(f"Original gates: {len(gates)}")
    print(f"Optimized gates: {len(result.optimized_gates)}")
    
    assert len(result.optimized_gates) == 0
    assert result.gates_removed == 0
    assert result.optimization_ratio == 0.0
    print("\n✓ Empty circuit test passed!")


def test_single_gate():
    """Test optimization of single gate."""
    print("\n" + "="*70)
    print("Test 7: Single Gate")
    print("="*70)
    
    num_qubits = 1
    gates = [
        GateInfo("H", [0]),
    ]
    
    optimizer = CircuitOptimizer(num_qubits)
    result = optimizer.optimize(gates)
    
    print(f"Original gates: {len(gates)}")
    print(f"Optimized gates: {len(result.optimized_gates)}")
    
    assert len(result.optimized_gates) == 1
    assert result.gates_removed == 0
    print("\n✓ Single gate test passed!")


if __name__ == "__main__":
    print("Testing Quantum Circuit Optimizer\n")
    
    all_passed = True
    
    try:
        test_hh_cancellation()
    except Exception as e:
        print(f"\n✗ H-H cancellation test failed: {e}")
        all_passed = False
    
    try:
        test_xx_cancellation()
    except Exception as e:
        print(f"\n✗ X-X cancellation test failed: {e}")
        all_passed = False
    
    try:
        test_swap_detection()
    except Exception as e:
        print(f"\n✗ Swap detection test failed: {e}")
        all_passed = False
    
    try:
        test_multiple_optimizations()
    except Exception as e:
        print(f"\n✗ Multiple optimizations test failed: {e}")
        all_passed = False
    
    try:
        test_no_optimization_possible()
    except Exception as e:
        print(f"\n✗ No optimization test failed: {e}")
        all_passed = False
    
    try:
        test_empty_circuit()
    except Exception as e:
        print(f"\n✗ Empty circuit test failed: {e}")
        all_passed = False
    
    try:
        test_single_gate()
    except Exception as e:
        print(f"\n✗ Single gate test failed: {e}")
        all_passed = False
    
    print("\n" + "="*70)
    if all_passed:
        print("ALL TESTS PASSED! ✓")
    else:
        print("SOME TESTS FAILED! ✗")
    print("="*70)
