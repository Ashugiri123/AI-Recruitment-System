# ==============================================================================
# AI Recruitment + Interview System -- Presentation Launcher
# ==============================================================================
# Usage: Execute from PowerShell: .\start_demo.ps1
# Starts: 1. Flask (Port 5000) | 2. FastAPI (Port 8001) | 3. Vite Frontend (Port 3000)

$repoRoot = (Get-Item -Path ".").FullName

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "        AI RECRUITMENT & INTERVIEW SYSTEM LAUNCHER                    " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] Running pre-flight environment checks..." -ForegroundColor Yellow

$pkgPath = "$repoRoot\package.json"
$appPath = "$repoRoot\backend\app.py"
$mainPath = "$repoRoot\backend\main.py"
$envPath = "$repoRoot\backend\.env"

if (-not (Test-Path $pkgPath)) {
    Write-Host "[ERROR] package.json not found in repository root ($repoRoot)." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $appPath)) {
    Write-Host "[ERROR] backend\app.py missing!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $mainPath)) {
    Write-Host "[ERROR] backend\main.py missing!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $envPath)) {
    Write-Host "[ERROR] backend\.env file not found!" -ForegroundColor Red
    Write-Host "   Please copy backend\.env.template to backend\.env and configure GROQ_API_KEY." -ForegroundColor Yellow
    exit 1
}

$pythonCmd = "python"
if (Test-Path "$repoRoot\venv311\Scripts\python.exe") {
    $pythonCmd = "$repoRoot\venv311\Scripts\python.exe"
    Write-Host "   [OK] Found Python venv: venv311" -ForegroundColor Green
}
if (Test-Path "$repoRoot\venv\Scripts\python.exe") {
    $pythonCmd = "$repoRoot\venv\Scripts\python.exe"
    Write-Host "   [OK] Found Python venv: venv" -ForegroundColor Green
}
if (Test-Path "$repoRoot\.venv\Scripts\python.exe") {
    $pythonCmd = "$repoRoot\.venv\Scripts\python.exe"
    Write-Host "   [OK] Found Python venv: .venv" -ForegroundColor Green
}

Write-Host "   [OK] Pre-flight checks passed." -ForegroundColor Green
Write-Host ""

$backendDir = "$repoRoot\backend"

# Launch Flask (Port 5000)
Write-Host "[2/4] Launching Flask Resume Analysis Service (Port 5000)..." -ForegroundColor Cyan
$flaskCmd = "Set-Location '$backendDir'; `$env:PYTHONUTF8='1'; Write-Host '--- FLASK RESUME SERVICE (PORT 5000) ---' -ForegroundColor Green; & '$pythonCmd' app.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $flaskCmd

# Launch FastAPI (Port 8001)
Write-Host "[3/4] Launching FastAPI AI Interview Conductor (Port 8001)..." -ForegroundColor Cyan
$fastapiCmd = "Set-Location '$backendDir'; Write-Host '--- FASTAPI INTERVIEW CONDUCTOR (PORT 8001) ---' -ForegroundColor Green; & '$pythonCmd' main.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $fastapiCmd

# Launch Frontend (Port 3000)
Write-Host "[4/4] Launching Vite React Frontend (Port 3000)..." -ForegroundColor Cyan
$frontendCmd = "Set-Location '$repoRoot'; Write-Host '--- VITE REACT FRONTEND (PORT 3000) ---' -ForegroundColor Green; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "        ALL DEMO SERVICES LAUNCHED SUCCESSFULLY!                      " -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  [App]      Frontend Application:       http://localhost:3000" -ForegroundColor White
Write-Host "  [Flask]    Flask Resume Service:        http://localhost:5000" -ForegroundColor White
Write-Host "  [FastAPI]  FastAPI AI Conductor:        http://localhost:8001" -ForegroundColor White
Write-Host "  [Docs]     FastAPI Swagger API Docs:    http://localhost:8001/docs" -ForegroundColor White
Write-Host ""
Write-Host "----------------------------------------------------------------------" -ForegroundColor Yellow
Write-Host "Presentation Tip: To stop all services, simply close the opened" -ForegroundColor Yellow
Write-Host "PowerShell windows for Flask, FastAPI, and Vite." -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------------" -ForegroundColor Yellow
