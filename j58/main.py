import io
import pyttsx3
import asyncio
import uuid
import threading
from queue import Queue, Empty
from typing import List, Dict
from pydantic import BaseModel
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from gesture_engine import GestureEngine


class TrainGestureRequest(BaseModel):
    gesture_id: str
    gesture_name: str
    samples: List[List[Dict]]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

gesture_engine = GestureEngine()

class TTSWorker:
    def __init__(self):
        self._request_queue = Queue(maxsize=100)
        self._audio_cache = {}
        self._cache_lock = threading.Lock()
        self._worker_thread = None
        self._engine = None
        self._stop_event = threading.Event()
        self._semaphore = threading.Semaphore(3)

    def start(self):
        if self._worker_thread is None:
            self._worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
            self._worker_thread.start()

    def _get_engine(self):
        if self._engine is None:
            self._engine = pyttsx3.init()
            self._engine.setProperty('rate', 150)
            self._engine.setProperty('volume', 0.9)
        return self._engine

    def _worker_loop(self):
        engine = self._get_engine()
        while not self._stop_event.is_set():
            try:
                request_id, text = self._request_queue.get(timeout=1)
                if text is None:
                    continue
                
                with self._semaphore:
                    audio_bytes = self._synthesize_audio(engine, text)
                    with self._cache_lock:
                        self._audio_cache[request_id] = audio_bytes
                self._request_queue.task_done()
            except Empty:
                continue
            except Exception as e:
                print(f"TTS worker error: {e}")

    def _synthesize_audio(self, engine, text):
        temp_file = f"temp_{uuid.uuid4().hex}.mp3"
        try:
            engine.save_to_file(text, temp_file)
            engine.runAndWait()
            with open(temp_file, 'rb') as f:
                return f.read()
        finally:
            import os
            if os.path.exists(temp_file):
                os.remove(temp_file)

    def queue_request(self, request_id, text):
        try:
            self._request_queue.put_nowait((request_id, text))
            return True
        except:
            return False

    def get_audio(self, request_id):
        with self._cache_lock:
            return self._audio_cache.pop(request_id, None)

tts_worker = TTSWorker()
tts_worker.start()

class AudioEventManager:
    def __init__(self):
        self._events = {}
        self._lock = asyncio.Lock()

    async def create_event(self, request_id):
        async with self._lock:
            event = asyncio.Event()
            self._events[request_id] = event
            return event

    async def set_event(self, request_id):
        async with self._lock:
            event = self._events.get(request_id)
            if event:
                event.set()

    async def remove_event(self, request_id):
        async with self._lock:
            self._events.pop(request_id, None)

audio_manager = AudioEventManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            landmarks = data.get("landmarks", [])
            request_id = data.get("request_id")
            
            text = gesture_engine.process_landmarks(landmarks)
            
            if text and request_id:
                await audio_manager.create_event(request_id)
                
                queued = tts_worker.queue_request(request_id, text)
                
                if queued:
                    await websocket.send_json({"text": text, "audio_ready": True, "request_id": request_id})
                    
                    async def wait_and_notify():
                        for _ in range(50):
                            audio = tts_worker.get_audio(request_id)
                            if audio:
                                await audio_manager.set_event(request_id)
                                break
                            await asyncio.sleep(0.1)
                        await audio_manager.remove_event(request_id)
                    
                    asyncio.create_task(wait_and_notify())
                else:
                    await websocket.send_json({"text": text, "audio_ready": False, "error": "queue_full"})
            else:
                await websocket.send_json({"text": "", "audio_ready": False})
    except WebSocketDisconnect:
        print("Client disconnected")

@app.get("/audio-stream")
async def audio_stream(request_id: str = Query(...)):
    try:
        audio = None
        for _ in range(50):
            audio = tts_worker.get_audio(request_id)
            if audio:
                break
            await asyncio.sleep(0.1)
        
        if not audio:
            return StreamingResponse(
                io.BytesIO(),
                status_code=204,
                media_type="audio/mpeg"
            )
        
        return StreamingResponse(
            io.BytesIO(audio),
            media_type="audio/mpeg",
            headers={"Content-Disposition": f"inline; filename=audio.mp3"}
        )
    except Exception as e:
        print(f"Audio stream error: {e}")
        return StreamingResponse(
            io.BytesIO(),
            status_code=500,
            media_type="audio/mpeg"
        )

@app.get("/")
async def root():
    return {"message": "Gesture to Speech API"}


@app.post("/api/train-gesture")
async def train_gesture(request: TrainGestureRequest):
    if not request.gesture_id or not request.gesture_name:
        raise HTTPException(status_code=400, detail="gesture_id and gesture_name are required")
    
    if not request.samples or len(request.samples) < 3:
        raise HTTPException(status_code=400, detail="At least 3 samples are required")
    
    success = gesture_engine.train_gesture(
        request.gesture_id,
        request.gesture_name,
        request.samples
    )
    
    if success:
        return JSONResponse({
            "success": True,
            "message": f"Gesture '{request.gesture_name}' trained successfully with {len(request.samples)} samples",
            "gesture_id": request.gesture_id,
            "gesture_name": request.gesture_name,
            "samples_count": len(request.samples)
        })
    else:
        raise HTTPException(status_code=500, detail="Failed to train gesture")


@app.get("/api/gestures")
async def get_gestures():
    gestures = gesture_engine.get_trained_gestures()
    return JSONResponse({
        "success": True,
        "gestures": gestures
    })


@app.delete("/api/gestures/{gesture_id}")
async def delete_gesture(gesture_id: str):
    success = gesture_engine.delete_trained_gesture(gesture_id)
    if success:
        return JSONResponse({
            "success": True,
            "message": f"Gesture '{gesture_id}' deleted successfully"
        })
    else:
        raise HTTPException(status_code=404, detail=f"Gesture '{gesture_id}' not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
