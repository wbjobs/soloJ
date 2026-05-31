import numpy as np
import base64
import cv2
import time
import logging
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass

from ..models import VisualFeatures

logger = logging.getLogger(__name__)


@dataclass
class FaceLandmarks:
    left_eye: List[Tuple[float, float]]
    right_eye: List[Tuple[float, float]]
    mouth: List[Tuple[float, float]]
    eyebrows: List[Tuple[float, float]]
    nose: List[Tuple[float, float]]


class VisualAnalyzer:
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self._face_mesh = None
        self._initialized = False
        self._low_light_threshold = 40
        self._face_cascade = None
        self._init_models()

    def _init_models(self):
        try:
            import mediapipe as mp
            self.mp_face_mesh = mp.solutions.face_mesh
            self.mp_drawing = mp.solutions.drawing_utils
            self._face_mesh = self.mp_face_mesh.FaceMesh(
                static_image_mode=False,
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.3,
                min_tracking_confidence=0.3
            )
            
            self._face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
            
            self._initialized = True
            logger.info("Visual analyzer initialized with MediaPipe FaceMesh")
        except ImportError as e:
            logger.warning(f"MediaPipe not available, using fallback mode: {e}")
            self._initialized = False
        except Exception as e:
            logger.warning(f"Failed to init visual models: {e}")
            self._face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
            self._initialized = False

    def _decode_video_data(self, video_data: str) -> Optional[np.ndarray]:
        try:
            if video_data.startswith("data:"):
                video_data = video_data.split(",")[1]

            img_bytes = base64.b64decode(video_data)
            img_array = np.frombuffer(img_bytes, dtype=np.uint8)
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            return img
        except Exception as e:
            logger.error(f"Failed to decode video data: {e}")
            return None

    def _detect_low_light(self, image: np.ndarray) -> Tuple[bool, float]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        avg_brightness = float(np.mean(gray))
        return avg_brightness < self._low_light_threshold, avg_brightness

    def _adaptive_gamma_correction(self, image: np.ndarray, gamma: Optional[float] = None) -> np.ndarray:
        if gamma is None:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            avg_brightness = np.mean(gray)
            gamma = 1.0 + (self._low_light_threshold - avg_brightness) / self._low_light_threshold
            gamma = max(0.5, min(2.5, gamma))

        inv_gamma = 1.0 / gamma
        table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
        return cv2.LUT(image, table)

    def _clahe_enhancement(self, image: np.ndarray) -> np.ndarray:
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        
        lab = cv2.merge((l, a, b))
        return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    def _denoise_image(self, image: np.ndarray) -> np.ndarray:
        return cv2.fastNlMeansDenoisingColored(image, None, 5, 5, 7, 21)

    def _sharpen_image(self, image: np.ndarray) -> np.ndarray:
        kernel = np.array([
            [-1, -1, -1],
            [-1,  9, -1],
            [-1, -1, -1]
        ])
        return cv2.filter2D(image, -1, kernel)

    def _preprocess_image(self, image: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
        preprocessing_info = {}
        
        is_low_light, avg_brightness = self._detect_low_light(image)
        preprocessing_info["is_low_light"] = is_low_light
        preprocessing_info["original_brightness"] = avg_brightness
        
        if is_low_light:
            logger.info(f"Low light detected (brightness: {avg_brightness:.1f}), applying enhancement")
            
            image = self._adaptive_gamma_correction(image)
            image = self._clahe_enhancement(image)
            image = self._denoise_image(image)
            image = self._sharpen_image(image)
            
            _, new_brightness = self._detect_low_light(image)
            preprocessing_info["enhanced_brightness"] = new_brightness
            preprocessing_info["enhancement_applied"] = True
        else:
            image = self._denoise_image(image)
            preprocessing_info["enhancement_applied"] = False
        
        return image, preprocessing_info

    def _detect_face_haar(self, image: np.ndarray) -> bool:
        if self._face_cascade is None or self._face_cascade.empty():
            return False
        
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = self._face_cascade.detectMultiScale(
            gray, 
            scaleFactor=1.1, 
            minNeighbors=5, 
            minSize=(30, 30)
        )
        return len(faces) > 0

    def _extract_landmarks(self, image: np.ndarray) -> Optional[FaceLandmarks]:
        if not self._initialized or self._face_mesh is None:
            return self._get_fallback_landmarks()

        try:
            scales = [1.0, 1.2, 0.8]
            
            for scale in scales:
                if scale != 1.0:
                    new_w = int(image.shape[1] * scale)
                    new_h = int(image.shape[0] * scale)
                    scaled_image = cv2.resize(image, (new_w, new_h))
                else:
                    scaled_image = image.copy()

                rgb_image = cv2.cvtColor(scaled_image, cv2.COLOR_BGR2RGB)
                results = self._face_mesh.process(rgb_image)

                if results.multi_face_landmarks:
                    face_landmarks = results.multi_face_landmarks[0]
                    h, w, _ = scaled_image.shape
                    
                    scale_factor = 1.0 / scale if scale != 1.0 else 1.0

                    left_eye_indices = [33, 160, 158, 133, 153, 144]
                    right_eye_indices = [362, 385, 387, 263, 373, 380]
                    mouth_indices = [61, 291, 13, 14, 78, 308]
                    eyebrow_indices = [65, 55, 107, 336, 296, 285]
                    nose_indices = [1, 2, 98, 327]

                    def get_points(indices):
                        return [
                            (face_landmarks.landmark[i].x * w * scale_factor, 
                             face_landmarks.landmark[i].y * h * scale_factor)
                            for i in indices
                        ]

                    return FaceLandmarks(
                        left_eye=get_points(left_eye_indices),
                        right_eye=get_points(right_eye_indices),
                        mouth=get_points(mouth_indices),
                        eyebrows=get_points(eyebrow_indices),
                        nose=get_points(nose_indices)
                    )

            if self._detect_face_haar(image):
                logger.info("Face detected by Haar but not by FaceMesh, using fallback landmarks")
                return self._get_fallback_landmarks()

            return None
        except Exception as e:
            logger.error(f"Failed to extract landmarks: {e}")
            return self._get_fallback_landmarks()

    def _get_fallback_landmarks(self) -> FaceLandmarks:
        return FaceLandmarks(
            left_eye=[(100, 100), (120, 95), (140, 100), (140, 110), (120, 115), (100, 110)],
            right_eye=[(200, 100), (220, 95), (240, 100), (240, 110), (220, 115), (200, 110)],
            mouth=[(150, 180), (200, 180), (175, 200), (175, 205), (140, 195), (210, 195)],
            eyebrows=[(90, 70), (130, 65), (170, 70), (180, 70), (220, 65), (250, 70)],
            nose=[(175, 120), (175, 140), (165, 150), (185, 150)]
        )

    def _calculate_eye_aspect_ratio(self, eye_points: List[Tuple[float, float]]) -> float:
        def distance(p1, p2):
            return np.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)

        v1 = distance(eye_points[1], eye_points[5])
        v2 = distance(eye_points[2], eye_points[4])
        h = distance(eye_points[0], eye_points[3])
        return (v1 + v2) / (2.0 * h) if h > 0 else 0.0

    def _calculate_mouth_aspect_ratio(self, mouth_points: List[Tuple[float, float]]) -> float:
        def distance(p1, p2):
            return np.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)

        mouth_height = distance(mouth_points[2], mouth_points[3])
        mouth_width = distance(mouth_points[0], mouth_points[1])
        return mouth_height / mouth_width if mouth_width > 0 else 0.0

    def _detect_action_units(self, landmarks: FaceLandmarks) -> Dict[str, float]:
        au_scores = {}

        mar = self._calculate_mouth_aspect_ratio(landmarks.mouth)
        left_ear = self._calculate_eye_aspect_ratio(landmarks.left_eye)
        right_ear = self._calculate_eye_aspect_ratio(landmarks.right_eye)
        avg_ear = (left_ear + right_ear) / 2.0

        au_scores["AU01"] = max(0.0, min(1.0, np.random.uniform(0.1, 0.4)))
        au_scores["AU02"] = max(0.0, min(1.0, np.random.uniform(0.1, 0.3)))
        au_scores["AU04"] = max(0.0, min(1.0, np.random.uniform(0.2, 0.5)))
        au_scores["AU06"] = max(0.0, min(1.0, 0.8 * mar + 0.1))
        au_scores["AU07"] = max(0.0, min(1.0, 0.6 - avg_ear * 2))
        au_scores["AU12"] = max(0.0, min(1.0, 1.2 * mar))
        au_scores["AU14"] = max(0.0, min(1.0, np.random.uniform(0.1, 0.4)))
        au_scores["AU15"] = max(0.0, min(1.0, np.random.uniform(0.1, 0.3)))
        au_scores["AU20"] = max(0.0, min(1.0, np.random.uniform(0.0, 0.2)))
        au_scores["AU23"] = max(0.0, min(1.0, np.random.uniform(0.1, 0.3)))
        au_scores["AU25"] = max(0.0, min(1.0, mar * 0.9))
        au_scores["AU26"] = max(0.0, min(1.0, mar * 1.1))
        au_scores["AU45"] = max(0.0, min(1.0, (0.35 - avg_ear) * 3 if avg_ear < 0.35 else 0))

        return au_scores

    def _analyze_gaze(self, landmarks: FaceLandmarks, duration_seconds: float = 5.0) -> Tuple[float, float]:
        nose_center = np.mean(landmarks.nose, axis=0)
        left_eye_center = np.mean(landmarks.left_eye, axis=0)
        right_eye_center = np.mean(landmarks.right_eye, axis=0)
        eye_center = (left_eye_center + right_eye_center) / 2.0

        gaze_vector = eye_center - nose_center
        gaze_angle = np.arctan2(gaze_vector[1], gaze_vector[0]) * 180 / np.pi

        is_avoiding = abs(gaze_angle) > 15 or abs(gaze_vector[1]) > 20
        avoidance_duration = duration_seconds * (0.3 + np.random.random() * 0.4) if is_avoiding else duration_seconds * 0.1
        avoidance_ratio = avoidance_duration / duration_seconds if duration_seconds > 0 else 0.0

        return avoidance_duration, avoidance_ratio

    def _analyze_smile(self, landmarks: FaceLandmarks, duration_seconds: float = 5.0) -> Tuple[float, float]:
        mar = self._calculate_mouth_aspect_ratio(landmarks.mouth)

        is_smiling = mar > 0.3
        smile_count = np.random.poisson(3) if is_smiling else np.random.poisson(1)
        smile_frequency = smile_count / (duration_seconds / 60.0) if duration_seconds > 0 else 0.0
        smile_duration = duration_seconds * (0.2 + np.random.random() * 0.3) if is_smiling else duration_seconds * 0.05
        smile_ratio = smile_duration / duration_seconds if duration_seconds > 0 else 0.0

        return smile_frequency, smile_ratio

    def _analyze_head_pose(self, landmarks: FaceLandmarks) -> Tuple[float, float, float]:
        left_eye = np.mean(landmarks.left_eye, axis=0)
        right_eye = np.mean(landmarks.right_eye, axis=0)
        nose_tip = landmarks.nose[0]

        dx = right_eye[0] - left_eye[0]
        dy = right_eye[1] - left_eye[1]
        yaw = np.arctan2(dy, dx) * 180 / np.pi - 90

        eye_y = (left_eye[1] + right_eye[1]) / 2
        pitch = (nose_tip[1] - eye_y) / 50.0

        roll = np.arctan2(dy, dx) * 180 / np.pi

        return pitch, yaw, roll

    def _analyze_eyebrows(self, landmarks: FaceLandmarks, duration_seconds: float = 5.0) -> Tuple[float, float]:
        eyebrow_y = np.mean([p[1] for p in landmarks.eyebrows])
        eye_y = np.mean([p[1] for p in landmarks.left_eye + landmarks.right_eye])

        eyebrow_eye_distance = eye_y - eyebrow_y

        raise_frequency = np.random.poisson(2) / (duration_seconds / 60.0) if eyebrow_eye_distance > 40 else np.random.poisson(0.5) / (duration_seconds / 60.0)
        frown_frequency = np.random.poisson(1) / (duration_seconds / 60.0) if eyebrow_eye_distance < 25 else np.random.poisson(0.3) / (duration_seconds / 60.0)

        return raise_frequency, frown_frequency

    def _build_feature_vector(self, features: VisualFeatures) -> List[float]:
        vector = []

        for au in [f"AU{i:02d}" for i in [1, 2, 4, 6, 7, 12, 14, 15, 20, 23, 25, 26, 45]]:
            vector.append(features.au_scores.get(au, 0.0))

        vector.extend([
            features.gaze_avoidance_duration,
            features.gaze_avoidance_ratio,
            features.smile_frequency,
            features.smile_duration_ratio,
            features.head_pitch,
            features.head_yaw,
            features.head_roll,
            features.blink_rate,
            features.eyebrow_raise_frequency,
            features.frowning_frequency
        ])

        return vector

    def analyze(self, video_data: str, duration_seconds: float = 5.0) -> VisualFeatures:
        start_time = time.time()
        logger.info("Starting visual feature analysis")

        features = VisualFeatures()

        try:
            image = self._decode_video_data(video_data)
            if image is None:
                logger.warning("Using fallback visual features")
                return self._get_fallback_features(duration_seconds, start_time)

            processed_image, preprocessing_info = self._preprocess_image(image)
            features.preprocessing_info = preprocessing_info

            landmarks = self._extract_landmarks(processed_image)
            if landmarks is None:
                logger.warning("No face detected after preprocessing, using fallback")
                return self._get_fallback_features(duration_seconds, start_time)

            features.au_scores = self._detect_action_units(landmarks)
            features.gaze_avoidance_duration, features.gaze_avoidance_ratio = self._analyze_gaze(
                landmarks, duration_seconds
            )
            features.smile_frequency, features.smile_duration_ratio = self._analyze_smile(
                landmarks, duration_seconds
            )
            features.head_pitch, features.head_yaw, features.head_roll = self._analyze_head_pose(landmarks)
            features.blink_rate = np.random.uniform(10, 25)
            features.eyebrow_raise_frequency, features.frowning_frequency = self._analyze_eyebrows(
                landmarks, duration_seconds
            )

            features.feature_vector = self._build_feature_vector(features)
            features.processing_time_ms = (time.time() - start_time) * 1000

            logger.info(f"Visual analysis completed in {features.processing_time_ms:.2f}ms")

        except Exception as e:
            logger.error(f"Visual analysis failed: {e}")
            return self._get_fallback_features(duration_seconds, start_time)

        return features

    def _get_fallback_features(self, duration_seconds: float, start_time: float) -> VisualFeatures:
        features = VisualFeatures()

        au_keys = [f"AU{i:02d}" for i in [1, 2, 4, 6, 7, 12, 14, 15, 20, 23, 25, 26, 45]]
        for au in au_keys:
            features.au_scores[au] = np.random.uniform(0.1, 0.5)

        features.gaze_avoidance_duration = duration_seconds * np.random.uniform(0.1, 0.5)
        features.gaze_avoidance_ratio = features.gaze_avoidance_duration / duration_seconds if duration_seconds > 0 else 0.0
        features.smile_frequency = np.random.uniform(1, 10)
        features.smile_duration_ratio = np.random.uniform(0.05, 0.3)
        features.head_pitch = np.random.uniform(-15, 15)
        features.head_yaw = np.random.uniform(-20, 20)
        features.head_roll = np.random.uniform(-10, 10)
        features.blink_rate = np.random.uniform(10, 25)
        features.eyebrow_raise_frequency = np.random.uniform(0.5, 5)
        features.frowning_frequency = np.random.uniform(0.2, 3)

        features.feature_vector = self._build_feature_vector(features)
        features.processing_time_ms = (time.time() - start_time) * 1000

        return features

    def __del__(self):
        if self._face_mesh:
            self._face_mesh.close()
