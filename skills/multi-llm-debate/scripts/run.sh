#!/usr/bin/env bash
# Multi-LLM Debate run wrapper (macOS / Linux)
# Prefers uv for dependency management (fast and reproducible via pyproject.toml + uv.lock; .venv is auto-created and auto-synced).
# Falls back to the traditional venv + pip on environments without uv (backward compatible).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

# --- Preferred: uv (reproducible run following uv.lock) ---
if command -v uv >/dev/null 2>&1; then
    exec uv run --directory "$SCRIPT_DIR" --frozen main.py "$@"
fi

# --- Fallback: venv + pip (environments without uv) ---
VENV_DIR="$SCRIPT_DIR/.venv"
VENV_PY="$VENV_DIR/bin/python"
if command -v python3 >/dev/null 2>&1; then
    PY=python3
elif command -v python >/dev/null 2>&1; then
    PY=python
else
    echo "Error: none of uv / python3 / python were found. Please install uv or Python 3.10+." >&2
    exit 1
fi
if [ ! -x "$VENV_PY" ]; then
    echo "venv not found. Creating at $VENV_DIR ..." >&2
    "$PY" -m venv "$VENV_DIR"
    "$VENV_PY" -m pip install --quiet --upgrade pip
    "$VENV_PY" -m pip install --quiet -r "$SCRIPT_DIR/requirements.txt"
fi
exec "$VENV_PY" "$SCRIPT_DIR/main.py" "$@"
