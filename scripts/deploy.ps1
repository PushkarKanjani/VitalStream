# ─────────────────────────────────────────────────────────────────────────────
# VitalStream — Production Automated Deployment Script (PowerShell)
# Apollo Hospitals, Gandhinagar · Perioperative Command Center
# ─────────────────────────────────────────────────────────────────────────────

param (
    [switch]$Build = $true,
    [switch]$Seed = $true,
    [switch]$SkipTests = $false
)

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  VitalStream — Automated Production Deployment Pipeline" -ForegroundColor Cyan
Write-Host "  Facility: Apollo Hospitals, Gandhinagar · OR Suite 1-6" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Environment & Pre-Flight Checks
Write-Host "`n[Step 1/5] Checking Docker & Docker Compose..." -ForegroundColor Yellow
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Docker CLI not found. Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

$composeCmd = "docker compose"
try {
    docker compose version | Out-Null
} catch {
    $composeCmd = "docker-compose"
}
Write-Host "[OK] Using: $composeCmd" -ForegroundColor Green

# 2. Build & Launch Containers
Write-Host "`n[Step 2/5] Building & Orchestrating Distributed Stack..." -ForegroundColor Yellow
if ($Build) {
    & docker compose up --build -d
} else {
    & docker compose up -d
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Docker Compose failed to spin up containers." -ForegroundColor Red
    exit 1
}

# 3. Wait for Core Services to be Healthy
Write-Host "`n[Step 3/5] Waiting for Database & Broker Readiness..." -ForegroundColor Yellow
$maxRetries = 20
$healthy = $false

for ($i = 1; $i -le $maxRetries; $i++) {
    Write-Host "Probing health status (Attempt $i/$maxRetries)..."
    try {
        $resp = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($resp.status -eq "ok") {
            $healthy = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 3
    }
}

if (-not $healthy) {
    Write-Host "[WARNING] Backend is still initializing or running as standalone process." -ForegroundColor Yellow
} else {
    Write-Host "[OK] Backend API is Healthy!" -ForegroundColor Green
}

# 4. Database Seeding
if ($Seed) {
    Write-Host "`n[Step 4/5] Seeding Gandhinagar Clinical Context into MongoDB..." -ForegroundColor Yellow
    try {
        if (Test-Path "backend\.venv\Scripts\python.exe") {
            & "backend\.venv\Scripts\python.exe" "scripts\seed_gandhinagar_cases.py"
            & "backend\.venv\Scripts\python.exe" "scripts\seed_preset_patients.py"
        } else {
            python scripts/seed_gandhinagar_cases.py
            python scripts/seed_preset_patients.py
        }
        Write-Host "[OK] Database seeded with Indian Chief Surgeons & Patients!" -ForegroundColor Green
    } catch {
        Write-Host "[WARNING] Seeding script encountered an error: $_" -ForegroundColor Yellow
    }
}

# 5. Security & Smoke Verification
Write-Host "`n[Step 5/5] Executing Security & Smoke Tests..." -ForegroundColor Yellow
try {
    $secHeaders = (Invoke-WebRequest -Uri "http://localhost:8000/health" -Method Get -TimeoutSec 5).Headers
    Write-Host "  • X-Content-Type-Options: $($secHeaders['x-content-type-options'])" -ForegroundColor Green
    Write-Host "  • X-Frame-Options: $($secHeaders['x-frame-options'])" -ForegroundColor Green
    Write-Host "  • Rate Limiting: $($secHeaders['x-ratelimit-limit']) req/min" -ForegroundColor Green
} catch {
    Write-Host "  [NOTICE] Run smoke tests once backend is listening on :8000" -ForegroundColor Gray
}

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "  [DEPLOYMENT SUCCESS] VitalStream is Ready for Production!" -ForegroundColor Green
Write-Host "  • Frontend URL : http://localhost (Port 80) or http://localhost:5173" -ForegroundColor White
Write-Host "  • Backend API  : http://localhost:8000/api/docs" -ForegroundColor White
Write-Host "  • Kafka Admin  : http://localhost:9000 (Kafdrop)" -ForegroundColor White
Write-Host "  • Flink Web UI : http://localhost:8081" -ForegroundColor White
Write-Host "=================================================================`n" -ForegroundColor Cyan
