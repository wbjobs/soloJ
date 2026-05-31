import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.pointcloud_service import list_pointclouds, get_pointcloud_info, compute_selection_stats
from app.schemas import BoundingBox

print('=== Testing Point Cloud Service ===')
print()
print('Available point clouds:')
pcs = list_pointclouds()
for pc in pcs:
    print(f'  - {pc["name"]}: {pc["point_count"]} points')
print()

if pcs:
    name = pcs[0]['name']
    print(f'Testing stats for: {name}')
    info = get_pointcloud_info(name)
    print(f'  Bounds: {info["bounds"]}')
    
    bounds = BoundingBox(
        min_x=info['bounds']['min_x'],
        max_x=info['bounds']['max_x'],
        min_y=info['bounds']['min_y'],
        max_y=info['bounds']['max_y'],
        min_z=info['bounds']['min_z'],
        max_z=info['bounds']['max_z'],
    )
    stats = compute_selection_stats(name, bounds)
    print(f'  Stats: {stats}')
    print()
    print('All tests passed!')
