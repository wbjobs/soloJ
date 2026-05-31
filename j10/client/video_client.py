import sys
import os
import time
import queue
import threading
import argparse

import cv2
import numpy as np
import grpc

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'proto'))
import video_service_pb2
import video_service_pb2_grpc


class VideoClient:
    def __init__(self, server_addr, camera_id=0, video_path=None,
                 max_pending=2, display=True):
        self.server_addr = server_addr
        self.camera_id = camera_id
        self.video_path = video_path
        self.max_pending = max_pending
        self.display = display

        self.frame_queue = queue.Queue(maxsize=max_pending)
        self.stop_event = threading.Event()

        self.frame_id = 0
        self.frames_sent = 0
        self.frames_dropped = 0
        self.frames_received = 0
        self.fps_send = 0
        self.fps_recv = 0
        self._last_send_time = time.time()
        self._last_recv_time = time.time()
        self._send_count = 0
        self._recv_count = 0

    def _capture_frames(self):
        if self.video_path:
            cap = cv2.VideoCapture(self.video_path)
        else:
            cap = cv2.VideoCapture(self.camera_id)

        if not cap.isOpened():
            print(f"[ERROR] Cannot open video source: {self.video_path or f'camera {self.camera_id}'}")
            self.stop_event.set()
            return

        print(f"[INFO] Video source opened successfully")

        while not self.stop_event.is_set():
            ret, frame = cap.read()
            if not ret:
                print("[WARN] Failed to read frame, stream ended")
                break

            self.frame_id += 1
            _, jpeg_data = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            frame_bytes = jpeg_data.tobytes()

            try:
                self.frame_queue.put_nowait((self.frame_id, frame_bytes))
            except queue.Full:
                try:
                    self.frame_queue.get_nowait()
                except queue.Empty:
                    pass
                try:
                    self.frame_queue.put_nowait((self.frame_id, frame_bytes))
                    self.frames_dropped += 1
                except queue.Full:
                    self.frames_dropped += 1

        cap.release()

    def _request_generator(self):
        while not self.stop_event.is_set():
            try:
                frame_id, frame_bytes = self.frame_queue.get(timeout=0.05)
            except queue.Empty:
                continue

            timestamp = int(time.time() * 1e6)
            self.frames_sent += 1
            self._send_count += 1
            now = time.time()
            if now - self._last_send_time >= 1.0:
                self.fps_send = self._send_count / (now - self._last_send_time)
                self._send_count = 0
                self._last_send_time = now

            yield video_service_pb2.FrameRequest(
                frame_data=frame_bytes,
                timestamp=timestamp,
                frame_id=frame_id
            )

    def run(self):
        options = [
            ('grpc.max_send_message_length', 50 * 1024 * 1024),
            ('grpc.max_receive_message_length', 50 * 1024 * 1024),
            ('grpc.keepalive_time_ms', 30000),
        ]

        channel = grpc.insecure_channel(self.server_addr, options=options)
        stub = video_service_pb2_grpc.VideoServiceStub(channel)

        capture_thread = threading.Thread(target=self._capture_frames, daemon=True)
        capture_thread.start()

        print(f"[INFO] Connecting to server: {self.server_addr}")
        print(f"[INFO] Max pending frames: {self.max_pending}")
        print("[INFO] Streaming started. Press 'q' to quit.")

        try:
            responses = stub.ProcessVideo(self._request_generator())
            for response in responses:
                self.frames_received += 1
                self._recv_count += 1
                now = time.time()
                if now - self._last_recv_time >= 1.0:
                    self.fps_recv = self._recv_count / (now - self._last_recv_time)
                    self._recv_count = 0
                    self._last_recv_time = now

                jpeg_bytes = np.frombuffer(response.frame_data, dtype=np.uint8)
                frame = cv2.imdecode(jpeg_bytes, cv2.IMREAD_COLOR)

                if self.display and frame is not None:
                    for face in response.faces:
                        label = f"{face.gender}, {face.age}y ({face.confidence:.2f})"
                        cv2.putText(frame, label, (face.x, face.y - 10),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

                    status = (f"Sent:{self.fps_send:.1f}fps "
                              f"Recv:{self.fps_recv:.1f}fps "
                              f"Drop:{self.frames_dropped} "
                              f"Faces:{len(response.faces)}")
                    cv2.putText(frame, status, (10, 30),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

                    cv2.imshow('Processed Video', frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break

        except grpc.RpcError as e:
            print(f"[ERROR] gRPC error: {e}")
        except KeyboardInterrupt:
            print("\n[INFO] Interrupted by user")
        finally:
            self.stop_event.set()
            channel.close()
            cv2.destroyAllWindows()
            print(f"\n[STATS] Frames sent: {self.frames_sent}")
            print(f"[STATS] Frames received: {self.frames_received}")
            print(f"[STATS] Frames dropped: {self.frames_dropped}")


def main():
    parser = argparse.ArgumentParser(description='gRPC Video Streaming Client')
    parser.add_argument('--server', type=str, default='localhost:50051',
                        help='gRPC server address (default: localhost:50051)')
    parser.add_argument('--camera', type=int, default=0,
                        help='Camera ID (default: 0)')
    parser.add_argument('--video', type=str, default=None,
                        help='Video file path (overrides camera)')
    parser.add_argument('--max-pending', type=int, default=2,
                        help='Max pending frames before drop (default: 2)')
    parser.add_argument('--no-display', action='store_true',
                        help='Disable display window')
    args = parser.parse_args()

    client = VideoClient(
        server_addr=args.server,
        camera_id=args.camera,
        video_path=args.video,
        max_pending=args.max_pending,
        display=not args.no_display
    )
    client.run()


if __name__ == '__main__':
    main()