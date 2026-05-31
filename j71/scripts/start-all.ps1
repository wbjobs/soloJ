$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  DICOM 医学影像解析系统 - 一键启动" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

Write-Host "`nChecking prerequisites..." -ForegroundColor Yellow

$dockerOk = $false
try {
    docker --version | Out-Null
    $dockerOk = $true
    Write-Host "  ✓ Docker found" -ForegroundColor Green
}
catch {
    Write-Host "  ✗ Docker not found" -ForegroundColor Red
}

if ($dockerOk) {
    Write-Host "`nStarting services with Docker Compose..." -ForegroundColor Cyan
    Set-Location "$PSScriptRoot\.."
    docker-compose up --build
}
else {
    Write-Host "`nDocker not available. Please install Docker and run:" -ForegroundColor Yellow
    Write-Host "  docker-compose up --build" -ForegroundColor Cyan
    Write-Host "`nOr start services manually using:" -ForegroundColor Yellow
    Write-Host "  1. .\scripts\start-backend.ps1" -ForegroundColor Cyan
    Write-Host "  2. .\scripts\start-frontend.ps1" -ForegroundColor Cyan
}
