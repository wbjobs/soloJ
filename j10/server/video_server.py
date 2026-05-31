import sys
import os
import time
import threading
import argparse
import queue
import uuid
from dataclasses import dataclass, field
from typing import Optional, List, Tuple, Dict

import cv2
import numpy as np
import grpc
from concurrent import futures

from prometheus_client import start_http_server, Counter, Histogram, Gauge

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'proto'))
import video_service_pb2
import video_service_pb2_grpc


FRAMES_SKIP = 5
MAX_INFERENCE_QUEUE_SIZE = 20
INFERENCE_TIMEOUT_SECONDS = 30
INFERENCE_WORKER_COUNT = 1

REQUEST_QPS = Counter(
    'video_service_requests_total',
    'Total number of video requests processed',
    ['status']
)

REQUEST_LATENCY = Histogram(
    'video_service_request_duration_seconds',
    'Time spent processing video frames',
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
)

FRAME_PROCESS_LATENCY = Histogram(
    'video_service_frame_process_duration_seconds',
    'Time spent processing a single frame',
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5)
)

INFERENCE_QUEUE_SIZE = Gauge(
    'video_service_inference_queue_size',
    'Current size of the inference queue'
)

ACTIVE_STREAMS = Gauge(
    'video_service_active_streams',
    'Number of active streaming connections'
)

FACES_DETECTED = Gauge(
    'video_service_faces_detected',
    'Number of faces detected in the last processed batch'
)

DROPPED_FRAMES_SERVER = Counter(
    'video_service_dropped_frames_server_total',
    'Total number of frames dropped by the server'
)

DROPPED_STREAM_CANCELLED = Counter(
    'video_service_dropped_stream_cancelled_total',
    'Total number of frames dropped due to stream cancellation'
)

INFERENCE_TIMEOUT = Counter(
    'video_service_inference_timeout_total',
    'Total number of inference requests timed out'
)

STREAM_MEMORY_USAGE = Gauge(
    'video_service_stream_memory_frames',
    'Number of frames buffered per stream',
    ['stream_id']
)

