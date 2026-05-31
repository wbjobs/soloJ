import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict


@dataclass
class ClassificationRule:
    name: str
    class_id: int
    color: Tuple[int, int, int]
    description: str


DEFAULT_CLASSIFICATION_RULES = [
    ClassificationRule(
        name="地面",
        class_id=2,
        color=(139, 90, 43),
        description="地表、土壤、草地等低矮植被覆盖区域",
    ),
    ClassificationRule(
        name="低植被",
        class_id=3,
        color=(34, 139, 34),
        description="草地、低矮灌木",
    ),
    ClassificationRule(
        name="中植被",
        class_id=4,
        color=(50, 205, 50),
        description="中等高度灌木",
    ),
    ClassificationRule(
        name="高植被",
        class_id=5,
        color=(0, 100, 0),
        description="树木、森林",
    ),
    ClassificationRule(
        name="建筑",
        class_id=6,
        color=(178, 34, 34),
        description="建筑物、房屋",
    ),
    ClassificationRule(
        name="噪声",
        class_id=7,
        color=(128, 0, 128),
        description="异常点、噪声",
    ),
    ClassificationRule(
        name="水体",
        class_id=9,
        color=(0, 100, 255),
        description="水域、河流、湖泊",
    ),
    ClassificationRule(
        name="道路",
        class_id=11,
        color=(105, 105, 105),
        description="道路、铺装地面",
    ),
    ClassificationRule(
        name="未分类",
        class_id=1,
        color=(200, 200, 200),
        description="未分类点云",
    ),
]


def get_classification_rules() -> List[Dict]:
    """获取所有分类规则"""
    return [asdict(rule) for rule in DEFAULT_CLASSIFICATION_RULES]


def classify_by_rgb(
    r: np.ndarray,
    g: np.ndarray,
    b: np.ndarray,
    custom_rules: Optional[List[Dict]] = None
) -> np.ndarray:
    """
    基于 RGB 颜色进行点云分类
    
    Args:
        r, g, b: 归一化后的 RGB 通道值 (0-1)
        custom_rules: 自定义分类规则
    
    Returns:
        分类标签数组
    """
    rules = custom_rules or DEFAULT_CLASSIFICATION_RULES
    n_points = len(r)
    classifications = np.ones(n_points, dtype=np.uint8)
    
    r = r * 255 if r.max() <= 1.0 else r
    g = g * 255 if g.max() <= 1.0 else g
    b = b * 255 if b.max() <= 1.0 else b
    
    green_ratio = g / (r + b + 1e-6)
    is_green = (green_ratio > 1.2) & (g > 60)
    
    h, s, v = rgb_to_hsv(r, g, b)
    
    is_water = (b > r) & (b > g) & (s > 0.3) & (v > 0.3)
    
    is_gray = (s < 0.15) & (v > 0.2)
    
    is_building = (r > 100) & (g > 80) & (b > 50) & (~is_green) & (~is_gray) & (~is_water)
    is_building = is_building & ((r - g) > 10)
    
    is_road = is_gray & (v > 0.3) & (v < 0.7)
    
    is_high_veg = is_green & (v > 0.4)
    is_low_veg = is_green & (v <= 0.4)
    
    for rule in rules:
        mask = np.zeros(n_points, dtype=bool)
        
        if rule['class_id'] == 5:
            mask = is_high_veg
        elif rule['class_id'] == 3:
            mask = is_low_veg & ~is_high_veg
        elif rule['class_id'] == 6:
            mask = is_building
        elif rule['class_id'] == 9:
            mask = is_water
        elif rule['class_id'] == 11:
            mask = is_road
        elif rule['class_id'] == 2:
            mask = is_gray & ~is_road
        
        classifications[mask] = rule['class_id']
    
    return classifications


