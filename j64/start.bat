@echo off
chcp 65001 >nul
echo ========================================
echo    康威生命游戏 - 高并发模拟器
echo ========================================
echo.
echo 正在启动服务器...
echo 服务器将在 http://localhost:3000 启动
echo 按 Ctrl+C 停止服务器
echo.
node server/index.js
pause
