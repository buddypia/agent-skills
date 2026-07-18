#!/usr/bin/env bash
# Multi-LLM Recursive Meta-Cognition execution wrapper (macOS / Linux)
# Dependency management prefers uv (fast and reproducible via pyproject.toml + uv.lock; .venv is auto-created and auto-synced).
# In environments without uv, it falls back to the traditional venv + pip (backward compatible).
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
VENV_HASH_FILE="$VENV_DIR/requirements.txt.hash"
REQ_HASH=$("$PY" -c "import hashlib; print(hashlib.md5(open('$SCRIPT_DIR/requirements.txt', 'rb').read()).hexdigest())")

NEEDS_INSTALL=false
if [ ! -x "$VENV_PY" ] || ! "$VENV_PY" -m pip --version >/dev/null 2>&1; then
    echo "venv not found or missing pip. Creating/Repairing at $VENV_DIR ..." >&2
    if [ ! -x "$VENV_PY" ]; then
        "$PY" -m venv "$VENV_DIR"
    fi
    if ! "$VENV_PY" -m pip --version >/dev/null 2>&1; then
        "$VENV_PY" -m ensurepip --default-pip --quiet || true
    fi
    "$VENV_PY" -m pip install --quiet --upgrade pip
    NEEDS_INSTALL=true
else
    if [ -f "$VENV_HASH_FILE" ]; then
        CACHED_HASH=$(cat "$VENV_HASH_FILE")
    else
        CACHED_HASH=""
    fi
    if [ "$REQ_HASH" != "$CACHED_HASH" ]; then
        NEEDS_INSTALL=true
    fi
fi

if [ "$NEEDS_INSTALL" = true ]; then
    "$VENV_PY" -m pip install --quiet -r "$SCRIPT_DIR/requirements.txt"
    echo "$REQ_HASH" > "$VENV_HASH_FILE"
fi
exec "$VENV_PY" "$SCRIPT_DIR/main.py" "$@"
