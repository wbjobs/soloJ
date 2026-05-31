@echo off
REM ============================================
REM  Fluid Simulation Backend - CMake Build Script
REM ============================================

echo.
echo ============================================
echo   Building Fluid Simulation Backend (CMake)
echo ============================================
echo.

REM Check for CMake
where cmake.exe >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] CMake not found!
    echo.
    echo Please install CMake from: https://cmake.org/download/
    echo Or install via winget:
    echo   winget install -e --id "Kitware.CMake"
    echo.
    pause
    exit /b 1
)

REM Create build directory
if not exist "build" mkdir build

REM Configure and build
cd build
echo [INFO] Running CMake configuration...
cmake .. -DCMAKE_BUILD_TYPE=Release

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] CMake configuration failed!
    cd ..
    pause
    exit /b 1
)

echo.
echo [INFO] Building project...
cmake --build . --config Release

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed!
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo [SUCCESS] Build complete!
echo.
echo Executable: bin\fluid_server.exe
echo.
pause
