@echo off
REM ============================================
REM  Fluid Simulation Backend - Build Script
REM  For Windows with MinGW (g++)
REM ============================================

echo.
echo ============================================
echo   Building Fluid Simulation Backend (MinGW)
echo ============================================
echo.

REM Check for g++ compiler
where g++.exe >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] MinGW compiler (g++.exe) not found!
    echo.
    echo Please install MinGW-w64 and add it to PATH.
    echo Download from: https://www.mingw-w64.org/
    echo.
    echo Or install via winget:
    echo   winget install -e --id "GCC.gcc"
    echo.
    pause
    exit /b 1
)

REM Create bin directory
if not exist "bin" mkdir bin

REM Compile the server
echo [INFO] Compiling with MinGW g++...
g++.exe -std=c++17 -O2 -I"src" -I"src/third_party" src/main.cpp -o bin/fluid_server.exe -lws2_32 -static-libgcc -static-libstdc++

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Compilation failed!
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Build complete!
echo.
echo Executable: bin\fluid_server.exe
echo.
echo To start the server, run:
echo   bin\fluid_server.exe
echo.
pause
