param(
    [string]$OutputDir = "..\bin"
)

$ErrorActionPreference = "Stop"

$BackendDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Go not found in PATH" -ForegroundColor Red
    exit 1
}

Set-Location $BackendDir

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

Write-Host "Building backend server..." -ForegroundColor Cyan
go build -o "$OutputDir\server.exe" ./cmd/server

Write-Host "Build complete: $OutputDir\server.exe" -ForegroundColor Green
