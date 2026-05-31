import os
import json
import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
import laspy


@dataclass
class OctreeNode:
    id: str
    level: int
    min_x: float
    max_x: float
    min_y: float
    max_y: float
    min_z: float
    max_z: float
    point_count: int
    children: List[str]
    is_leaf: bool
    
    def size(self) -> float:
        return max(self.max_x - self.min_x, 
                   self.max_y - self.min_y, 
                   self.max_z - self.min_z)
    
    def center(self) -> Tuple[float, float, float]:
        return (
            (self.min_x + self.max_x) / 2,
            (self.min_y + self.max_y) / 2,
            (self.min_z + self.max_z) / 2,
        )


class PointCloudOctree:
    def __init__(self, data_dir: str, max_depth: int = 5, max_points_per_node: int = 50000):
        self.data_dir = data_dir
        self.max_depth = max_depth
        self.max_points_per_node = max_points_per_node
        self.nodes: Dict[str, OctreeNode] = {}
        self.root_id: Optional[str] = None
        self.point_cloud_name: Optional[str] = None
        
    def get_cache_path(self, name: str) -> str:
        return os.path.join(self.data_dir, f"{name}_octree.json")
    
    def get_node_data_path(self, name: str, node_id: str) -> str:
        return os.path.join(self.data_dir, f"{name}_nodes", f"{node_id}.npy")
    
    def load_cached(self, name: str) -> bool:
        cache_path = self.get_cache_path(name)
        if not os.path.exists(cache_path):
            return False
        
        try:
            with open(cache_path, 'r') as f:
                data = json.load(f)
            
            self.point_cloud_name = name
            self.root_id = data['root_id']
            self.nodes = {
                nid: OctreeNode(**node_data)
                for nid, node_data in data['nodes'].items()
            }
            return True
        except Exception as e:
            print(f"Failed to load octree cache: {e}")
            return False
    
    def save_cached(self, name: str):
        cache_path = self.get_cache_path(name)
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        
        data = {
            'root_id': self.root_id,
            'nodes': {
                nid: asdict(node)
                for nid, node in self.nodes.items()
            }
        }
        
        with open(cache_path, 'w') as f:
            json.dump(data, f, indent=2)
    
    def build_from_las(self, las_path: str, name: str):
        las = laspy.read(las_path)
        x = np.array(las.x, dtype=np.float32)
        y = np.array(las.y, dtype=np.float32)
        z = np.array(las.z, dtype=np.float32)
        
        colors = None
        if 'red' in las.point_format.dimension_names:
            colors = np.column_stack([
                np.array(las.red, dtype=np.float32) / 65535.0,
                np.array(las.green, dtype=np.float32) / 65535.0,
                np.array(las.blue, dtype=np.float32) / 65535.0,
            ])
        
        intensities = None
        if 'intensity' in las.point_format.dimension_names:
            intensities = np.array(las.intensity, dtype=np.float32)
        
        classifications = None
        if 'classification' in las.point_format.dimension_names:
            classifications = np.array(las.classification, dtype=np.uint8)
        
        min_x, max_x = float(x.min()), float(x.max())
        min_y, max_y = float(y.min()), float(y.max())
        min_z, max_z = float(z.min()), float(z.max())
        
        size = max(max_x - min_x, max_y - min_y, max_z - min_z)
        center_x = (min_x + max_x) / 2
        center_y = (min_y + max_y) / 2
        center_z = (min_z + max_z) / 2
        
        min_x = center_x - size / 2
        max_x = center_x + size / 2
        min_y = center_y - size / 2
        max_y = center_y + size / 2
        min_z = center_z - size / 2
        max_z = center_z + size / 2
        
        self.point_cloud_name = name
        indices = np.arange(len(x))
        
        nodes_dir = os.path.join(self.data_dir, f"{name}_nodes")
        os.makedirs(nodes_dir, exist_ok=True)
        
        self._build_recursive(
            "root", 0,
            min_x, max_x, min_y, max_y, min_z, max_z,
            x, y, z, colors, intensities, classifications,
            indices, nodes_dir, name
        )
        
        self.root_id = "root"
        self.save_cached(name)
    
    def _build_recursive(
        self,
        node_id: str, level: int,
        min_x: float, max_x: float,
        min_y: float, max_y: float,
        min_z: float, max_z: float,
        x: np.ndarray, y: np.ndarray, z: np.ndarray,
        colors: Optional[np.ndarray],
        intensities: Optional[np.ndarray],
        classifications: Optional[np.ndarray],
        indices: np.ndarray,
        nodes_dir: str, name: str
    ):
        node_indices = indices[
            (x[indices] >= min_x) & (x[indices] <= max_x) &
            (y[indices] >= min_y) & (y[indices] <= max_y) &
            (z[indices] >= min_z) & (z[indices] <= max_z)
        ]
        
        point_count = len(node_indices)
        is_leaf = (level >= self.max_depth) or (point_count <= self.max_points_per_node)
        
        step = max(1, point_count // self.max_points_per_node) if not is_leaf else 1
        display_indices = node_indices[::step] if point_count > 0 else node_indices
        
        node_data = {
            'positions': np.column_stack([x[display_indices], y[display_indices], z[display_indices]]),
        }
        if colors is not None:
            node_data['colors'] = colors[display_indices]
        if intensities is not None:
            node_data['intensities'] = intensities[display_indices]
        if classifications is not None:
            node_data['classifications'] = classifications[display_indices]
        
        np.savez(os.path.join(nodes_dir, f"{node_id}.npz"), **node_data)
        
        children = []
        if not is_leaf and point_count > self.max_points_per_node:
            mid_x = (min_x + max_x) / 2
            mid_y = (min_y + max_y) / 2
            mid_z = (min_z + max_z) / 2
            
            for i in range(8):
                child_min_x = min_x if (i & 1) == 0 else mid_x
                child_max_x = mid_x if (i & 1) == 0 else max_x
                child_min_y = min_y if (i & 2) == 0 else mid_y
                child_max_y = mid_y if (i & 2) == 0 else max_y
                child_min_z = min_z if (i & 4) == 0 else mid_z
                child_max_z = mid_z if (i & 4) == 0 else max_z
                
                child_id = f"{node_id}_{i}"
                children.append(child_id)
                
                self._build_recursive(
                    child_id, level + 1,
                    child_min_x, child_max_x,
                    child_min_y, child_max_y,
                    child_min_z, child_max_z,
                    x, y, z, colors, intensities, classifications,
                    node_indices, nodes_dir, name
                )
        
        self.nodes[node_id] = OctreeNode(
            id=node_id,
            level=level,
            min_x=min_x, max_x=max_x,
            min_y=min_y, max_y=max_y,
            min_z=min_z, max_z=max_z,
            point_count=point_count,
            children=children,
            is_leaf=is_leaf
        )
    
    def get_node_data(self, name: str, node_id: str) -> Optional[Dict[str, Any]]:
        node_path = self.get_node_data_path(name, node_id)
        node_path = node_path.replace('.npy', '.npz')
        
        if not os.path.exists(node_path):
            return None
        
        try:
            data = np.load(node_path)
            result = {
                'positions': data['positions'].flatten().tolist(),
            }
            if 'colors' in data:
                result['colors'] = data['colors'].flatten().tolist()
            if 'intensities' in data:
                result['intensities'] = data['intensities'].tolist()
            if 'classifications' in data:
                result['classifications'] = data['classifications'].tolist()
            return result
        except Exception as e:
            print(f"Failed to load node data: {e}")
            return None
    
    def get_nodes_for_view(
        self,
        camera_pos: Tuple[float, float, float],
        view_frustum: Optional[Dict] = None,
        max_screen_error: float = 2.0,
        max_nodes: int = 50
    ) -> List[str]:
        if not self.root_id:
            return []
        
        result = []
        stack = [self.root_id]
        
        while stack and len(result) < max_nodes:
            node_id = stack.pop()
            node = self.nodes.get(node_id)
            if not node:
                continue
            
            center = node.center()
            distance = np.sqrt(
                (center[0] - camera_pos[0]) ** 2 +
                (center[1] - camera_pos[1]) ** 2 +
                (center[2] - camera_pos[2]) ** 2
            )
            
            if distance < 1e-6:
                distance = 1e-6
            
            screen_size = (node.size() * 100) / distance
            
            if screen_size < max_screen_error or node.is_leaf:
                result.append(node_id)
            else:
                for child_id in reversed(node.children):
                    stack.append(child_id)
        
        return result
    
    def get_hierarchy_info(self) -> Dict:
        if not self.root_id:
            return {}
        
        return {
            'root_id': self.root_id,
            'total_nodes': len(self.nodes),
            'max_depth': self.max_depth,
            'root_bounds': {
                'min_x': self.nodes[self.root_id].min_x,
                'max_x': self.nodes[self.root_id].max_x,
                'min_y': self.nodes[self.root_id].min_y,
                'max_y': self.nodes[self.root_id].max_y,
                'min_z': self.nodes[self.root_id].min_z,
                'max_z': self.nodes[self.root_id].max_z,
            }
        }


_octree_cache: Dict[str, PointCloudOctree] = {}


def get_or_build_octree(name: str, las_path: str, data_dir: str) -> PointCloudOctree:
    if name in _octree_cache:
        return _octree_cache[name]
    
    octree = PointCloudOctree(data_dir)
    if not octree.load_cached(name):
        octree.build_from_las(las_path, name)
    
    _octree_cache[name] = octree
    return octree
