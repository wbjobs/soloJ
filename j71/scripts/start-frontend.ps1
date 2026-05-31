$ErrorActionPreference = "Stop"

Write-Host "Starting React frontend..." -ForegroundColor Cyan

Set-Location "$PSScriptRoot\..\frontend"

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host "Starting development server on port 3000..." -ForegroundColor Green
npm start
