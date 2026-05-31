$env:PATH = "C:\Users\Lenovo\.cargo\bin;C:\msys64\mingw64\bin;$env:PATH"
$env:RUSTUP_DIST_SERVER = "https://mirrors.ustc.edu.cn/rust-static"
$env:RUSTUP_UPDATE_ROOT = "https://mirrors.ustc.edu.cn/rust-static/rustup"
$env:GIT_SSL_NO_VERIFY = "1"
$env:HTTPS_PROXY = ""
$env:HTTP_PROXY = ""

Write-Host "=== Building LSB Stego WASM Module ===" -ForegroundColor Cyan

Write-Host "Step 1: Compiling Rust to WASM..." -ForegroundColor Yellow
cargo +nightly-x86_64-pc-windows-gnu build --target wasm32-unknown-unknown --release
if ($LASTEXITCODE -ne 0) {
    Write-Host "Cargo build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Step 2: Generating JS bindings with wasm-bindgen..." -ForegroundColor Yellow
if (-not (Get-Command wasm-bindgen -ErrorAction SilentlyContinue)) {
    Write-Host "Installing wasm-bindgen-cli..." -ForegroundColor Yellow
    cargo install wasm-bindgen-cli --version 0.2.122
}

New-Item -ItemType Directory -Path "frontend\pkg" -Force | Out-Null
wasm-bindgen --target web --out-dir frontend\pkg target\wasm32-unknown-unknown\release\lsb_stego.wasm

if ($LASTEXITCODE -eq 0) {
    Write-Host "=== WASM build successful! ===" -ForegroundColor Green
    Write-Host "Output: frontend/pkg/" -ForegroundColor Green
} else {
    Write-Host "=== WASM build failed! ===" -ForegroundColor Red
    exit 1
}
