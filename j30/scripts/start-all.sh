#!/bin/bash
set -e

echo "========================================="
echo "Starting Smart AI Gateway"
echo "========================================="

echo ""
echo "Starting management API..."
cd management-api && npm install && npm start &

echo ""
echo "Waiting for management API to start..."
sleep 3

echo ""
echo "Starting Envoy gateway..."
cd ..
docker-compose up -d envoy

echo ""
echo "========================================="
echo "Services started!"
echo ""
echo "Gateway:         http://localhost:8080"
echo "Envoy Admin:     http://localhost:9901"
echo "Management API:  http://localhost:8082"
echo "Prometheus:      http://localhost:9090"
echo "Grafana:         http://localhost:3000 (admin/admin)"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop: docker-compose down"
echo "========================================="
