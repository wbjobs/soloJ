$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$WebDir = Join-Path $ProjectRoot "web"
$Port = 8080

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Audio Processor - Local Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$pkgDir = Join-Path $WebDir "pkg"
$wasmFile = Join-Path $pkgDir "audio_processor_bg.wasm"
if (-not (Test-Path $wasmFile)) {
    Write-Host "Warning: WebAssembly module not found!" -ForegroundColor Yellow
    Write-Host "Please run build script first: .\build.ps1" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Starting HTTP server on port $Port..." -ForegroundColor Yellow
Write-Host "Web root: $WebDir" -ForegroundColor Gray
Write-Host ""
Write-Host "Available URLs:" -ForegroundColor Green
Write-Host "  http://localhost:$Port" -ForegroundColor Cyan
Write-Host "  http://127.0.0.1:$Port" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

$pythonCmd = $null
if (Get-Command "python" -ErrorAction SilentlyContinue) {
    $pythonVersion = python --version 2>&1
    if ($pythonVersion -match "Python 3") {
        $pythonCmd = "python"
    }
}
if (-not $pythonCmd -and (Get-Command "python3" -ErrorAction SilentlyContinue)) {
    $pythonCmd = "python3"
}

Set-Location $WebDir

if ($pythonCmd) {
    Write-Host "Using Python HTTP server..." -ForegroundColor Gray
    & $pythonCmd -m http.server $Port
} else {
    Write-Host "Python not found, attempting to use Node.js http-server..." -ForegroundColor Yellow
    
    if (Get-Command "npx" -ErrorAction SilentlyContinue) {
        & npx http-server -p $Port -c-1
    } else {
        Write-Host ""
        Write-Host "Error: No HTTP server available!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install one of the following:" -ForegroundColor Yellow
        Write-Host "  1. Python 3: https://www.python.org/downloads/" -ForegroundColor Gray
        Write-Host "  2. Node.js: https://nodejs.org/" -ForegroundColor Gray
        Write-Host ""
        Write-Host "After installation, run this script again." -ForegroundColor Yellow
        exit 1
    }
}
