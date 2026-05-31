@echo off
echo Stopping all services...

taskkill /fi "WINDOWTITLE eq Julia FEM Server*" /f 2>nul
taskkill /fi "WINDOWTITLE eq RQ Worker*" /f 2>nul
taskkill /fi "WINDOWTITLE eq Optimizer API*" /f 2>nul
taskkill /fi "WINDOWTITLE eq Frontend Dev*" /f 2>nul

docker-compose down

echo All services stopped.
