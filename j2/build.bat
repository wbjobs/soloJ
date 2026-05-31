@echo off
echo Building FastProto TCP Server...

if not exist bin mkdir bin

echo Building server...
go build -o bin\server.exe .\server
if errorlevel 1 (
    echo Server build failed!
    exit /b 1
)

echo Building client...
go build -o bin\client.exe .\client
if errorlevel 1 (
    echo Client build failed!
    exit /b 1
)

echo Build complete!
echo.
echo Run server: bin\server.exe
echo Run client: bin\client.exe -c 100 -n 1000
