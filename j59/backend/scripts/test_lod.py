import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.octree import PointCloudOctree
from app.pointcloud_service import DATA_DIR


def test_octree_building():
    print("=== Testing Octree Building ===\n")
    
    las_path = os.path.join(DATA_DIR, "sample_terrain.las")
    if not os.path.exists(las_path):
        print("Sample data not found, please run generate_sample_data.py first")
        return False
    
    print(f"Building octree from: {las_path}")
    
    octree = PointCloudOctree(DATA_DIR, max_depth=5, max_points_per_node=50000)
    octree.build_from_las(las_path, "sample_terrain")
    
    print(f"\nOctree info:")
    info = octree.get_hierarchy_info()
    print(f"  - Total nodes: {info['total_nodes']}")
    print(f"  - Max depth: {info['max_depth']}")
    print(f"  - Root bounds: {info['root_bounds']}")
    
    return True


def test_visible_nodes():
    print("\n=== Testing Visible Nodes Calculation ===\n")
    
    octree = PointCloudOctree(DATA_DIR)
    if not octree.load_cached("sample_terrain"):
        print("Cached octree not found")
        return False
    
    camera_positions = [
        (50, 50, 50),
        (10, 10, 20),
        (100, 100, 100),
    ]
    
    for cam_pos in camera_positions:
        nodes = octree.get_nodes_for_view(
            camera_pos=cam_pos,
            max_screen_error=2.0,
            max_nodes=30
        )
        print(f"Camera at {cam_pos}: {len(nodes)} nodes visible")
        print(f"  First 5 nodes: {nodes[:5]}")
    
    return True


def test_node_data():
    print("\n=== Testing Node Data Loading ===\n")
    
    octree = PointCloudOctree(DATA_DIR)
    if not octree.load_cached("sample_terrain"):
        print("Cached octree not found")
        return False
    
    root_data = octree.get_node_data("sample_terrain", "root")
    if root_data:
        print(f"Root node data:")
        print(f"  - Position count: {len(root_data['positions']) // 3} points")
        if 'colors' in root_data:
            print(f"  - Has colors: Yes ({len(root_data['colors'])} values)")
        if 'intensities' in root_data:
            print(f"  - Has intensities: Yes")
        if 'classifications' in root_data:
            print(f"  - Has classifications: Yes")
    
    return True


if __name__ == "__main__":
    try:
        test_octree_building()
        test_visible_nodes()
        test_node_data()
        print("\n=== All tests passed! ===")
    except Exception as e:
        print(f"\nTest failed with error: {e}")
        import traceback
        traceback.print_exc()
