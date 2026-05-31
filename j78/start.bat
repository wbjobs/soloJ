@echo off
chcp 65001 >nul
echo ========================================
echo   威胁情报知识图谱系统 - 启动脚本
echo ========================================
echo.

echo [1/4] 检查 Python 环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Python，请先安装 Python 3.8+
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)
echo [✓] Python 环境正常
echo.

echo [2/4] 检查 Neo4j 连接配置...
if not exist "backend\.env" (
    echo [警告] 未找到 .env 配置文件，将使用默认配置
    echo 请确保 Neo4j 已启动并运行在 bolt://localhost:7687
) else (
    echo [✓] 找到 .env 配置文件
)
echo.

echo [3/4] 安装依赖（首次运行需要）...
cd backend
pip install -r requirements.txt -q
if errorlevel 1 (
    echo [警告] 依赖安装可能遇到问题，请手动执行: pip install -r requirements.txt
)
python -m spacy download en_core_web_sm -q
if errorlevel 1 (
    echo [警告] SpaCy 模型下载可能遇到问题
)
cd ..
echo [✓] 依赖检查完成
echo.

echo [4/4] 启动 Flask 应用...
echo.
echo ========================================
echo   服务启动中，请稍候...
echo   前端地址: http://localhost:5000
echo   API 文档: 请参考 README.md
echo ========================================
echo.
echo [提示] 按 Ctrl+C 停止服务
echo.

cd backend
python app.py

pause
