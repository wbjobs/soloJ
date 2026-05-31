#!/usr/bin/env python
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'proto'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'server'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'client'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'federated'))


def main():
    if len(sys.argv) < 2:
        print("Usage: python main.py <server|client|test|download|fl-server|fl-client|fl-sim> [args...]")
        print("")
        print("Video Processing Commands:")
        print("  server     - Start the gRPC video processing server")
        print("  client     - Start the video streaming client")
        print("  test       - Run test client (no camera needed)")
        print("  download   - Download age/gender estimation models")
        print("")
        print("Federated Learning Commands:")
        print("  fl-server  - Start federated learning central server")
        print("  fl-client  - Start federated learning edge client")
        print("  fl-sim     - Run federated learning simulation (3 clients + 1 server)")
        print("")
        print("Examples:")
        print("  python main.py server --port 50051")
        print("  python main.py client --server localhost:50051 --camera 0")
        print("  python main.py fl-sim --num-clients 3 --num-rounds 3")
        print("  python main.py fl-server --num-clients 3 --max-rounds 5")
        print("  python main.py fl-client --client-id node-01 --server localhost:50052")
        sys.exit(1)

    command = sys.argv[1]
    args = sys.argv[2:]

    if command == 'server':
        from server.video_server import serve
        sys.argv = ['video_server.py'] + args
        serve()
    elif command == 'client':
        from client.video_client import main as client_main
        sys.argv = ['video_client.py'] + args
        client_main()
    elif command == 'test':
        from client.test_client import main as test_main
        sys.argv = ['test_client.py'] + args
        test_main()
    elif command == 'download':
        from server.download_models import download_models
        download_models()
    elif command == 'fl-server':
        from fl_server import serve
        sys.argv = ['fl_server.py'] + args
        serve()
    elif command == 'fl-client':
        from fl_client import main as fl_client_main
        sys.argv = ['fl_client.py'] + args
        fl_client_main()
    elif command == 'fl-sim':
        from simulation import main as sim_main
        sys.argv = ['simulation.py'] + args
        sim_main()
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == '__main__':
    main()