import requests
import json

def test_dynamic_allocation(num_runs=3):
    print("Testing dynamic task allocation...")
    print("=" * 70)
    print(f"Worker speeds: worker_0=1.0x (normal), worker_1=3.0x (slow), worker_2=0.5x (fast), worker_3=0.3x (very fast)")
    print("=" * 70)
    
    for run in range(num_runs):
        print(f"\n{'='*70}")
        print(f"Run #{run + 1}")
        print("=" * 70)
        
        response = requests.post(
            "http://localhost:5000/compute_with_seed",
            json={"seed": 42},
            timeout=120
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✓ Computation successful!")
            print(f"  Total Potential: {result['total_potential']:.6f}")
            print(f"  Elapsed Time: {result['elapsed_time_seconds']:.3f} seconds")
        
        status = requests.get("http://localhost:5000/api/status").json()
        print(f"\nWorker performance after run #{run + 1}:")
        for worker in status["workers"]:
            avg_time = worker["avg_time_per_pair"]
            avg_time_str = f"{(avg_time * 1000):.3f}ms" if avg_time else "N/A"
            speed_score = worker["speed_score"]
            total = worker["total_pairs_processed"]
            print(f"  {worker['worker_id']:10} | state={worker['state']:5} | speed={speed_score:6.2f} | avg/pair={avg_time_str:12} | total={total:5}")

if __name__ == "__main__":
    test_dynamic_allocation(3)
