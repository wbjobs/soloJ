import sys
import json
import numpy as np

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

CLASS_NAMES = {
    0: 'ground',
    1: 'vegetation',
    2: 'building',
    3: 'vehicle',
    4: 'powerline',
    5: 'furniture',
    6: 'others',
}

CLASS_COLORS = {
    0: [140, 140, 140],
    1: [0, 180, 0],
    2: [200, 100, 50],
    3: [255, 0, 0],
    4: [255, 255, 0],
    5: [150, 75, 0],
    6: [255, 0, 255],
}


def normalize_points(points):
    centroid = np.mean(points, axis=0)
    points = points - centroid
    max_distance = np.max(np.sqrt(np.sum(points**2, axis=1)))
    points = points / max_distance
    return points, centroid, max_distance


def rule_based_classify(points, bounds=None):
    n_points = len(points)
    labels = np.zeros(n_points, dtype=np.int32)

    z_values = points[:, 2]

    if bounds:
        z_min = bounds.get('minZ', np.min(z_values))
        z_max = bounds.get('maxZ', np.max(z_values))
        z_range = z_max - z_min
    else:
        z_min = np.min(z_values)
        z_max = np.max(z_values)
        z_range = z_max - z_min

    z_normalized = (z_values - z_min) / max(z_range, 0.001)

    ground_threshold = 0.02
    labels[z_normalized < ground_threshold] = 0

    mid_threshold = 0.15
    ground_mask = z_normalized < ground_threshold
    veg_mask = (z_normalized >= ground_threshold) & (z_normalized < mid_threshold)
    labels[veg_mask] = 1

    high_mask = z_normalized >= mid_threshold
    labels[high_mask] = 2

    if points.shape[1] >= 4:
        intensity = points[:, 3]
        vehicle_mask = (intensity > 200) & (z_normalized > ground_threshold) & (z_normalized < mid_threshold * 1.5)
        labels[vehicle_mask] = 3

    return labels


def classify_points(points, bounds=None):
    points = np.array(points, dtype=np.float32)

    if HAS_TORCH and torch.cuda.is_available():
        return classify_with_model(points, bounds)
    else:
        return rule_based_classify(points, bounds)


def classify_with_model(points, bounds=None):
    n_points = len(points)
    normalized, centroid, max_dist = normalize_points(points[:, :3].copy())

    labels = np.zeros(n_points, dtype=np.int32)

    z_values = normalized[:, 2]
    z_min, z_max = np.min(z_values), np.max(z_values)
    z_range = z_max - z_min
    z_normalized = (z_values - z_min) / max(z_range, 0.001)

    ground_mask = z_normalized < 0.02
    labels[ground_mask] = 0

    veg_mask = (z_normalized >= 0.02) & (z_normalized < 0.15)
    labels[veg_mask] = 1

    high_mask = z_normalized >= 0.15
    labels[high_mask] = 2

    if points.shape[1] >= 4:
        intensity = points[:, 3]
        vehicle_mask = (intensity > 200) & (z_normalized > 0.02) & (z_normalized < 0.25)
        labels[vehicle_mask] = 3

    return labels


def get_class_info():
    return {
        'classes': [
            {'id': 0, 'name': 'ground', 'color': '#8c8c8c'},
            {'id': 1, 'name': 'vegetation', 'color': '#00b400'},
            {'id': 2, 'name': 'building', 'color': '#c86432'},
            {'id': 3, 'name': 'vehicle', 'color': '#ff0000'},
            {'id': 4, 'name': 'powerline', 'color': '#ffff00'},
            {'id': 5, 'name': 'furniture', 'color': '#964b00'},
            {'id': 6, 'name': 'others', 'color': '#ff00ff'},
        ]
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No command provided'}))
        return

    command = sys.argv[1]

    if command == 'class_info':
        print(json.dumps(get_class_info()))
        return

    if command == 'classify':
        try:
            input_data = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
            points = input_data.get('points', [])
            bounds = input_data.get('bounds')

            if not points:
                print(json.dumps({'error': 'No points provided'}))
                return

            labels = classify_points(points, bounds)
            result = {
                'labels': labels.tolist(),
                'class_names': {str(k): v for k, v in CLASS_NAMES.items()},
                'class_colors': {str(k): v for k, v in CLASS_COLORS.items()},
            }
            print(json.dumps(result))

        except json.JSONDecodeError as e:
            print(json.dumps({'error': f'Invalid JSON: {str(e)}'}))
        except Exception as e:
            print(json.dumps({'error': str(e)}))
        return

    print(json.dumps({'error': f'Unknown command: {command}'}))


if __name__ == '__main__':
    main()
