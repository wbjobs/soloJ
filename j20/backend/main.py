import asyncio
import json
import base64
import logging
from typing import List, Dict, Optional
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Text-Guided Style Transfer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TextRequest(BaseModel):
    text: str
    image_width: int = 640
    image_height: int = 480


class MaskData(BaseModel):
    mask: str
    confidence: float


@dataclass
class ConnectionManager:
    active_connections: List[WebSocket] = field(default_factory=list)
    executor: ThreadPoolExecutor = field(default_factory=lambda: ThreadPoolExecutor(max_workers=4))
    
    def connect(self, websocket: WebSocket):
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)


manager = ConnectionManager()


class CLIPMaskGenerator:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.initialized = False
        return cls._instance
    
    def __init__(self):
        if self.initialized:
            return
        self.initialized = True
        self.model = None
        self.processor = None
        self.device = "cuda" if __import__("torch").cuda.is_available() else "cpu"
        logger.info(f"CLIP Mask Generator using device: {self.device}")
    
    def load_model(self):
        try:
            import torch
            from transformers import CLIPProcessor, CLIPModel
            
            model_name = "openai/clip-vit-base-patch32"
            self.model = CLIPModel.from_pretrained(model_name)
            self.processor = CLIPProcessor.from_pretrained(model_name)
            self.model.to(self.device)
            self.model.eval()
            logger.info("CLIP model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load CLIP model: {e}")
            raise
    
    def generate_mask(self, text: str, width: int, height: int) -> Dict:
        try:
            import torch
            
            classes = self._extract_semantic_regions(text)
            if not classes:
                return {"mask": self._empty_mask_base64(width, height), "confidence": 0.0}
            
            grid_size = 16
            mask = np.zeros((height, width), dtype=np.float32)
            
            for region_class, weight in classes.items():
                text_inputs = self.processor(
                    text=[f"a photo of {region_class}"],
                    return_tensors="pt",
                    padding=True
                ).to(self.device)
                
                with torch.no_grad():
                    text_features = self.model.get_text_features(**text_inputs)
                
                patch_size = min(width, height) // grid_size
                for py in range(0, height, patch_size):
                    for px in range(0, width, patch_size):
                        region_mask = np.zeros((height, width), dtype=np.float32)
                        region_mask[py:py+patch_size, px:px+patch_size] = 1.0
                        
                        confidence = self._compute_patch_confidence(
                            text_features, 
                            region_class, 
                            px, py, 
                            width, height,
                            patch_size
                        )
                        
                        mask[py:py+patch_size, px:px+patch_size] = max(
                            mask[py:py+patch_size, px:px+patch_size],
                            confidence * weight
                        )
            
            mask = self._smooth_mask(mask)
            mask_b64 = self._mask_to_base64(mask)
            
            avg_confidence = float(np.mean(mask))
            
            return {
                "mask": mask_b64,
                "confidence": avg_confidence,
                "regions": classes
            }
            
        except Exception as e:
            logger.error(f"Mask generation error: {e}")
            return {
                "mask": self._empty_mask_base64(width, height),
                "confidence": 0.0,
                "error": str(e)
            }
    
    def _extract_semantic_regions(self, text: str) -> Dict[str, float]:
        keywords = {
            "sky": ["sky", "天空", "cloud", "云", "sun", "太阳"],
            "ground": ["ground", "地面", "floor", "地板", "grass", "草地"],
            "water": ["water", "水", "river", "河", "lake", "湖", "sea", "海", "ocean", "洋"],
            "human": ["person", "人", "human", "人类", "face", "脸"],
            "building": ["building", "建筑", "house", "房子", "city", "城市"],
            "tree": ["tree", "树", "forest", "森林", "plant", "植物"],
            "mountain": ["mountain", "山", "hill", "山丘"],
            "background": ["background", "背景", "everything", "所有"],
            "foreground": ["foreground", "前景", "front", "前面"],
        }
        
        weights = {
            "sky": 1.0,
            "ground": 1.0,
            "water": 1.0,
            "human": 0.8,
            "building": 0.9,
            "tree": 0.9,
            "mountain": 0.9,
            "background": 1.0,
            "foreground": 0.7,
        }
        
        found_classes = {}
        text_lower = text.lower()
        
        for class_name, word_list in keywords.items():
            for word in word_list:
                if word.lower() in text_lower:
                    found_classes[class_name] = weights.get(class_name, 1.0)
                    break
        
        if not found_classes:
            return {}
        
        return found_classes
    
    def _compute_patch_confidence(
        self, 
        text_features, 
        region_class: str, 
        px: int, py: int,
        width: int, height: int,
        patch_size: int
    ) -> float:
        import torch
        
        center_x = px + patch_size / 2
        center_y = py + patch_size / 2
        
        confidence = 0.5
        
        if region_class == "sky":
            confidence = 1.0 - (center_y / height) * 1.5
        elif region_class == "ground":
            confidence = (center_y / height) * 1.5
        elif region_class == "water":
            confidence = (center_y / height) * 1.2
        elif region_class == "human":
            center_dist = abs(center_x - width/2) / (width/2)
            vertical_pos = center_y / height
            confidence = 0.8 * (1 - center_dist) * (0.5 + 0.5 * vertical_pos)
        elif region_class == "building":
            vertical_pos = center_y / height
            confidence = 0.6 + 0.4 * (1 - abs(vertical_pos - 0.5) * 2)
        elif region_class == "tree":
            vertical_pos = center_y / height
            confidence = 0.5 + 0.5 * vertical_pos
        elif region_class == "mountain":
            vertical_pos = center_y / height
            confidence = 0.4 + 0.6 * (1 - vertical_pos)
        elif region_class == "background":
            confidence = 0.3
        elif region_class == "foreground":
            confidence = 0.7 + 0.3 * (center_y / height)
        
        return max(0.0, min(1.0, confidence))
    
    def _smooth_mask(self, mask: np.ndarray) -> np.ndarray:
        from scipy.ndimage import gaussian_filter
        
        smoothed = gaussian_filter(mask, sigma=8.0)
        return np.clip(smoothed, 0, 1)
    
    def _mask_to_base64(self, mask: np.ndarray) -> str:
        mask_uint8 = (mask * 255).astype(np.uint8)
        mask_bytes = mask_uint8.tobytes()
        
        import struct
        header = struct.pack('!II', mask.shape[1], mask.shape[0])
        data = header + mask_bytes
        encoded = base64.b64encode(data).decode('utf-8')
        
        return encoded
    
    def _empty_mask_base64(self, width: int, height: int) -> str:
        mask = np.zeros((height, width), dtype=np.uint8)
        mask_bytes = mask.tobytes()
        
        import struct
        header = struct.pack('!II', width, height)
        data = header + mask_bytes
        encoded = base64.b64encode(data).decode('utf-8')
        
        return encoded


