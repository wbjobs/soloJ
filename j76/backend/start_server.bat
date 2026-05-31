@echo off
REM ============================================
REM  Start Fluid Simulation Backend Server
REM ============================================

cd /d "%~dp0"

if not exist "bin\fluid_server.exe" (
    echo [ERROR] Server executable not found!
    echo.
    echo Please build the server first using one of the build scripts:
    echo   - build_msvc.bat    (For Visual Studio)
    echo   - build_mingw.bat   (For MinGW)
    echo   - build_cmake.bat   (For CMake)
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Fluid Simulation Backend Server
echo ============================================
echo.
echo Starting server on http://localhost:8080
echo.
echo API Endpoints:
echo   GET /api/health
echo   GET /api/fluid/params
echo.
echo Press Ctrl+C to stop the server.
echo ============================================
echo.

bin\fluid_server.exe
