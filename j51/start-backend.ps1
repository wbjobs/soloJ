# Start Go Backend Server

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting DICOM Backend Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Set-Location backend

Write-Host "`nDownloading dependencies..." -ForegroundColor Green
go mod tidy

Write-Host "`nStarting server on http://localhost:8080..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Yellow

go run main.go
