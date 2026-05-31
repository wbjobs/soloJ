@echo off
echo Starting 4 Worker nodes with different speeds...
echo.
echo Worker 0: Normal speed (factor=1.0)
echo Worker 1: Slow speed (factor=3.0)
echo Worker 2: Fast speed (factor=0.5)
echo Worker 3: Very fast (factor=0.3)
echo.

start "Worker 0 - Normal" cmd /k "python worker.py 0 1.0"
timeout /t 1 /nobreak >nul

start "Worker 1 - Slow" cmd /k "python worker.py 1 3.0"
timeout /t 1 /nobreak >nul

start "Worker 2 - Fast" cmd /k "python worker.py 2 0.5"
timeout /t 1 /nobreak >nul

start "Worker 3 - Very Fast" cmd /k "python worker.py 3 0.3"

echo.
echo All 4 Workers started with different speed factors!
echo Open http://localhost:5000 to view the dashboard.
pause
