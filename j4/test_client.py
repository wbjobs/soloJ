import requests
import time

def test_compute():
    print("Testing distributed potential computation...")
    print("=" * 50)
    
    try:
        response = requests.get("http://localhost:5000/compute", timeout=60)
        if response.status_code == 200:
            result = response.json()
            print("✓ Computation successful!")
            print(f"  Total Potential: {result['total_potential']:.6f}")
            print(f"  Number of Particles: {result['num_particles']}")
            print(f"  Number of Pairs: {result['num_pairs']}")
            print(f"  Elapsed Time: {result['elapsed_time_seconds']:.3f} seconds")
            return True
        else:
            print(f"✗ Request failed with status code: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"✗ Error connecting to server: {e}")
        return False

if __name__ == "__main__":
    test_compute()
