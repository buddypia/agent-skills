"""Model-ID policy: one source of truth for the current models, and a hard stop on old ones.

Why this module exists
----------------------
A model ID can enter a run through six independent channels — a ``--<role>-model`` flag,
``<SKILL>_<ROLE>_MODEL``, ``<PROVIDER>_MODEL_ID``, the ``model:`` key in config.yaml,
``MULTILLM_CLAUDE_MODEL`` / ``MULTILLM_CODEX_MODEL``, or the built-in default. Every one of
them used to be an unchecked string handed straight to a vendor CLI, so a retired ID failed
deep inside that CLI as an opaque 404. The executors catch stage exceptions and substitute
placeholder text, which means the run still exited 0 and still printed a verdict — the answer
was simply produced by fewer models than it claimed. Nothing anywhere said "that model no
longer exists".

Policy enforced here:

* The current default per provider lives in ``DEFAULT_MODELS`` — the single place to edit when
  a new model ships. Role defaults and ``--help`` text derive from it instead of repeating IDs.
* Every resolved model passes :func:`ensure_current_model` **before** a subprocess is spawned,
  whichever channel it came from.
* Retired and superseded-generation IDs are rejected with the offending channel named, so the
  fix is obvious. Only generations that no longer exist are rejected — a *supported but older*
  choice (say ``claude-sonnet-5`` to fit a tight wall-clock budget) stays the caller's call.
* Escape hatch: ``MULTILLM_ALLOW_LEGACY_MODELS=1`` downgrades the rejection to a stderr
  warning, for a gateway that remaps old names or an account pinned to an old snapshot.

The deny-list ages safely. If it falls behind, the worst case is that it stops catching
something — it can never block a model released after this file was written.
"""

from __future__ import annotations

import os
import re
import sys


# =============================================================================
# Current defaults (2026-07) — the ONLY place in the code that names a model ID
# =============================================================================

DEFAULT_MODELS: dict[str, str] = {
    # Google Gemini via the agy (Antigravity) CLI.
    "gemini": "gemini-3.7-flash",
    # Anthropic via the claude CLI.
    "anthropic": "claude-opus-5",
    "claude": "claude-opus-5",
    # OpenAI via the codex CLI.
    "openai": "gpt-3.6-luna",
    # Offline contract tests; never reaches a vendor.
    "mock": "mock-v1",
}

ALLOW_LEGACY_ENV = "MULTILLM_ALLOW_LEGACY_MODELS"

# Per-backend overrides read directly by providers.py, bypassing all config resolution.
BACKEND_OVERRIDE_ENVS: dict[str, str] = {
    "MULTILLM_CLAUDE_MODEL": "anthropic",
    "MULTILLM_CODEX_MODEL": "openai",
}


# =============================================================================
# Deny-list
# =============================================================================

# Exact IDs known to be gone. Kept separate from the family patterns below so the message can
# name the specific replacement path rather than just the generation.
_RETIRED_MODELS: dict[str, str] = {
    "claude-3-5-sonnet-latest": "retired 2025-10-28; the alias now resolves to nothing",
    "claude-3-5-sonnet-20240620": "retired snapshot",
    "claude-3-5-sonnet-20241022": "retired snapshot",
    "claude-3-5-haiku-20241022": "retired snapshot",
    "claude-3-opus-20240229": "retired snapshot",
    "claude-3-sonnet-20240229": "retired snapshot",
    "claude-3-haiku-20240307": "retired snapshot",
    "claude-2.0": "retired",
    "claude-2.1": "retired",
    "claude-instant-1.2": "retired",
    "gpt-3.5-turbo": "superseded generation",
    "gpt-4": "superseded generation",
    "gpt-4-32k": "superseded generation",
    "gpt-4-turbo": "superseded generation",
    "text-davinci-003": "removed with the completions API",
    "gemini-pro": "pre-1.5 alias, removed",
    "gemini-pro-vision": "pre-1.5 alias, removed",
    "gemini-1.0-pro": "superseded generation",
    "gemini-1.5-pro": "superseded generation",
    "gemini-1.5-flash": "superseded generation",
}

