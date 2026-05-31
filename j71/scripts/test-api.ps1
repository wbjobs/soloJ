$ErrorActionPreference = "Stop"

Write-Host "Testing DICOM Audit API..." -ForegroundColor Cyan

$baseUrl = "http://localhost:8000"

try {
    Write-Host "`n1. Health check..." -ForegroundColor Yellow
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "   Status: $($health.status)" -ForegroundColor Green

    Write-Host "`n2. Root endpoint..." -ForegroundColor Yellow
    $root = Invoke-RestMethod -Uri "$baseUrl/" -Method Get
    Write-Host "   Name: $($root.name)" -ForegroundColor Green
    Write-Host "   Version: $($root.version)" -ForegroundColor Green

    Write-Host "`n3. Create audit log (POST /api/audit)..." -ForegroundColor Yellow
    $auditData = @{
        patient_name = "张三"
        patient_id = "P12345678"
        patient_birth_date = "1990-01-15"
        patient_sex = "M"
        study_date = "2024-01-20"
        study_time = "10:30:00"
        accession_number = "ACC-2024-00123"
        institution_name = "XX市第一人民医院"
        referring_physician = "李医生"
        study_description = "胸部CT平扫"
        series_description = "轴位"
        modality = "CT"
        manufacturer = "GE Healthcare"
    } | ConvertTo-Json

    $headers = @{
        "Content-Type" = "application/json"
    }

    $createResponse = Invoke-RestMethod -Uri "$baseUrl/api/audit" -Method Post -Body $auditData -Headers $headers
    Write-Host "   Created audit log ID: $($createResponse.id)" -ForegroundColor Green
    Write-Host "   Patient name hash: $($createResponse.patient_name_hash.Substring(0, 20))..." -ForegroundColor Green
    Write-Host "   Patient ID hash: $($createResponse.patient_id_hash.Substring(0, 20))..." -ForegroundColor Green
    Write-Host "   Created at: $($createResponse.created_at)" -ForegroundColor Green

    Write-Host "`n4. Get audit log by ID (GET /api/audit/$($createResponse.id))..." -ForegroundColor Yellow
    $getResponse = Invoke-RestMethod -Uri "$baseUrl/api/audit/$($createResponse.id)" -Method Get
    Write-Host "   Retrieved audit log ID: $($getResponse.id)" -ForegroundColor Green

    Write-Host "`n5. List all audit logs (GET /api/audit)..." -ForegroundColor Yellow
    $listResponse = Invoke-RestMethod -Uri "$baseUrl/api/audit?page=1&limit=10" -Method Get
    Write-Host "   Total records: $($listResponse.total)" -ForegroundColor Green
    Write-Host "   Page: $($listResponse.page), Limit: $($listResponse.limit)" -ForegroundColor Green
    Write-Host "   Logs count: $($listResponse.logs.Count)" -ForegroundColor Green

    Write-Host "`n=== All tests passed! ===" -ForegroundColor Green
}
catch {
    Write-Host "`nTest failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody" -ForegroundColor Red
    }
    exit 1
}
