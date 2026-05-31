import os
import subprocess
import sys

PROTO_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "proto")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "grpc_gen")


def generate_grpc_code():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    proto_file = os.path.join(PROTO_DIR, "modbus.proto")
    
    if not os.path.exists(proto_file):
        print(f"Error: Proto file not found at {proto_file}")
        sys.exit(1)

    cmd = [
        sys.executable,
        "-m",
        "grpc_tools.protoc",
        f"--proto_path={PROTO_DIR}",
        f"--python_out={OUTPUT_DIR}",
        f"--grpc_python_out={OUTPUT_DIR}",
        "modbus.proto",
    ]

    print(f"Generating gRPC code from {proto_file}...")
    print(f"Command: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print("gRPC code generated successfully!")
        print(f"Output directory: {OUTPUT_DIR}")
        
        init_file = os.path.join(OUTPUT_DIR, "__init__.py")
        with open(init_file, "w") as f:
            f.write("# Auto-generated gRPC code\n")
            f.write("from . import modbus_pb2\n")
            f.write("from . import modbus_pb2_grpc\n")
            f.write("\n")
            f.write("__all__ = ['modbus_pb2', 'modbus_pb2_grpc']\n")
            
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error generating gRPC code: {e}")
        print(f"Stdout: {e.stdout}")
        print(f"Stderr: {e.stderr}")
        return False


if __name__ == "__main__":
    success = generate_grpc_code()
    sys.exit(0 if success else 1)