clip_generator = None


@app.on_event("startup")
async def startup_event():
    global clip_generator
    try:
        clip_generator = CLIPMaskGenerator()
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, clip_generator.load_model)
    except Exception as e:
        logger.error(f"Failed to initialize CLIP model: {e}")
        clip_generator = None


@app.post("/api/generate-mask")
async def generate_mask(request: TextRequest):
    if not clip_generator:
        return {
            "mask": base64.b64encode(
                np.zeros((request.image_height, request.image_width), dtype=np.uint8).tobytes()
            ).decode('utf-8'),
            "confidence": 0.0,
            "error": "CLIP model not initialized"
        }
    
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        manager.executor,
        clip_generator.generate_mask,
        request.text,
        request.image_width,
        request.image_height
    )
    
    return result


@app.websocket("/ws/mask")
async def websocket_mask(websocket: WebSocket):
    await websocket.accept()
    manager.connect(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "generate_mask":
                text = message.get("text", "")
                width = message.get("width", 640)
                height = message.get("height", 480)
                
                if clip_generator:
                    loop = asyncio.get_event_loop()
                    result = await loop.run_in_executor(
                        manager.executor,
                        clip_generator.generate_mask,
                        text, width, height
                    )
                    
                    await websocket.send_json({
                        "type": "mask_data",
                        "mask": result["mask"],
                        "confidence": result.get("confidence", 0.0),
                        "regions": result.get("regions", {})
                    })
                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": "CLIP model not available"
                    })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "clip_loaded": clip_generator is not None and clip_generator.model is not None
    }
