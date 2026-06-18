@echo off
REM Multi-LLM Recursive Meta-Cognition execution wrapper (Windows cmd)
REM Dependency management prefers uv. Falls back to venv + pip if uv is unavailable.
setlocal enableextensions
set "SCRIPT_DIR=%~dp0"

REM --- Preferred: uv ---
where uv >nul 2>nul && (
    uv run --directory "%SCRIPT_DIR%" --frozen main.py %*
    exit /b %errorlevel%
)

REM --- Fallback: venv + pip ---
set "VENV_PY=%SCRIPT_DIR%.venv\Scripts\python.exe"
set "PY="
where py >nul 2>nul && set "PY=py"
if not defined PY ( where python >nul 2>nul && set "PY=python" )
if not defined PY (
    echo Error: uv / python / py not found. Install uv or Python 3.10+. 1>&2
    exit /b 1
)
if not exist "%VENV_PY%" (
    echo venv not found. Creating at %SCRIPT_DIR%.venv ... 1>&2
    %PY% -m venv "%SCRIPT_DIR%.venv" || exit /b 1
    "%VENV_PY%" -m pip install --quiet --upgrade pip
    "%VENV_PY%" -m pip install --quiet -r "%SCRIPT_DIR%requirements.txt" || exit /b 1
)
"%VENV_PY%" "%SCRIPT_DIR%main.py" %*
