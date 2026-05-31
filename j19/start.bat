@echo off
chcp 65001 >nul
title FPGA Remote Platform - Startup

setlocal enabledelayedexpansion

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"

echo ========================================================
echo   FPGA 远程烧录与在线调试平台  -  Windows 一键启动脚本
echo ========================================================
echo.

REM ---------- 1. 检测 Python ----------
where python >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Python，请先安装 Python 3.10+ 并加入 PATH。
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do set "PY_VER=%%v"
echo [√] Python 已检测: %PY_VER%

REM ---------- 2. 检测 Node ----------
where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 18+ 并加入 PATH。
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version 2^>^&1') do set "NODE_VER=%%v"
echo [√] Node.js 已检测: %NODE_VER%

echo.
echo ---------- 安装后端依赖 ----------
cd /d "%BACKEND_DIR%"
if not exist "requirements.txt" (
    echo [错误] 未找到 backend\requirements.txt
    pause
    exit /b 1
)
python -m pip install --upgrade pip >nul 2>nul
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo [错误] 后端依赖安装失败
    pause
    exit /b 1
)
echo [√] 后端依赖安装完成

echo.
echo ---------- 安装前端依赖 ----------
cd /d "%FRONTEND_DIR%"
if not exist "package.json" (
    echo [错误] 未找到 frontend\package.json
    pause
    exit /b 1
)
call npm install --no-audit --no-fund
if errorlevel 1 (
    echo [错误] 前端依赖安装失败
    pause
    exit /b 1
)
echo [√] 前端依赖安装完成

echo.
echo ---------- 启动后端服务 (后台) ----------
cd /d "%BACKEND_DIR%"
start "FPGA-Backend" /B cmd /k "python app.py"
echo [√] 后端已在新窗口启动: http://localhost:5000

timeout /t 2 /nobreak >nul

echo.
echo ---------- 启动前端服务 (新窗口) ----------
cd /d "%FRONTEND_DIR%"
start "FPGA-Frontend" cmd /k "npm run dev"
echo [√] 前端已在新窗口启动: http://localhost:3000

timeout /t 3 /nobreak >nul

echo.
echo ========================================================
echo   服务启动完成
echo --------------------------------------------------------
echo   前端地址 : http://localhost:3000
echo   后端地址 : http://localhost:5000
echo   默认账号 : admin / admin
echo --------------------------------------------------------
echo   提示: 按任意键将停止所有服务并退出
echo ========================================================
echo.

pause >nul

echo.
echo [*] 正在关闭服务进程 ...

taskkill /fi "windowtitle eq FPGA-Backend" /f >nul 2>nul
taskkill /fi "windowtitle eq FPGA-Frontend" /f >nul 2>nul
taskkill /f /im python.exe /fi "WINDOWTITLE eq *FPGA*" >nul 2>nul
taskkill /f /fi "imagename eq node.exe" /fi "WINDOWTITLE eq FPGA-Frontend" >nul 2>nul

echo [√] 服务已停止，再见。
endlocal
exit /b 0
