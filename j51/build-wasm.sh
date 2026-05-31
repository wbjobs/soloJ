#!/bin/bash

echo "========================================"
echo "Building DICOM WASM Module"
echo "========================================"

set -e

if ! command -v wasm-pack &> /dev/null; then
    echo "wasm-pack not found. Installing..."
    cargo install wasm-pack
fi

cd wasm

echo ""
echo "Building WASM with wasm-pack..."
wasm-pack build --target web --release

echo ""
echo "Copying WASM files to frontend..."

rm -rf ../frontend/pkg
cp -r ./pkg ../frontend/pkg

echo ""
echo "========================================"
echo "Build completed successfully!"
echo "WASM files copied to frontend/pkg"
echo "========================================"
