param(
    [string]$BuildDir = "build",
    [string]$OutputDir = "../frontend/src/wasm"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command emcmake -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Emscripten not found. Please install and activate emsdk." -ForegroundColor Red
    Write-Host "See: https://emscripten.org/docs/getting_started/downloads.html" -ForegroundColor Yellow
    exit 1
}

$WasmDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $WasmDir

if (Test-Path $BuildDir) {
    Remove-Item -Recurse -Force $BuildDir
}
New-Item -ItemType Directory -Path $BuildDir | Out-Null

Write-Host "Configuring WASM build..." -ForegroundColor Cyan
Set-Location $BuildDir
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release

Write-Host "Building WASM module..." -ForegroundColor Cyan
cmake --build . --config Release

Write-Host "Copying output to frontend..." -ForegroundColor Cyan
$files = @("audio_fingerprint.js", "audio_fingerprint.wasm")
foreach ($f in $files) {
    $src = Join-Path $WasmDir $BuildDir $f
    $dst = Join-Path $WasmDir $OutputDir $f
    if (Test-Path $src) {
        Copy-Item -Force $src $dst
        Write-Host "  Copied: $f" -ForegroundColor Green
    } else {
        Write-Host "  Warning: $f not found in build output" -ForegroundColor Yellow
    }
}

Write-Host "`nWASM build completed successfully!" -ForegroundColor Green
