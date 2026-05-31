#!/bin/bash
set -e

GATEWAY_URL=${GATEWAY_URL:-"http://localhost:8080"}
MANAGEMENT_API=${MANAGEMENT_API:-"http://localhost:8082"}

echo "========================================="
echo "Testing Smart AI Gateway"
echo "========================================="

echo ""
echo "[1/5] Testing Gateway Health..."
curl -s "$GATEWAY_URL/" | head -c 100
echo ""

echo ""
echo "[2/5] Testing Management API Health..."
curl -s "$MANAGEMENT_API/api/v1/health"
echo ""

echo ""
echo "[3/5] Testing Emotion Detection Route (POST /upload)..."
curl -s -X POST "$GATEWAY_URL/upload" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@/tmp/test_image.jpg" 2>/dev/null || \
  echo "Test image not found, skipping actual inference test"
echo ""

echo ""
echo "[4/5] Testing Sentiment Analysis Route (POST /analyze)..."
curl -s -X POST "$GATEWAY_URL/analyze" \
  -H "Content-Type: application/json" \
  -d '{"text": "This is a great product!"}'
echo ""

echo ""
echo "[5/5] Getting Inference Statistics..."
curl -s "$MANAGEMENT_API/api/v1/stats/summary"
echo ""

echo ""
echo "========================================="
echo "Tests complete!"
echo "========================================="
