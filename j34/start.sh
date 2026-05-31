#!/bin/bash
echo "============================================"
echo " Acoustic Metamaterial Inverse Design System"
echo "============================================"
echo ""

echo "[1/5] Starting Docker services (Redis + InfluxDB)..."
docker-compose up -d
sleep 5

echo "[2/5] Starting Julia FEM server on port 8081..."
(cd backend && julia --project=. src/server.jl) &
FEM_PID=$!

echo "[3/5] Starting RQ Worker..."
(cd worker && python run_worker.py) &
WORKER_PID=$!

echo "[4/5] Starting Python Optimizer API on port 8082..."
(cd optimizer && python src/api_server.py) &
OPT_PID=$!

echo "[5/5] Starting Svelte Frontend on port 5173..."
(cd frontend && npm run dev) &
FRONT_PID=$!

echo ""
echo "All services started!"
echo "  - Frontend:        http://localhost:5173"
echo "  - Optimizer API:   http://localhost:8082"
echo "  - Julia FEM:       http://localhost:8081"
echo "  - InfluxDB:        http://localhost:8086"
echo "  - Redis:           localhost:6379"
echo ""

trap "kill $FEM_PID $WORKER_PID $OPT_PID $FRONT_PID 2>/dev/null; docker-compose down; exit" INT TERM
wait
