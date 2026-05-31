@echo off
echo ========================================
echo Quantum Circuit Simulator API
echo ========================================

echo.
echo Starting Redis server...
start "Redis" cmd /k "redis-server"

timeout /t 3 /nobreak >nul

echo.
echo Starting Celery worker...
start "Celery Worker" cmd /k "celery -A app.tasks.celery_worker.celery_app worker --loglevel=info --pool=solo"

timeout /t 3 /nobreak >nul

echo.
echo Starting FastAPI server...
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
