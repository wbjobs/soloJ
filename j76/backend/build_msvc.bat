@echo off
REM ============================================
REM  Fluid Simulation Backend - Build Script
REM  For Windows with MSVC (Visual Studio)
REM ============================================

echo.
echo ============================================
echo   Building Fluid Simulation Backend
echo ============================================
echo.

REM Check for MSVC compiler
where cl.exe >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] MSVC compiler (cl.exe) not found!
    echo.
    echo Please install Visual Studio with C++ development tools,
    echo or run this script from the "Developer Command Prompt for VS".
    echo.
    echo Alternatively, you can use MinGW:
    echo   g++ -std=c++17 -O2 src/main.cpp -o bin/fluid_server.exe -lws2_32
    echo.
    pause
    exit /b 1
)

REM Create bin directory
if not exist "bin" mkdir bin

REM Compile the server
echo [INFO] Compiling with MSVC...
cl.exe /std:c++17 /O2 /EHsc /I"src" /I"src/third_party" src/main.cpp /link /OUT:bin/fluid_server.exe ws2_32.lib

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Compilation failed!
    pause
    exit /b 1
)

REM Clean up object files
del *.obj 2>nul

echo.
echo [SUCCESS] Build complete!
echo.
echo Executable: bin\fluid_server.exe
echo.
echo To start the server, run:
echo   bin\fluid_server.exe
echo.
pause
