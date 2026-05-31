@echo off
echo Starting 4 Worker nodes...

start "Worker 0" cmd /k "python worker.py 0"
timeout /t 1 /nobreak >nul

start "Worker 1" cmd /k "python worker.py 1"
timeout /t 1 /nobreak >nul

start "Worker 2" cmd /k "python worker.py 2"
timeout /t 1 /nobreak >nul

start "Worker 3" cmd /k "python worker.py 3"

echo All 4 Workers started!
pause
