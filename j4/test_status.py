import requests
import json

try:
    r = requests.get('http://localhost:5000/api/status', timeout=5)
    print("Status code:", r.status_code)
    data = r.json()
    print("Registered workers:", data['registered_count'])
    print("Workers:")
    for w in data['workers']:
        print(f"  {w['worker_id']}: {w['state']}, speed_score={round(w['speed_score'], 2)}")
except Exception as e:
    print(f"Error: {e}")
