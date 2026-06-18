"""Prompt loader for debate roles (external assets)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

_PROMPT_FILES = {
    "proponent": "proponent.txt",
    "opponent": "opponent.txt",
    "moderator": "moderator.txt",
}


def _skill_root() -> Path:
    return Path(__file__).resolve().parents[2]


@lru_cache(maxsize=None)
def get_prompt(role: str) -> str:
    normalized = role.strip().lower()
    filename = _PROMPT_FILES.get(normalized)
    if not filename:
        raise ValueError(f"Unknown prompt role: {role}")

    prompt_path = _skill_root() / "assets" / "prompts" / filename
    try:
        text = prompt_path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise RuntimeError(f"Prompt file not found: {prompt_path}") from exc

    text = text.strip()
    if not text:
        raise RuntimeError(f"Prompt file is empty: {prompt_path}")
    return text
