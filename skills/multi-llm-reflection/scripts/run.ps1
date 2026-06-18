# Multi-LLM Reflection execution wrapper (Windows PowerShell)
# Dependency management prefers uv. Falls back to venv + pip if uv is unavailable.
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# --- Preferred: uv ---
if (Get-Command uv -ErrorAction SilentlyContinue) {
    & uv run --directory $ScriptDir --frozen main.py @args
    exit $LASTEXITCODE
}

# --- Fallback: venv + pip ---
$VenvPy = Join-Path $ScriptDir ".venv\Scripts\python.exe"
$Py = $null
foreach ($cand in @("py", "python", "python3")) {
    if (Get-Command $cand -ErrorAction SilentlyContinue) { $Py = $cand; break }
}
if (-not $Py) { Write-Error "uv / python not found. Install uv or Python 3.10+."; exit 1 }
if (-not (Test-Path $VenvPy)) {
    Write-Host "venv not found. Creating at $ScriptDir\.venv ..." -ForegroundColor Yellow
    & $Py -m venv (Join-Path $ScriptDir ".venv")
    & $VenvPy -m pip install --quiet --upgrade pip
    & $VenvPy -m pip install --quiet -r (Join-Path $ScriptDir "requirements.txt")
}
& $VenvPy (Join-Path $ScriptDir "main.py") @args