PROCESSING_BATCH_SIZE = Histogram(
    'video_service_processing_batch_size',
    'Number of frames processed per batch',
    buckets=(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
)


@dataclass
class InferenceJob:
    job_id: str
    stream_id: str
    frames: List[Tuple[bytes, int, int]]
    result_queue: 'queue.Queue'
    created_at: float = field(default_factory=time.time)
    cancelled: threading.Event = field(default_factory=threading.Event)

    def cancel(self):
        self.cancelled.set()

    def is_cancelled(self) -> bool:
        return self.cancelled.is_set()


@dataclass
class InferenceResult:
    job_id: str
    stream_id: str
    results: List[Tuple[bytes, int, int, List[Dict]]]
    success: bool
    error: Optional[str] = None


class FaceDetector:
    def __init__(self):
        from mtcnn import MTCNN
        self.detector = MTCNN()
        self._lock = threading.Lock()
        print("[INFO] MTCNN face detector loaded")

    def detect(self, frame):
        with self._lock:
            try:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                faces = self.detector.detect_faces(rgb_frame)
                return faces
            finally:
                del rgb_frame


class AgeGenderEstimator:
    def __init__(self, model_dir=None):
        self.model_dir = model_dir or os.path.join(
            os.path.dirname(__file__), 'models'
        )
        self._lock = threading.Lock()

        self.age_net = self._load_model(
            os.path.join(self.model_dir, 'age_deploy.prototxt'),
            os.path.join(self.model_dir, 'age_net.caffemodel')
        )
        self.gender_net = self._load_model(
            os.path.join(self.model_dir, 'gender_deploy.prototxt'),
            os.path.join(self.model_dir, 'gender_net.caffemodel')
        )

        self.age_list = ['(0-2)', '(4-6)', '(8-12)', '(15-20)', '(25-32)',
                         '(38-43)', '(48-53)', '(60-100)']
        self.gender_list = ['Male', 'Female']

        self.MODEL_MEAN_VALUES = (78.4263377603, 87.7689143744, 114.895847746)

        if self.age_net and self.gender_net:
            print("[INFO] Age & Gender estimation models loaded")
        else:
            print("[WARN] Age/Gender models not found, using mock estimation")

    def _load_model(self, prototxt_path, caffemodel_path):
        if os.path.exists(prototxt_path) and os.path.exists(caffemodel_path):
            net = cv2.dnn.readNet(prototxt_path, caffemodel_path)
            return net
        return None

    def estimate(self, face_img):
        with self._lock:
            try:
                if self.age_net and self.gender_net:
                    blob = cv2.dnn.blobFromImage(
                        face_img, 1.0, (227, 227), self.MODEL_MEAN_VALUES, swapRB=False
                    )

                    self.gender_net.setInput(blob)
                    gender_preds = self.gender_net.forward()
                    gender = self.gender_list[gender_preds[0].argmax()]
                    gender_conf = gender_preds[0].max()

                    self.age_net.setInput(blob)
                    age_preds = self.age_net.forward()
                    age = self.age_list[age_preds[0].argmax()]
                    age_conf = age_preds[0].max()

                    age_num = self._parse_age(age)
                    del blob, gender_preds, age_preds
                    return gender, age_num, (gender_conf + age_conf) / 2
                else:
                    return self._mock_estimate(face_img)
            finally:
                pass

    def _parse_age(self, age_str):
        parts = age_str.strip('()').split('-')
        if len(parts) == 2:
            return (int(parts[0]) + int(parts[1])) // 2
        return 0

    def _mock_estimate(self, face_img):
        h, w = face_img.shape[:2]
        seed = (h * 13 + w * 7) % 100
        gender = 'Male' if seed < 50 else 'Female'
        age = 5 + seed % 60
        conf = 0.5 + (seed % 50) / 100.0
        return gender, age, conf


class InferenceEngine:
    def __init__(self, worker_count: int = 1):
        self.face_detector = FaceDetector()
        self.age_gender = AgeGenderEstimator()
        self.worker_count = worker_count

        self._inference_queue: 'queue.Queue[InferenceJob]' = queue.Queue(
            maxsize=MAX_INFERENCE_QUEUE_SIZE
        )
        self._workers: List[threading.Thread] = []
        self._stop_event = threading.Event()
        self._active_jobs: Dict[str, InferenceJob] = {}
        self._jobs_lock = threading.Lock()

    def start(self):
        for i in range(self.worker_count):
            worker = threading.Thread(
                target=self._worker_loop,
                name=f"inference-worker-{i}",
                daemon=True
            )
            worker.start()
            self._workers.append(worker)
        print(f"[INFO] Inference engine started with {self.worker_count} worker(s)")

    def stop(self):
        self._stop_event.set()
        for worker in self._workers:
            worker.join(timeout=5)
        print("[INFO] Inference engine stopped")

    def submit(self, job: InferenceJob) -> bool:
        INFERENCE_QUEUE_SIZE.set(self._inference_queue.qsize())

        if self._inference_queue.full():
            try:
                oldest_job = self._inference_queue.get_nowait()
                oldest_job.cancel()
                DROPPED_FRAMES_SERVER.inc(len(oldest_job.frames))
                print(f"[WARN] Inference queue full, dropped job {oldest_job.job_id} "
                      f"({len(oldest_job.frames)} frames)")
            except queue.Empty:
                pass

        try:
            with self._jobs_lock:
                self._active_jobs[job.job_id] = job
            self._inference_queue.put(job, timeout=1)
            return True
        except queue.Full:
            with self._jobs_lock:
                self._active_jobs.pop(job.job_id, None)
            DROPPED_FRAMES_SERVER.inc(len(job.frames))
            return False

    def _worker_loop(self):
        while not self._stop_event.is_set():
            try:
                job = self._inference_queue.get(timeout=0.5)
            except queue.Empty:
                continue

            INFERENCE_QUEUE_SIZE.set(self._inference_queue.qsize())

            with self._jobs_lock:
                self._active_jobs.pop(job.job_id, None)

            wait_time = time.time() - job.created_at
            if job.is_cancelled():
                DROPPED_STREAM_CANCELLED.inc(len(job.frames))
                print(f"[INFO] Job {job.job_id} cancelled before processing, "
                      f"dropped {len(job.frames)} frames")
                continue

            if wait_time > INFERENCE_TIMEOUT_SECONDS:
                INFERENCE_TIMEOUT.inc()
                result = InferenceResult(
                    job_id=job.job_id,
                    stream_id=job.stream_id,
                    results=[],
                    success=False,
                    error=f"Timeout after {wait_time:.1f}s"
                )
                try:
                    job.result_queue.put_nowait(result)
                except queue.Full:
                    pass
                continue

            try:
                results = self._process_batch(job)
                result = InferenceResult(
                    job_id=job.job_id,
                    stream_id=job.stream_id,
                    results=results,
                    success=True
                )
            except Exception as e:
                print(f"[ERROR] Inference failed for job {job.job_id}: {e}")
                result = InferenceResult(
                    job_id=job.job_id,
                    stream_id=job.stream_id,
                    results=[],
                    success=False,
                    error=str(e)
                )

            try:
                job.result_queue.put_nowait(result)
            except queue.Full:
                pass

            del job

    def _process_batch(self, job: InferenceJob) -> List[Tuple[bytes, int, int, List[Dict]]]:
        results = []
        PROCESSING_BATCH_SIZE.observe(len(job.frames))

        for frame_data, frame_id, timestamp in job.frames:
            if job.is_cancelled():
                break

            start_time = time.time()

            jpeg_bytes = np.frombuffer(frame_data, dtype=np.uint8)
            frame = cv2.imdecode(jpeg_bytes, cv2.IMREAD_COLOR)

            if frame is None:
                results.append((frame_data, frame_id, timestamp, []))
                del jpeg_bytes
                continue

            faces = self.face_detector.detect(frame)
            annotations = []

            for face in faces:
                if job.is_cancelled():
                    break

                x, y, w, h = face['box']
                x = max(0, x)
                y = max(0, y)

                cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

                face_img = frame[y:y + h, x:x + w]
                if face_img.size > 0:
                    gender, age, conf = self.age_gender.estimate(face_img)
                    annotations.append({
                        'x': x,
                        'y': y,
                        'width': w,
                        'height': h,
                        'gender': gender,
                        'age': age,
                        'confidence': conf
                    })
                del face_img

            _, output_jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            output_bytes = output_jpeg.tobytes()

            elapsed = time.time() - start_time
            FRAME_PROCESS_LATENCY.observe(elapsed)
            FACES_DETECTED.set(len(annotations))

            results.append((output_bytes, frame_id, timestamp, annotations))

            del frame, jpeg_bytes, output_jpeg

        return results

    def cancel_stream_jobs(self, stream_id: str):
        with self._jobs_lock:
            for job_id, job in list(self._active_jobs.items()):
                if job.stream_id == stream_id:
                    job.cancel()
                    DROPPED_STREAM_CANCELLED.inc(len(job.frames))


class StreamState:
    def __init__(self, stream_id: str, inference_engine: InferenceEngine,
                 max_buffer_frames: int = 10):
        self.stream_id = stream_id
        self.inference_engine = inference_engine
        self.max_buffer_frames = max_buffer_frames

        self.frame_buffer: List[Tuple[bytes, int, int]] = []
        self.result_queue: 'queue.Queue[InferenceResult]' = queue.Queue()
        self.pending_jobs: List[str] = []
        self.is_active = True
        self.cancelled = threading.Event()

        self._lock = threading.Lock()

    def add_frame(self, frame_data: bytes, frame_id: int, timestamp: int) -> int:
        with self._lock:
            if not self.is_active:
                return -1

            self.frame_buffer.append((frame_data, frame_id, timestamp))
            STREAM_MEMORY_USAGE.labels(stream_id=self.stream_id).set(len(self.frame_buffer))

            dropped = 0
            if len(self.frame_buffer) > self.max_buffer_frames:
                overflow = len(self.frame_buffer) - self.max_buffer_frames
                dropped_frames = self.frame_buffer[:overflow]
                self.frame_buffer = self.frame_buffer[overflow:]
                dropped = len(dropped_frames)
                DROPPED_FRAMES_SERVER.inc(dropped)
                print(f"[WARN] Stream {self.stream_id} buffer overflow, dropped {dropped} frames")

            return dropped

    def has_batch(self) -> bool:
        with self._lock:
            return len(self.frame_buffer) >= FRAMES_SKIP

    def submit_batch(self) -> Optional[str]:
        with self._lock:
            if len(self.frame_buffer) < FRAMES_SKIP:
                return None

            batch = self.frame_buffer[:FRAMES_SKIP]
            self.frame_buffer = self.frame_buffer[FRAMES_SKIP:]
            STREAM_MEMORY_USAGE.labels(stream_id=self.stream_id).set(len(self.frame_buffer))

        job = InferenceJob(
            job_id=str(uuid.uuid4()),
            stream_id=self.stream_id,
            frames=batch,
            result_queue=self.result_queue
        )

        if self.inference_engine.submit(job):
            with self._lock:
                self.pending_jobs.append(job.job_id)
            return job.job_id
        else:
            print(f"[WARN] Failed to submit batch for stream {self.stream_id}")
            return None

    def submit_remaining(self) -> Optional[str]:
        with self._lock:
            if not self.frame_buffer:
                return None

            batch = list(self.frame_buffer)
            self.frame_buffer = []
            STREAM_MEMORY_USAGE.labels(stream_id=self.stream_id).set(0)

        job = InferenceJob(
            job_id=str(uuid.uuid4()),
            stream_id=self.stream_id,
            frames=batch,
            result_queue=self.result_queue
        )

        if self.inference_engine.submit(job):
            with self._lock:
                self.pending_jobs.append(job.job_id)
            return job.job_id
        return None

    def get_result(self, timeout: float = 0.1) -> Optional[InferenceResult]:
        try:
            result = self.result_queue.get(timeout=timeout)
            with self._lock:
                if result.job_id in self.pending_jobs:
                    self.pending_jobs.remove(result.job_id)
            return result
        except queue.Empty:
            return None

    def cancel(self):
        with self._lock:
            if self.is_active:
                self.is_active = False
                self.cancelled.set()
                self.frame_buffer = []
                STREAM_MEMORY_USAGE.labels(stream_id=self.stream_id).set(0)

        self.inference_engine.cancel_stream_jobs(self.stream_id)

    def check_active(self) -> bool:
        with self._lock:
            return self.is_active


class VideoServiceServicer(video_service_pb2_grpc.VideoServiceServicer):
    def __init__(self, inference_engine: InferenceEngine, max_buffer_frames: int = 10):
        self.inference_engine = inference_engine
        self.max_buffer_frames = max_buffer_frames
        self.active_streams = 0
        self._lock = threading.Lock()

    def _on_stream_cancelled(self, stream_state: StreamState):
        def callback():
            print(f"[INFO] Stream {stream_state.stream_id} cancelled by client")
            stream_state.cancel()
        return callback

    def ProcessVideo(self, request_iterator, context):
        stream_id = str(uuid.uuid4())[:8]

        with self._lock:
            self.active_streams += 1
            ACTIVE_STREAMS.set(self.active_streams)

        stream_state = StreamState(
            stream_id=stream_id,
            inference_engine=self.inference_engine,
            max_buffer_frames=self.max_buffer_frames
        )

        context.add_callback(self._on_stream_cancelled(stream_state))

        stream_start = time.time()
        request_count = 0
        processed_count = 0

        print(f"[INFO] Stream {stream_id} started, peer={context.peer()}")

        def response_generator():
            nonlocal processed_count
            while stream_state.check_active():
                result = stream_state.get_result(timeout=0.05)
                if result is None:
                    if not context.is_active():
                        break
                    continue

                if not result.success:
                    print(f"[ERROR] Stream {stream_id} inference failed: {result.error}")
                    continue

                for output_bytes, frame_id, timestamp, annotations in result.results:
                    if not stream_state.check_active() or not context.is_active():
                        return

                    face_annotations = [
                        video_service_pb2.FaceAnnotation(
                            x=a['x'], y=a['y'],
                            width=a['width'], height=a['height'],
                            gender=a['gender'], age=a['age'],
                            confidence=a['confidence']
                        ) for a in annotations
                    ]

                    processed_count += 1
                    yield video_service_pb2.FrameResponse(
                        frame_data=output_bytes,
                        timestamp=timestamp,
                        frame_id=frame_id,
                        faces=face_annotations
                    )

        try:
            for request in request_iterator:
                if not stream_state.check_active() or not context.is_active():
                    print(f"[INFO] Stream {stream_id} became inactive, stopping receive")
                    break

                dropped = stream_state.add_frame(
                    request.frame_data, request.frame_id, request.timestamp
                )
                request_count += 1

                if dropped < 0:
                    break

                while stream_state.has_batch():
                    if not stream_state.check_active() or not context.is_active():
                        break
                    job_id = stream_state.submit_batch()
                    if job_id is None:
                        time.sleep(0.01)

                for response in response_generator():
                    yield response

            if stream_state.check_active() and context.is_active():
                stream_state.submit_remaining()

            for response in response_generator():
                yield response

            timeout_start = time.time()
            while (stream_state.check_active() and
                   time.time() - timeout_start < 5.0 and
                   processed_count < request_count):
                time.sleep(0.1)
                for response in response_generator():
                    yield response

            REQUEST_QPS.labels(status='success').inc(request_count)

        except grpc.RpcError as e:
            if e.code() == grpc.StatusCode.CANCELLED:
                print(f"[INFO] Stream {stream_id} cancelled by client (RpcError)")
            else:
                REQUEST_QPS.labels(status='error').inc()
                print(f"[ERROR] Stream {stream_id} RpcError: {e}")
        except Exception as e:
            REQUEST_QPS.labels(status='error').inc()
            print(f"[ERROR] Stream {stream_id} processing error: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
        finally:
            stream_state.cancel()

            with self._lock:
                self.active_streams -= 1
                ACTIVE_STREAMS.set(self.active_streams)

            stream_duration = time.time() - stream_start
            print(f"[INFO] Stream {stream_id} ended: received={request_count}, "
                  f"processed={processed_count}, duration={stream_duration:.2f}s")


def serve():
    parser = argparse.ArgumentParser(description='gRPC Video Processing Server')
    parser.add_argument('--port', type=int, default=50051,
                        help='gRPC server port (default: 50051)')
    parser.add_argument('--metrics-port', type=int, default=8000,
                        help='Prometheus metrics port (default: 8000)')
    parser.add_argument('--max-workers', type=int, default=4,
                        help='Max gRPC thread pool workers (default: 4)')
    parser.add_argument('--inference-workers', type=int, default=INFERENCE_WORKER_COUNT,
                        help='Number of inference worker threads (default: 1)')
    parser.add_argument('--max-buffer-frames', type=int, default=10,
                        help='Max buffered frames per stream (default: 10)')
    parser.add_argument('--model-dir', type=str, default=None,
                        help='Path to age/gender model directory')
    parser.add_argument('--inference-queue-size', type=int, default=MAX_INFERENCE_QUEUE_SIZE,
                        help='Max size of inference queue (default: 20)')
    args = parser.parse_args()

    global MAX_INFERENCE_QUEUE_SIZE
    MAX_INFERENCE_QUEUE_SIZE = args.inference_queue_size

    if args.model_dir:
        os.environ['MODEL_DIR'] = args.model_dir

    print(f"[INFO] Starting Prometheus metrics server on port {args.metrics_port}")
    start_http_server(args.metrics_port)

    inference_engine = InferenceEngine(worker_count=args.inference_workers)
    inference_engine.start()

    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=args.max_workers),
        options=[
            ('grpc.max_send_message_length', 50 * 1024 * 1024),
            ('grpc.max_receive_message_length', 50 * 1024 * 1024),
            ('grpc.keepalive_time_ms', 30000),
            ('grpc.keepalive_timeout_ms', 10000),
        ]
    )

    servicer = VideoServiceServicer(
        inference_engine=inference_engine,
        max_buffer_frames=args.max_buffer_frames
    )
    video_service_pb2_grpc.add_VideoServiceServicer_to_server(servicer, server)

    server.add_insecure_port(f'[::]:{args.port}')
    server.start()

    print(f"[INFO] gRPC server listening on port {args.port}")
    print(f"[INFO] Inference workers: {args.inference_workers}")
    print(f"[INFO] Inference queue size: {MAX_INFERENCE_QUEUE_SIZE}")
    print(f"[INFO] Max buffer per stream: {args.max_buffer_frames} frames")
    print(f"[INFO] Frames per batch: {FRAMES_SKIP}")
    print(f"[INFO] Metrics available at http://localhost:{args.metrics_port}")
    print("[INFO] Press Ctrl+C to stop")

    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        print("\n[INFO] Shutting down...")
        inference_engine.stop()
        server.stop(0)


if __name__ == '__main__':
    serve()