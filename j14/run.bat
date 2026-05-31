@echo off
chcp 65001 > nul
echo ============================================
echo   ODE 符号求解引擎 - 启动脚本
echo ============================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Python，请先安装 Python 3.9+
    pause
    exit /b 1
)

echo [1/3] 检查依赖...
python -c "import flask, sympy" 2>nul
if errorlevel 1 (
    echo [安装] 首次运行，正在安装依赖...
    python -m pip install -r requirements.txt
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo [OK] 依赖已就绪
)

echo.
echo [2/3] 可选：启动 Redis（如需缓存功能）
echo       请确保 redis-server 已启动，或设置 REDIS_ENABLED=true
echo       当前默认 REDIS_ENABLED=false（使用内存模式）
echo.

echo [3/3] 启动 Web 服务...
echo       访问 http://127.0.0.1:5000
echo.
python app.py
pause