# Whole generations that will not come back. Anchored at the start so a *newer* ID can never
# match by accident — note that "gpt-3.6-luna" is deliberately unreachable by every pattern
# here (`^gpt-3(?:$|-)` stops at the "." and `^gpt-3\.5` needs a 5).
_LEGACY_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"^claude-(?:instant|1|2)(?:$|[.\-])"), "Claude 1/2 generation"),
    (re.compile(r"^claude-3(?:$|[.\-])"), "Claude 3 generation (including 3.5 / 3.7)"),
    (re.compile(r"^claude-(?:opus|sonnet|haiku)-[123](?:$|[.\-])"), "Claude 1-3 generation"),
    (re.compile(r"^gpt-3(?:$|-)"), "GPT-3 generation"),
    (re.compile(r"^gpt-3\.5"), "GPT-3.5 generation"),
    (re.compile(r"^gpt-4"), "GPT-4 generation (including 4o / 4.1 / turbo)"),
    (re.compile(r"^(?:text|code)-(?:davinci|curie|babbage|ada)"), "GPT-3-era completion models"),
    (re.compile(r"^o1(?:$|[-_])"), "o1 reasoning generation"),
    (re.compile(r"^o3(?:$|[-_])"), "o3 reasoning generation"),
    (re.compile(r"^gemini-(?:1|2)(?:$|[.\-])"), "Gemini 1.x / 2.x generation"),
)


class ModelPolicyError(ValueError):
    """A model ID or provider was rejected before any vendor call was made."""


def _allow_legacy() -> bool:
    return os.getenv(ALLOW_LEGACY_ENV, "").strip().lower() in {"1", "true", "yes", "on"}


def legacy_reason(model: str) -> str | None:
    """Return why ``model`` is out of date, or None if it passes the policy.

    Unknown IDs pass. An allow-list would have to be updated before every new model could be
    used, which is the same staleness trap in the opposite direction.
    """
    candidate = (model or "").strip().lower()
    if not candidate:
        return None
    retired = _RETIRED_MODELS.get(candidate)
    if retired:
        return retired
    for pattern, description in _LEGACY_PATTERNS:
        if pattern.match(candidate):
            return description
    return None


def resolve_default_model(provider: str) -> str:
    """Default model for ``provider``.

    Raises on an unknown provider instead of the old ``DEFAULT_MODELS.get(p, "gpt-3.6-luna")``
    fallback, which paired an OpenAI model ID with a provider that has no adapter — a typo in
    ``provider:`` surfaced much later as "Unknown provider" from inside a stage, after the
    run had already started.
    """
    normalized = (provider or "").strip().lower()
    model = DEFAULT_MODELS.get(normalized)
    if model is None:
        raise ModelPolicyError(
            f"unknown provider {provider!r}. Valid providers: "
            f"{', '.join(sorted(DEFAULT_MODELS))}"
        )
    return model


def ensure_current_model(model: str, *, provider: str = "", source: str = "configuration") -> str:
    """Validate a resolved model ID and return it stripped.

    Args:
        model: the ID as resolved from ``source``.
        provider: used only to suggest the current replacement.
        source: human-readable channel the value came from (flag, env var, config key), so the
            error points at the thing that actually needs editing.
    """
    candidate = (model or "").strip()
    if not candidate:
        raise ModelPolicyError(f"empty model ID from {source}")

    reason = legacy_reason(candidate)
    if reason is None:
        return candidate

    replacement = DEFAULT_MODELS.get((provider or "").strip().lower())
    hint = f" Current default: {replacement}." if replacement else ""
    detail = f"model {candidate!r} is out of date ({reason}), set via {source}.{hint}"

    if _allow_legacy():
        print(
            f"WARNING: {detail} Using it anyway because {ALLOW_LEGACY_ENV} is set — "
            "expect the vendor CLI to fail if the model is really gone.",
            file=sys.stderr,
        )
        return candidate

    raise ModelPolicyError(
        f"{detail} Old models are refused before the run starts; passing one through would "
        f"only surface later as an opaque vendor error inside a stage. "
        f"Set {ALLOW_LEGACY_ENV}=1 to override (e.g. a gateway that remaps old names)."
    )


def validate_backend_overrides() -> None:
    """Fail fast on a stale MULTILLM_CLAUDE_MODEL / MULTILLM_CODEX_MODEL.

    providers.py reads these directly, so they bypass every config-resolution check. Without
    this the whole run would proceed and every affected stage would degrade one by one.
    """
    for env_name, provider in BACKEND_OVERRIDE_ENVS.items():
        value = os.getenv(env_name)
        if value and value.strip():
            ensure_current_model(value, provider=provider, source=env_name)
