import requests

def test_consistency():
    print("Testing result consistency (same seed, multiple runs)...")
    print("=" * 60)
    
    results = []
    seed = 42
    for i in range(5):
        try:
            response = requests.post(
                "http://localhost:5000/compute_with_seed",
                json={"seed": seed},
                timeout=120
            )
            if response.status_code == 200:
                result = response.json()
                results.append(result["total_potential"])
                print(f"Run {i+1}: {result['total_potential']:.10f}")
            else:
                print(f"Run {i+1}: Failed with status {response.status_code}")
        except Exception as e:
            print(f"Run {i+1}: Error - {e}")
    
    if results:
        print(f"\nResults: {[f'{r:.10f}' for r in results]}")
        unique = set(round(r, 10) for r in results)
        if len(unique) == 1:
            print("✓ All results are consistent (same value)!")
        else:
            print(f"✗ Results vary: {len(unique)} unique values")
            print(f"  Min: {min(results):.10f}")
            print(f"  Max: {max(results):.10f}")
            print(f"  Diff: {max(results) - min(results):.10e}")

if __name__ == "__main__":
    test_consistency()
