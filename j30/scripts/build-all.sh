#!/bin/bash
set -e

echo "========================================="
echo "Building Smart AI Gateway Components"
echo "========================================="

echo ""
echo "[1/3] Building Wasm module..."
cd wasm && bash scripts/build_wasm.sh && cd ..

echo ""
echo "[2/3] Building Envoy Docker image..."
docker build -t ai-gateway-envoy -f docker/envoy.Dockerfile .

echo ""
echo "[3/3] Building Management API Docker image..."
docker build -t ai-gateway-management-api -f docker/management-api.Dockerfile .

echo ""
echo "========================================="
echo "Build complete!"
echo "Run 'docker-compose up' to start all services."
echo "========================================="
