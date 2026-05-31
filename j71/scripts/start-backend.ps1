$ErrorActionPreference = "Stop"

Write-Host "Starting FastAPI backend..." -ForegroundColor Cyan

Set-Location "$PSScriptRoot\..\backend"

if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv .venv
}

Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& .venv\Scripts\Activate.ps1

Write-Host "Installing dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt

$env:DATABASE_URL = "postgresql://dicom_user:dicom_password@localhost:5432/dicom_audit"

Write-Host "Starting Uvicorn server on port 8000..." -ForegroundColor Green
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
