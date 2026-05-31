import os
import numpy as np
import laspy
from typing import Tuple, Optional, Dict, Any
from .schemas import BoundingBox


DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_pointcloud_path(name: str) -> str:
    """获取点云文件路径"""
    for ext in ['.las', '.laz']:
        path = os.path.join(DATA_DIR, name + ext)
        if os.path.exists(path):
            return path
    return os.path.join(DATA_DIR, name + '.las')


def load_pointcloud(name: str) -> Optional[laspy.LasData]:
    """加载 LAS/LAZ 点云文件"""
    path = get_pointcloud_path(name)
    if not os.path.exists(path):
        return None
    return laspy.read(path)


def get_pointcloud_info(name: str) -> Optional[Dict[str, Any]]:
    """获取点云基本信息"""
    las = load_pointcloud(name)
    if las is None:
        return None
    
    x, y, z = las.x, las.y, las.z
    has_color = 'red' in las.point_format.dimension_names
    
    return {
        "name": name,
        "point_count": len(x),
        "bounds": {
            "min_x": float(np.min(x)),
            "max_x": float(np.max(x)),
            "min_y": float(np.min(y)),
            "max_y": float(np.max(y)),
            "min_z": float(np.min(z)),
            "max_z": float(np.max(z)),
        },
        "has_color": has_color,
    }


def list_pointclouds() -> list:
    """列出所有可用的点云文件"""
    pointclouds = []
    for filename in os.listdir(DATA_DIR):
        if filename.endswith('.las') or filename.endswith('.laz'):
            name = os.path.splitext(filename)[0]
            info = get_pointcloud_info(name)
            if info:
                pointclouds.append(info)
    return pointclouds


def get_pointcloud_tile(
    name: str,
    bounds: Optional[BoundingBox] = None,
    max_points: int = 500000,
    lod: int = 0
) -> Optional[Dict[str, Any]]:
    """
    获取点云切片数据
    
    Args:
        name: 点云名称
        bounds: 空间范围（可选）
        max_points: 最大返回点数
        lod: 细节层次 (0=最高, 1=1/2, 2=1/4, ...)
    
    Returns:
        包含位置、颜色等信息的字典
    """
    las = load_pointcloud(name)
    if las is None:
        return None
    
    x = np.array(las.x, dtype=np.float32)
    y = np.array(las.y, dtype=np.float32)
    z = np.array(las.z, dtype=np.float32)
    
    step = max(1, 2 ** lod)
    
    if bounds is not None:
        mask = (
            (x >= bounds.min_x) & (x <= bounds.max_x) &
            (y >= bounds.min_y) & (y <= bounds.max_y) &
            (z >= bounds.min_z) & (z <= bounds.max_z)
        )
        indices = np.where(mask)[0]
    else:
        indices = np.arange(len(x))
    
    if len(indices) > max_points:
        stride = max(1, len(indices) // max_points)
        indices = indices[::stride]
    
    indices = indices[::step]
    
    positions = np.column_stack([x[indices], y[indices], z[indices]])
    
    colors = None
    if 'red' in las.point_format.dimension_names:
        r = np.array(las.red[indices], dtype=np.float32) / 65535.0
        g = np.array(las.green[indices], dtype=np.float32) / 65535.0
        b = np.array(las.blue[indices], dtype=np.float32) / 65535.0
        colors = np.column_stack([r, g, b])
    
    intensities = None
    if 'intensity' in las.point_format.dimension_names:
        intensities = np.array(las.intensity[indices], dtype=np.float32)
    
    classifications = None
    if 'classification' in las.point_format.dimension_names:
        classifications = np.array(las.classification[indices], dtype=np.uint8)
    
    offsets = {
        "x": float(np.mean(x)),
        "y": float(np.mean(y)),
        "z": float(np.mean(z)),
    }
    
    positions_centered = positions - np.array([offsets["x"], offsets["y"], offsets["z"]])
    
    result = {
        "name": name,
        "positions": positions_centered.flatten().tolist(),
        "original_positions": positions.flatten().tolist(),
        "offsets": offsets,
        "point_count": len(indices),
        "bounds": {
            "min_x": float(np.min(x[indices])),
            "max_x": float(np.max(x[indices])),
            "min_y": float(np.min(y[indices])),
            "max_y": float(np.max(y[indices])),
            "min_z": float(np.min(z[indices])),
            "max_z": float(np.max(z[indices])),
        },
    }
    
    if colors is not None:
        result["colors"] = colors.flatten().tolist()
    if intensities is not None:
        result["intensities"] = intensities.tolist()
    if classifications is not None:
        result["classifications"] = classifications.tolist()
    
    return result


def compute_selection_stats(
    name: str,
    bounds: BoundingBox
) -> Optional[Dict[str, Any]]:
    """
    计算选定点云区域的统计信息
    
    Args:
        name: 点云名称
        bounds: 选定区域的包围盒
    
    Returns:
        包含点数量、平均高度、体积等统计信息
    """
    las = load_pointcloud(name)
    if las is None:
        return None
    
    x = np.array(las.x, dtype=np.float64)
    y = np.array(las.y, dtype=np.float64)
    z = np.array(las.z, dtype=np.float64)
    
    mask = (
        (x >= bounds.min_x) & (x <= bounds.max_x) &
        (y >= bounds.min_y) & (y <= bounds.max_y) &
        (z >= bounds.min_z) & (z <= bounds.max_z)
    )
    
    selected_z = z[mask]
    point_count = int(np.sum(mask))
    
    if point_count == 0:
        return {
            "point_count": 0,
            "average_height": 0.0,
            "volume": 0.0,
            "min_height": 0.0,
            "max_height": 0.0,
            "height_std": 0.0,
        }
    
    volume = (
        (bounds.max_x - bounds.min_x) *
        (bounds.max_y - bounds.min_y) *
        (bounds.max_z - bounds.min_z)
    )
    
    return {
        "point_count": point_count,
        "average_height": float(np.mean(selected_z)),
        "volume": float(volume),
        "min_height": float(np.min(selected_z)),
        "max_height": float(np.max(selected_z)),
        "height_std": float(np.std(selected_z)),
        "height_median": float(np.median(selected_z)),
    }
