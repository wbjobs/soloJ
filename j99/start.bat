@echo off
chcp 65001 >nul
echo ========================================
echo   Code RAG 代码问答系统 启动脚本
echo ========================================
echo.

if not exist ".env" (
    echo [INFO] 未检测到 .env 文件，从模板复制...
    copy .env.example .env
    echo [INFO] 请编辑 .env 文件配置你的 API Key 等参数，然后重新运行。
    echo.
)

echo [INFO] 加载环境变量...
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if not "%%a"=="" if not "%%a:~0,1%"=="#" (
        set "%%a=%%b"
    )
)

echo [INFO] 启动服务...
echo [INFO] 访问 http://localhost:8000
echo.
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
