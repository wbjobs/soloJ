import os
import sys
import numpy as np
import laspy

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from app.pointcloud_service import DATA_DIR


def generate_terrain_sample(output_path: str, num_points: int = 200000):
    """生成地形类示例点云"""
    header = laspy.LasHeader(point_format=7, version="1.4")
    header.offsets = np.array([0.0, 0.0, 0.0])
    header.scales = np.array([0.001, 0.001, 0.001])
    
    las = laspy.LasData(header)
    
    x = np.random.uniform(0, 100, num_points)
    y = np.random.uniform(0, 100, num_points)
    
    z = (
        5 * np.sin(x * 0.1) * np.cos(y * 0.1) +
        2 * np.sin(x * 0.05 + y * 0.05) +
        np.random.normal(0, 0.3, num_points)
    )
    
    mask_building1 = (x > 30) & (x < 45) & (y > 30) & (y < 45)
    mask_building2 = (x > 60) & (x < 75) & (y > 55) & (y < 70)
    
    z[mask_building1] += np.random.uniform(10, 15, np.sum(mask_building1))
    z[mask_building2] += np.random.uniform(8, 12, np.sum(mask_building2))
    
    las.x = x.astype(np.float64)
    las.y = y.astype(np.float64)
    las.z = z.astype(np.float64)
    
    red = np.zeros(num_points, dtype=np.uint16)
    green = np.zeros(num_points, dtype=np.uint16)
    blue = np.zeros(num_points, dtype=np.uint16)
    
    z_norm = (z - z.min()) / (z.max() - z.min())
    
    vegetation_mask = (~mask_building1) & (~mask_building2) & (z_norm > 0.3)
    ground_mask = (~mask_building1) & (~mask_building2) & (z_norm <= 0.3)
    
    red[vegetation_mask] = np.random.randint(0, 80, np.sum(vegetation_mask)).astype(np.uint16)
    green[vegetation_mask] = np.random.randint(120, 255, np.sum(vegetation_mask)).astype(np.uint16)
    blue[vegetation_mask] = np.random.randint(0, 100, np.sum(vegetation_mask)).astype(np.uint16)
    
    red[ground_mask] = np.random.randint(100, 180, np.sum(ground_mask)).astype(np.uint16)
    green[ground_mask] = np.random.randint(80, 140, np.sum(ground_mask)).astype(np.uint16)
    blue[ground_mask] = np.random.randint(50, 100, np.sum(ground_mask)).astype(np.uint16)
    
    red[mask_building1] = np.random.randint(180, 255, np.sum(mask_building1)).astype(np.uint16)
    green[mask_building1] = np.random.randint(100, 150, np.sum(mask_building1)).astype(np.uint16)
    blue[mask_building1] = np.random.randint(80, 120, np.sum(mask_building1)).astype(np.uint16)
    
    red[mask_building2] = np.random.randint(150, 220, np.sum(mask_building2)).astype(np.uint16)
    green[mask_building2] = np.random.randint(150, 220, np.sum(mask_building2)).astype(np.uint16)
    blue[mask_building2] = np.random.randint(180, 255, np.sum(mask_building2)).astype(np.uint16)
    
    las.red = (red * 257).astype(np.uint16)
    las.green = (green * 257).astype(np.uint16)
    las.blue = (blue * 257).astype(np.uint16)
    
    intensity = (z_norm * 65535).astype(np.uint16)
    las.intensity = intensity
    
    classification = np.zeros(num_points, dtype=np.uint8)
    classification[ground_mask] = 2
    classification[vegetation_mask] = 5
    classification[mask_building1] = 6
    classification[mask_building2] = 6
    las.classification = classification
    
    las.write(output_path)
    print(f"Generated terrain sample: {output_path} with {num_points} points")


def generate_sphere_sample(output_path: str, num_points: int = 150000):
    """生成球体类示例点云"""
    header = laspy.LasHeader(point_format=7, version="1.4")
    header.offsets = np.array([0.0, 0.0, 0.0])
    header.scales = np.array([0.001, 0.001, 0.001])
    
    las = laspy.LasData(header)
    
    phi = np.random.uniform(0, 2 * np.pi, num_points)
    theta = np.random.uniform(0, np.pi, num_points)
    r = np.random.normal(20, 2, num_points)
    
    x = r * np.sin(theta) * np.cos(phi)
    y = r * np.sin(theta) * np.sin(phi)
    z = r * np.cos(theta)
    
    las.x = x.astype(np.float64)
    las.y = y.astype(np.float64)
    las.z = z.astype(np.float64)
    
    r_norm = (r - r.min()) / (r.max() - r.min())
    las.red = (r_norm * 65535).astype(np.uint16)
    las.green = ((1 - r_norm) * 65535).astype(np.uint16)
    las.blue = (np.ones(num_points) * 32767).astype(np.uint16)
    
    las.intensity = (r_norm * 65535).astype(np.uint16)
    
    las.write(output_path)
    print(f"Generated sphere sample: {output_path} with {num_points} points")


if __name__ == "__main__":
    os.makedirs(DATA_DIR, exist_ok=True)
    
    generate_terrain_sample(os.path.join(DATA_DIR, "sample_terrain.las"), 200000)
    generate_sphere_sample(os.path.join(DATA_DIR, "sample_sphere.las"), 150000)
    
    print("\nSample data generation complete!")
    print(f"Data directory: {DATA_DIR}")
