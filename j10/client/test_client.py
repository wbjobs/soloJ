import sys
import os
import time
import argparse

import cv2
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'proto'))
import video_service_pb2
import video_service_pb2_grpc


def generate_test_frames(num_frames=20, width=640, height=480):
    frames = []
    for i in range(num_frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        frame[:, :, :] = (50, 50, 50)
        cv2.putText(frame, f"Frame {i}", (width//4, height//2),
                    cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 3)
        _, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        frames.append((i, jpeg.tobytes()))
    return frames


def main():
    parser = argparse.ArgumentParser(description='Test Video Client (no camera needed)')
    parser.add_argument('--server', type=str, default='localhost:50051',
                        help='gRPC server address')
    parser.add_argument('--frames', type=int, default=20,
                        help='Number of test frames to send')
    parser.add_argument('--interval', type=float, default=0.1,
                        help='Interval between frames in seconds')
    args = parser.parse_args()

    import grpc
    channel = grpc.insecure_channel(args.server)
    stub = video_service_pb2_grpc.VideoServiceStub(channel)

    test_frames = generate_test_frames(args.frames)

    def request_generator():
        for frame_id, frame_bytes in test_frames:
            time.sleep(args.interval)
            timestamp = int(time.time() * 1e6)
            yield video_service_pb2.FrameRequest(
                frame_data=frame_bytes,
                timestamp=timestamp,
                frame_id=frame_id
            )

    print(f"[TEST] Sending {args.frames} test frames to {args.server}...")
    response_count = 0
    try:
        responses = stub.ProcessVideo(request_generator())
        for response in responses:
            response_count += 1
            print(f"[RECV] Frame {response.frame_id}, Faces: {len(response.faces)}")

            jpeg_bytes = np.frombuffer(response.frame_data, dtype=np.uint8)
            frame = cv2.imdecode(jpeg_bytes, cv2.IMREAD_COLOR)

            for face in response.faces:
                print(f"  -> Face: ({face.x},{face.y}) {face.width}x{face.height}, "
                      f"Gender: {face.gender}, Age: {face.age}, Conf: {face.confidence:.2f}")

    except grpc.RpcError as e:
        print(f"[ERROR] gRPC error: {e}")

    channel.close()
    print(f"[TEST] Completed: {response_count} responses received")


if __name__ == '__main__':
    main()