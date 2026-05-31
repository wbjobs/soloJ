#!/bin/bash
echo "========================================"
echo "Quantum Circuit Simulator API"
echo "========================================"

echo ""
echo "Starting Redis server..."
redis-server &
REDIS_PID=$!

sleep 2

echo ""
echo "Starting Celery worker..."
celery -A app.tasks.celery_worker.celery_app worker --loglevel=info &
CELERY_PID=$!

sleep 2

echo ""
echo "Starting FastAPI server..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
API_PID=$!

cleanup() {
    echo ""
    echo "Shutting down services..."
    kill $API_PID 2>/dev/null
    kill $CELERY_PID 2>/dev/null
    kill $REDIS_PID 2>/dev/null
    exit 0
}

trap cleanup INT TERM

wait
