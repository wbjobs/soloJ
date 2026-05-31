$ErrorActionPreference = "Stop"

Write-Host "Building Rust WebAssembly library..." -ForegroundColor Cyan

Set-Location "$PSScriptRoot\..\dicom-parser"

if (-not (Get-Command "wasm-pack" -ErrorAction SilentlyContinue)) {
    Write-Host "wasm-pack not found, installing..." -ForegroundColor Yellow
    cargo install wasm-pack
}

wasm-pack build --target web --release

if ($LASTEXITCODE -ne 0) {
    Write-Host "WASM build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Copying WASM files to frontend..." -ForegroundColor Cyan
$pkgDir = "$PSScriptRoot\..\dicom-parser\pkg"
$frontendPkgDir = "$PSScriptRoot\..\frontend\src\pkg"

if (Test-Path $frontendPkgDir) {
    Remove-Item -Recurse -Force $frontendPkgDir
}

Copy-Item -Recurse $pkgDir $frontendPkgDir

Write-Host "WASM build completed successfully!" -ForegroundColor Green
