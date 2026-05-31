@echo off
REM ============================================
REM  Start Fluid Simulation Frontend Dev Server
REM ============================================

cd /d "%~dp0\frontend"

echo.
echo ============================================
echo   Fluid Simulation - Frontend Dev Server
echo ============================================
echo.
echo Starting Vite dev server...
echo.

npm run dev
