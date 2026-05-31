# DICOM WASM Build Script
# Requires: Rust, wasm-pack

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building DICOM WASM Module" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"

# Check if wasm-pack is installed
if (-not (Get-Command "wasm-pack" -ErrorAction SilentlyContinue)) {
    Write-Host "wasm-pack not found. Installing..." -ForegroundColor Yellow
    cargo install wasm-pack
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install wasm-pack. Please install manually:" -ForegroundColor Red
        Write-Host "cargo install wasm-pack" -ForegroundColor Red
        exit 1
    }
}

Set-Location wasm

Write-Host "`nBuilding WASM with wasm-pack..." -ForegroundColor Green
wasm-pack build --target web --release

if ($LASTEXITCODE -ne 0) {
    Write-Host "WASM build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nCopying WASM files to frontend..." -ForegroundColor Green

if (Test-Path "../frontend/pkg") {
    Remove-Item -Recurse -Force "../frontend/pkg"
}

Copy-Item -Recurse "./pkg" "../frontend/pkg"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Build completed successfully!" -ForegroundColor Green
Write-Host "WASM files copied to frontend/pkg" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
