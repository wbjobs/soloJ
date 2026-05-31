# Start Frontend Dev Server

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Frontend HTTP Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$port = 8000

Set-Location frontend

Write-Host "`nStarting HTTP server on http://localhost:$port..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Yellow

python -m http.server $port
