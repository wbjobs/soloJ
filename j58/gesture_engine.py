import math
import time
import json
import os
from collections import deque, Counter
from typing import List, Dict, Tuple, Optional


class KNNClassifier:
    def __init__(self, k: int = 3):
        self.k = k
        self.X_train: List[List[float]] = []
        self.y_train: List[str] = []
        self.labels: Dict[str, str] = {}
    
    def euclidean_distance(self, x1: List[float], x2: List[float]) -> float:
        return math.sqrt(sum((a - b) ** 2 for a, b in zip(x1, x2)))
    
    def fit(self, X: List[List[float]], y: List[str], labels: Optional[Dict[str, str]] = None):
        self.X_train.extend(X)
        self.y_train.extend(y)
        if labels:
            self.labels.update(labels)
    
    def predict(self, x: List[float], threshold: float = 0.15) -> Optional[str]:
        if len(self.X_train) == 0:
            return None
        
        distances = []
        for i, x_train in enumerate(self.X_train):
            dist = self.euclidean_distance(x, x_train)
            distances.append((dist, self.y_train[i]))
        
        distances.sort(key=lambda x: x[0])
        
        if distances[0][0] > threshold:
            return None
        
        k_neighbors = distances[:min(self.k, len(distances))]
        k_labels = [label for _, label in k_neighbors]
        most_common = Counter(k_labels).most_common(1)
        
        if most_common:
            return most_common[0][0]
        return None
    
    def get_label_text(self, gesture_id: str) -> str:
        return self.labels.get(gesture_id, gesture_id)
    
    def get_all_gestures(self) -> List[Dict]:
        gesture_counts = Counter(self.y_train)
        result = []
        for gesture_id, count in gesture_counts.items():
            result.append({
                "id": gesture_id,
                "name": self.labels.get(gesture_id, gesture_id),
                "samples": count
            })
        return result
    
    def delete_gesture(self, gesture_id: str) -> bool:
        original_len = len(self.y_train)
        self.X_train = [x for x, y in zip(self.X_train, self.y_train) if y != gesture_id]
        self.y_train = [y for y in self.y_train if y != gesture_id]
        if gesture_id in self.labels:
            del self.labels[gesture_id]
        return len(self.y_train) < original_len
    
    def save_model(self, filepath: str):
        data = {
            "X_train": self.X_train,
            "y_train": self.y_train,
            "labels": self.labels,
            "k": self.k
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
    
    def load_model(self, filepath: str) -> bool:
        if not os.path.exists(filepath):
            return False
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.X_train = data.get("X_train", [])
            self.y_train = data.get("y_train", [])
            self.labels = data.get("labels", {})
            self.k = data.get("k", 3)
            return True
        except:
            return False


class GestureEngine:
    def __init__(self):
        self.gesture_history = deque(maxlen=10)
        self.last_gesture_time = 0
        self.cooldown = 1.5
        self.current_text = ""
        
        self.FINGER_TIPS = [4, 8, 12, 16, 20]
        self.FINGER_PIP = [3, 6, 10, 14, 18]
        self.FINGER_MCP = [2, 5, 9, 13, 17]
        
        self.knn = KNNClassifier(k=3)
        self.model_path = "gesture_model.json"
        self.knn.load_model(self.model_path)
    
    def normalize_landmarks(self, landmarks: List[Dict]) -> List[float]:
        if len(landmarks) != 21:
            return []
        
        wrist = landmarks[0]
        palm_size = self.distance(wrist, landmarks[9])
        
        normalized = []
        for lm in landmarks:
            normalized.append((lm['x'] - wrist['x']) / palm_size)
            normalized.append((lm['y'] - wrist['y']) / palm_size)
            normalized.append((lm['z'] - wrist['z']) / palm_size)
        
        return normalized
    
    def distance(self, p1, p2):
        return math.sqrt((p1['x'] - p2['x'])**2 + (p1['y'] - p2['y'])**2 + (p1['z'] - p2['z'])**2)

    def is_finger_extended(self, landmarks, finger_idx):
        tip_idx = self.FINGER_TIPS[finger_idx]
        pip_idx = self.FINGER_PIP[finger_idx]
        mcp_idx = self.FINGER_MCP[finger_idx]
        
        tip = landmarks[tip_idx]
        pip = landmarks[pip_idx]
        mcp = landmarks[mcp_idx]
        
        if finger_idx == 0:
            thumb_tip = landmarks[4]
            index_mcp = landmarks[5]
            return self.distance(thumb_tip, index_mcp) > 0.1
        
        tip_to_mcp = self.distance(tip, mcp)
        pip_to_mcp = self.distance(pip, mcp)
        return tip_to_mcp > pip_to_mcp

    def count_extended_fingers(self, landmarks):
        count = 0
        for i in range(5):
            if self.is_finger_extended(landmarks, i):
                count += 1
        return count

    def recognize_gesture_rule_based(self, landmarks):
        if len(landmarks) != 21:
            return None
        
        extended = [self.is_finger_extended(landmarks, i) for i in range(5)]
        wrist = landmarks[0]
        palm_size = self.distance(wrist, landmarks[9])
        
        if extended == [False, False, False, False, False]:
            return "fist"
        
        if extended == [True, True, True, True, True]:
            return "open"
        
        if extended == [False, True, False, False, False]:
            return "one"
        
        if extended == [False, True, True, False, False]:
            return "two"
        
        if extended == [False, True, True, True, False]:
            return "three"
        
        if extended == [False, True, True, True, True]:
            return "four"
        
        if extended == [True, True, True, True, False]:
            return "four"
        
        if extended == [True, True, False, False, False]:
            thumb_tip = landmarks[4]
            index_tip = landmarks[8]
            if self.distance(thumb_tip, index_tip) < palm_size * 0.3:
                return "ok"
        
        if extended == [True, False, False, False, True]:
            return "rock"
        
        if extended == [False, True, False, False, True]:
            return "love"
        
        thumb_tip = landmarks[4]
        pinky_tip = landmarks[20]
        if self.distance(thumb_tip, pinky_tip) < palm_size * 0.3 and not extended[1] and not extended[2] and not extended[3]:
            return "telephone"
        
        return None
    
    def recognize_gesture_knn(self, landmarks):
        normalized = self.normalize_landmarks(landmarks)
        if not normalized:
            return None
        return self.knn.predict(normalized)

    def recognize_gesture(self, landmarks):
        knn_gesture = self.recognize_gesture_knn(landmarks)
        if knn_gesture:
            return knn_gesture
        
        return self.recognize_gesture_rule_based(landmarks)

    def gesture_to_text(self, gesture):
        gesture_map = {
            "fist": "停止",
            "open": "你好",
            "one": "一",
            "two": "二",
            "three": "三",
            "four": "四",
            "ok": "好的",
            "rock": "加油",
            "love": "我爱你",
            "telephone": "打电话"
        }
        
        if gesture in gesture_map:
            return gesture_map[gesture]
        
        return self.knn.get_label_text(gesture)
    
    def train_gesture(self, gesture_id: str, gesture_name: str, samples: List[List[Dict]]) -> bool:
        try:
            X = []
            for landmarks in samples:
                normalized = self.normalize_landmarks(landmarks)
                if normalized:
                    X.append(normalized)
            
            if not X:
                return False
            
            self.knn.fit(X, [gesture_id] * len(X), {gesture_id: gesture_name})
            self.knn.save_model(self.model_path)
            return True
        except Exception as e:
            print(f"Training error: {e}")
            return False
    
    def get_trained_gestures(self) -> List[Dict]:
        return self.knn.get_all_gestures()
    
    def delete_trained_gesture(self, gesture_id: str) -> bool:
        success = self.knn.delete_gesture(gesture_id)
        if success:
            self.knn.save_model(self.model_path)
        return success

    def process_landmarks(self, landmarks):
        current_time = time.time()
        
        if current_time - self.last_gesture_time < self.cooldown:
            return ""
        
        gesture = self.recognize_gesture(landmarks)
        
        if gesture:
            self.gesture_history.append(gesture)
            
            if len(self.gesture_history) >= 3:
                recent = list(self.gesture_history)[-3:]
                if recent.count(gesture) >= 2:
                    self.last_gesture_time = current_time
                    self.gesture_history.clear()
                    text = self.gesture_to_text(gesture)
                    self.current_text = text
                    return text
        
        return ""
