@echo off
echo ========================================
echo  LSB Steganography Tool - Startup
echo ========================================
echo.

echo [1/2] Starting Backend Server (port 3001)...
start "Backend Server" cmd /k "cd /d %~dp0backend && npm install && npm start"

timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend Dev Server (port 3000)...
start "Frontend Server" cmd /k "cd /d %~dp0frontend && npm install && npm run dev"

echo.
echo ========================================
echo  Services starting...
echo  Backend:  http://localhost:3001
echo  Frontend: http://localhost:3000
echo ========================================
echo.
pause
