@echo off
cd /d "%~dp0frontend"
if not exist node_modules (
    echo Installing dependencies...
    npm install
)
echo Starting RAG frontend server...
npm run dev