def rgb_to_hsv(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """将 RGB 转换为 HSV"""
    r = r / 255.0
    g = g / 255.0
    b = b / 255.0
    
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    v = maxc
    
    s = np.zeros_like(v)
    mask = maxc > 0
    s[mask] = (maxc[mask] - minc[mask]) / maxc[mask]
    
    h = np.zeros_like(v)
    diff = maxc - minc
    
    rc = np.zeros_like(r)
    gc = np.zeros_like(g)
    bc = np.zeros_like(b)
    
    mask_diff = diff > 0
    rc[mask_diff] = (maxc[mask_diff] - r[mask_diff]) / diff[mask_diff]
    gc[mask_diff] = (maxc[mask_diff] - g[mask_diff]) / diff[mask_diff]
    bc[mask_diff] = (maxc[mask_diff] - b[mask_diff]) / diff[mask_diff]
    
    mask_r = (maxc == r) & mask_diff
    h[mask_r] = bc[mask_r] - gc[mask_r]
    
    mask_g = (maxc == g) & mask_diff & ~mask_r
    h[mask_g] = 2.0 + rc[mask_g] - bc[mask_g]
    
    mask_b = (maxc == b) & mask_diff & ~mask_r & ~mask_g
    h[mask_b] = 4.0 + gc[mask_b] - rc[mask_b]
    
    h = h / 6.0
    h[h < 0] += 1.0
    
    return h, s, v


def classify_by_intensity(
    intensity: np.ndarray,
    z: Optional[np.ndarray] = None,
    custom_thresholds: Optional[Dict] = None
) -> np.ndarray:
    """
    基于激光反射强度进行点云分类
    
    Args:
        intensity: 反射强度值
        z: 高度坐标（可选，用于辅助分类）
        custom_thresholds: 自定义阈值
    
    Returns:
        分类标签数组
    """
    n_points = len(intensity)
    classifications = np.ones(n_points, dtype=np.uint8)
    
    intensity_norm = intensity / 65535.0 if intensity.max() > 255 else intensity / 255.0
    
    thresholds = custom_thresholds or {
        'low': 0.1,
        'medium_low': 0.3,
        'medium_high': 0.6,
        'high': 0.85,
    }
    
    is_low = intensity_norm < thresholds['low']
    is_medium_low = (intensity_norm >= thresholds['low']) & (intensity_norm < thresholds['medium_low'])
    is_medium_high = (intensity_norm >= thresholds['medium_low']) & (intensity_norm < thresholds['medium_high'])
    is_high = intensity_norm >= thresholds['high']
    
    if z is not None:
        z_min, z_max = z.min(), z.max()
        z_norm = (z - z_min) / (z_max - z_min + 1e-6)
        
        is_ground = z_norm < 0.15
        is_vegetation = (z_norm >= 0.15) & (z_norm < 0.7) & is_medium_high
        is_building = (z_norm >= 0.3) & is_high
        
        classifications[is_ground & is_medium_low] = 2
        classifications[is_vegetation] = 5
        classifications[is_building] = 6
        classifications[is_low] = 7
    else:
        classifications[is_low] = 7
        classifications[is_medium_low] = 2
        classifications[is_medium_high] = 5
        classifications[is_high] = 6
    
    return classifications


def get_class_statistics(
    classifications: np.ndarray,
    intensities: Optional[np.ndarray] = None
) -> Dict:
    """获取分类统计信息"""
    unique, counts = np.unique(classifications, return_counts=True)
    
    stats = {
        'total_points': len(classifications),
        'classes': [],
    }
    
    rule_map = {rule['class_id']: rule for rule in get_classification_rules()}
    
    for class_id, count in zip(unique, counts):
        rule = rule_map.get(class_id, {
            'name': f'未知分类 {class_id}',
            'color': (128, 128, 128),
        })
        
        class_stat = {
            'class_id': int(class_id),
            'name': rule.get('name', f'Class {class_id}'),
            'color': rule.get('color', (128, 128, 128)),
            'count': int(count),
            'percentage': float(count / len(classifications) * 100),
        }
        
        if intensities is not None:
            mask = classifications == class_id
            if mask.any():
                class_stat['avg_intensity'] = float(np.mean(intensities[mask]))
                class_stat['min_intensity'] = float(np.min(intensities[mask]))
                class_stat['max_intensity'] = float(np.max(intensities[mask]))
        
        stats['classes'].append(class_stat)
    
    return stats
