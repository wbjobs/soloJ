Write-Host "=== 启动后端服务 ===" -ForegroundColor Green
Write-Host ""

$backendPath = Join-Path $PSScriptRoot "backend"
Set-Location $backendPath

Write-Host "检查数据文件..." -ForegroundColor Cyan
$dataPath = Join-Path $backendPath "data"
$lasFiles = Get-ChildItem $dataPath -Filter "*.las" -ErrorAction SilentlyContinue

if ($lasFiles.Count -eq 0) {
    Write-Host "未找到点云数据，正在生成示例数据..." -ForegroundColor Yellow
    $scriptPath = Join-Path $backendPath "scripts\generate_sample_data.py"
    python $scriptPath
    Write-Host ""
}

Write-Host "可用的点云文件:" -ForegroundColor Cyan
Get-ChildItem $dataPath -Filter "*.las" | ForEach-Object {
    Write-Host "  - $($_.Name)" -ForegroundColor White
}
Write-Host ""

Write-Host "启动 FastAPI 服务..." -ForegroundColor Green
Write-Host "API 文档: http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "按 Ctrl+C 停止服务" -ForegroundColor Gray
Write-Host ""

python main.py
