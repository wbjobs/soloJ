Write-Host "=== 启动前端服务 ===" -ForegroundColor Green
Write-Host ""

$frontendPath = Join-Path $PSScriptRoot "frontend"
Set-Location $frontendPath

if (-not (Test-Path (Join-Path $frontendPath "node_modules"))) {
    Write-Host "安装前端依赖..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

Write-Host "启动 Vite 开发服务器..." -ForegroundColor Green
Write-Host "访问地址: http://localhost:3000" -ForegroundColor Yellow
Write-Host "按 Ctrl+C 停止服务" -ForegroundColor Gray
Write-Host ""

npm run dev
