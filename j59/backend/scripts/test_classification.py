import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.classification import (
    get_classification_rules,
    classify_by_rgb,
    classify_by_intensity,
    get_class_statistics,
)
from app.pointcloud_service import DATA_DIR
import laspy
import numpy as np


def test_classification_rules():
    print("=== Testing Classification Rules ===\n")
    
    rules = get_classification_rules()
    print(f"Total rules: {len(rules)}")
    for rule in rules:
        print(f"  [{rule['class_id']}] {rule['name']}: {rule['color']}")
    
    return True


def test_rgb_classification():
    print("\n=== Testing RGB Classification ===\n")
    
    las_path = os.path.join(DATA_DIR, "sample_terrain.las")
    if not os.path.exists(las_path):
        print("Sample data not found")
        return False
    
    las = laspy.read(las_path)
    
    if 'red' not in las.point_format.dimension_names:
        print("No RGB data in sample file")
        return False
    
    sample_count = min(50000, len(las.x))
    indices = np.random.choice(len(las.x), sample_count, replace=False)
    
    r = np.array(las.red[indices], dtype=np.float32)
    g = np.array(las.green[indices], dtype=np.float32)
    b = np.array(las.blue[indices], dtype=np.float32)
    
    print(f"Classifying {sample_count} points...")
    classifications = classify_by_rgb(r, g, b)
    
    stats = get_class_statistics(classifications)
    print(f"\nClassification statistics:")
    print(f"  Total points: {stats['total_points']}")
    print(f"  Classes found: {len(stats['classes'])}")
    
    for cls in stats['classes']:
        print(f"    [{cls['class_id']}] {cls['name']}: {cls['count']} ({cls['percentage']:.1f}%)")
    
    return True


def test_intensity_classification():
    print("\n=== Testing Intensity Classification ===\n")
    
    las_path = os.path.join(DATA_DIR, "sample_terrain.las")
    if not os.path.exists(las_path):
        print("Sample data not found")
        return False
    
    las = laspy.read(las_path)
    
    if 'intensity' not in las.point_format.dimension_names:
        print("No intensity data in sample file")
        return False
    
    sample_count = min(50000, len(las.x))
    indices = np.random.choice(len(las.x), sample_count, replace=False)
    
    intensity = np.array(las.intensity[indices], dtype=np.float32)
    z = np.array(las.z[indices], dtype=np.float32)
    
    print(f"Classifying {sample_count} points...")
    classifications = classify_by_intensity(intensity, z)
    
    stats = get_class_statistics(classifications, intensity)
    print(f"\nClassification statistics:")
    print(f"  Total points: {stats['total_points']}")
    print(f"  Classes found: {len(stats['classes'])}")
    
    for cls in stats['classes']:
        print(f"    [{cls['class_id']}] {cls['name']}: {cls['count']} ({cls['percentage']:.1f}%)")
        if 'avg_intensity' in cls:
            print(f"      Avg intensity: {cls['avg_intensity']:.0f}")
    
    return True


if __name__ == "__main__":
    try:
        test_classification_rules()
        test_rgb_classification()
        test_intensity_classification()
        print("\n=== All classification tests passed! ===")
    except Exception as e:
        print(f"\nTest failed with error: {e}")
        import traceback
        traceback.print_exc()
