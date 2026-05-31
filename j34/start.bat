@echo off
echo ============================================
echo  Acoustic Metamaterial Inverse Design System
echo ============================================
echo.

echo [1/5] Starting Docker services (Redis + InfluxDB)...
docker-compose up -d
timeout /t 5 /nobreak >nul

echo [2/5] Starting Julia FEM server on port 8081...
start "Julia FEM Server" cmd /k "cd /d %~dp0backend && julia --project=. src/server.jl"

echo [3/5] Starting RQ Worker...
start "RQ Worker" cmd /k "cd /d %~dp0worker && python run_worker.py"

echo [4/5] Starting Python Optimizer API on port 8082...
start "Optimizer API" cmd /k "cd /d %~dp0optimizer && python src/api_server.py"

echo [5/5] Starting Svelte Frontend on port 5173...
start "Frontend Dev" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo All services started!
echo   - Frontend:        http://localhost:5173
echo   - Optimizer API:   http://localhost:8082
echo   - Julia FEM:       http://localhost:8081
echo   - InfluxDB:        http://localhost:8086
echo   - Redis:           localhost:6379
echo.
pause
