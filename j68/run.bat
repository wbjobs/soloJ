@echo off
echo ========================================
echo  本地文档语义搜索助手
echo ========================================
echo.
echo [1/3] 检查 Python 环境...
python --version
if errorlevel 1 (
    echo 错误: 未找到 Python，请先安装 Python 3.8+
    pause
    exit /b 1
)

echo.
echo [2/3] 检查并安装依赖...
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo 错误: 依赖安装失败
    pause
    exit /b 1
)

echo.
echo [3/3] 启动服务...
echo 服务将在 http://localhost:8000 启动
echo 按 Ctrl+C 停止服务
echo.
cd backend
python main.py
