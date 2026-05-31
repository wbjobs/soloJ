#!/bin/bash
set -e

echo "Building Smart AI Gateway Wasm module..."

if [ -f "./WORKSPACE" ]; then
    echo "Using Bazel build system..."
    bazel build //:ai_gateway_filter --define=enable_gpu=false
    echo "Build complete. Output: bazel-bin/ai_gateway_filter.wasm"
else
    echo "Bazel WORKSPACE not found, using CMake..."
    
    if [ ! -d "build" ]; then
        mkdir build
    fi
    
    cd build
    cmake .. -DENABLE_GPU=OFF
    make -j$(nproc)
    echo "Build complete. Output: ai_gateway_filter.wasm"
fi
