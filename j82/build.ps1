$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Audio Processor - Build Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RustDir = Join-Path $ProjectRoot "rust"
$WebDir = Join-Path $ProjectRoot "web"
$PkgDir = Join-Path $WebDir "pkg"

Write-Host "[1/4] Checking prerequisites..." -ForegroundColor Yellow

try {
    $rustcVersion = rustc --version
    Write-Host "  ✓ Rust installed: $rustcVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Rust not found. Please install from https://rustup.rs/" -ForegroundColor Red
    exit 1
}

try {
    $wasmPackVersion = wasm-pack --version
    Write-Host "  ✓ wasm-pack installed: $wasmPackVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ wasm-pack not found. Installing..." -ForegroundColor Yellow
    cargo install wasm-pack
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ Failed to install wasm-pack. Please install manually: cargo install wasm-pack" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✓ wasm-pack installed successfully" -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/4] Building Rust WebAssembly module..." -ForegroundColor Yellow
Set-Location $RustDir

Write-Host "  Running wasm-pack build..." -ForegroundColor Gray
wasm-pack build --target web --release --out-dir "$PkgDir"

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "  ✓ WebAssembly build completed" -ForegroundColor Green

Write-Host ""
Write-Host "[3/4] Cleaning up generated files..." -ForegroundColor Yellow

$filesToRemove = @(
    Join-Path $PkgDir ".gitignore",
    Join-Path $PkgDir "package.json",
    Join-Path $PkgDir "README.md"
)

foreach ($file in $filesToRemove) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "  Removed: $(Split-Path $file -Leaf)" -ForegroundColor Gray
    }
}

Write-Host "  ✓ Cleanup completed" -ForegroundColor Green

Write-Host ""
Write-Host "[4/4] Verifying output..." -ForegroundColor Yellow

$expectedFiles = @(
    Join-Path $PkgDir "audio_processor.js",
    Join-Path $PkgDir "audio_processor_bg.wasm",
    Join-Path $PkgDir "audio_processor_bg.wasm.d.ts",
    Join-Path $PkgDir "audio_processor.d.ts"
)

$allFound = $true
foreach ($file in $expectedFiles) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $sizeKB = [math]::Round($size / 1KB, 2)
        Write-Host "  ✓ $(Split-Path $file -Leaf) ($sizeKB KB)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $(Split-Path $file -Leaf) not found!" -ForegroundColor Red
        $allFound = $false
    }
}

if (-not $allFound) {
    Write-Host ""
    Write-Host "Build completed with missing files!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Build completed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To run the application:" -ForegroundColor Yellow
Write-Host "  1. Start a local HTTP server in the 'web' directory" -ForegroundColor Gray
Write-Host "  2. For example, run: python -m http.server 8080" -ForegroundColor Gray
Write-Host "  3. Open http://localhost:8080 in your browser" -ForegroundColor Gray
Write-Host ""
Write-Host "Or use the provided serve script: .\serve.ps1" -ForegroundColor Cyan
Write-Host ""
