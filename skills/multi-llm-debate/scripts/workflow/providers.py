"""Provider adapters — subscription-authenticated CLI backends (pure CLI).

Calls the latest models using the user's subscription authentication, with no separate API key:
  - gemini             → Antigravity CLI (`agy -p`)    : native JSON schema output
  - anthropic / claude → Claude Code     (`claude -p`) : --json-schema native structured output
  - openai             → Codex           (`codex exec`): --output-schema native structured output

Claude and Codex receive long-form input through stdin (to avoid ARG_MAX / shell escaping).
The role executors (proponent/opponent/moderator) are untouched — they only receive a ProviderResponse via the generate_structured() interface.

Previously this used vendor SDKs (claude-agent-sdk / openai-codex / google-antigravity), but
each SDK bundled OS/architecture-specific CLI binaries (hundreds of MB), causing distribution/portability problems,
so it was unified to a lightweight approach that calls the user's globally installed CLI directly via subprocess (same as reflection/recursive).

Environment variables:
  MULTILLM_REASONING_EFFORT       reasoning effort (default high; applied to Claude, Codex, and agy)
  MULTILLM_CLI_TIMEOUT            per-CLI-call timeout (seconds) (default 360)
  MULTILLM_TOTAL_DEADLINE         whole-pipeline wall-clock budget in seconds (default 540; keeps the
                                  run under a typical 600s agent/Bash tool ceiling — each call is capped
                                  at the remaining budget and calls are skipped once it is exhausted)
  MULTILLM_AGY_PRINT_TIMEOUT      agy --print-timeout value (default 5m)
  MULTILLM_CLAUDE_MODEL / MULTILLM_CODEX_MODEL  per-backend model override (optional)
  MULTILLM_ALLOW_LEGACY_MODELS    allow an out-of-date model ID instead of refusing it (see models.py)

Context-size handling (thresholds, sharding, distillation effort) lives in context_relay.py:
  MULTILLM_DIGEST_THRESHOLD, MULTILLM_SHARD_THRESHOLD, MULTILLM_SHARD_CHARS,
  MULTILLM_SHARD_MAX, MULTILLM_SHARD_CONCURRENCY, MULTILLM_DISTILL_EFFORT

Gemini auth priority: the agy CLI (subscription OAuth) is always tried first, even if
GEMINI_API_KEY happens to be set (e.g. exported by an unrelated tool) — an incidental API key
must not silently override the user's OAuth session. GEMINI_API_KEY is only used as a fallback
when agy itself fails (not installed, not logged in, or stuck in a sandbox that can't complete
OAuth).
"""

from __future__ import annotations

import asyncio
import contextlib
import contextvars
import json
import os
import random
import shutil
import signal
import tempfile
import time
from dataclasses import dataclass
from typing import Any, Protocol

from .models import ensure_current_model, uses_codex_cli_default
from .raw import to_jsonable


# =============================================================================
# Common CLI helpers
# =============================================================================

def _cli_timeout() -> float:
    try:
        return float(os.getenv("MULTILLM_CLI_TIMEOUT", "360"))
    except ValueError:
        return 360.0


# Per-task reasoning-effort override. A ContextVar (not a global) because the sharded
# context-distillation pre-stage in context_relay.py runs many adapter calls concurrently
# under asyncio.gather at a cheap effort while the main pipeline stages keep the configured
# effort: each Task copies the context at creation, so a set() inside one distillation task
# cannot leak into another task or into the main flow.
_effort_override: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "multillm_reasoning_effort_override", default=None
)


def set_reasoning_effort_override(effort: str | None) -> None:
    """Override the reasoning effort for the current asyncio Task only."""
    _effort_override.set(effort.strip() if isinstance(effort, str) and effort.strip() else None)


def _reasoning_effort() -> str:
    # Default "high" (not "xhigh"): under the whole-pipeline wall-clock budget each stage gets a
    # limited slice, and xhigh routinely exceeds it. "high" is the balanced default; override with
    # MULTILLM_REASONING_EFFORT=xhigh|max when you have the time budget.
    override = _effort_override.get()
    if override:
        return override
    return os.getenv("MULTILLM_REASONING_EFFORT", "high").strip() or "high"


# --- whole-pipeline wall-clock budget (deadline propagation) -----------------
# A multi-stage pipeline is usually launched by an agent/Bash tool with a hard ~600s
# ceiling. We anchor a monotonic deadline on first use and cap every CLI call at the
# time remaining, so the run returns labeled partial output BEFORE it gets killed.
_POSIX = os.name == "posix"
_KILL_GRACE_SEC = 3.0      # SIGTERM -> grace -> SIGKILL when terminating a timed-out call
_MIN_CALL_FLOOR_SEC = 8.0  # don't start a new CLI call with less than this many seconds left
_deadline_mono: float | None = None


def _total_deadline() -> float:
    try:
        return float(os.getenv("MULTILLM_TOTAL_DEADLINE", "540"))
    except ValueError:
        return 540.0


def _deadline_remaining() -> float:
    """Seconds left in the whole-pipeline budget. Lazily anchored on the first call."""
    global _deadline_mono
    now = time.monotonic()
    if _deadline_mono is None:
        _deadline_mono = now + _total_deadline()
    return _deadline_mono - now


def deadline_remaining() -> float:
    """Public view of the remaining whole-pipeline budget (seconds).

    Used by context_relay.py to decide whether an optional pre-stage still fits in the
    budget. Note that calling this anchors the deadline if it has not been anchored yet.
    """
    return _deadline_remaining()


def _agy_print_timeout() -> str:
    return os.getenv("MULTILLM_AGY_PRINT_TIMEOUT", "5m").strip() or "5m"


def _strip_code_fences(text: str) -> str:
    cleaned = text.strip()
    if not cleaned.startswith("```"):
        return cleaned
    cleaned = cleaned.strip("`").strip()
    if cleaned.startswith("json"):
        cleaned = cleaned[4:].strip()
    return cleaned


def _extract_json_payload(text: str) -> str:
    """Best-effort extraction of a single JSON value from CLI output wrapped in prose.

    This is a compatibility fallback for older agy versions or a non-schema response.
    Current agy versions support ``--output-format json --json-schema`` and are handled
    by :func:`_extract_agy_response` below. The fallback locates the first balanced
    top-level ``{...}`` / ``[...]`` value — skipping braces inside JSON strings — so
    narration around a legacy plain-text result does not pollute the next stage.
    """
    cleaned = _strip_code_fences(text).strip()
    start = -1
    for i, ch in enumerate(cleaned):
        if ch == "{" or ch == "[":
            start = i
            break
    if start == -1:
        return cleaned
    depth = 0
    in_str = False
    esc = False
    for j in range(start, len(cleaned)):
        ch = cleaned[j]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{" or ch == "[":
            depth += 1
        elif ch == "}" or ch == "]":
            depth -= 1
            if depth == 0:
                return cleaned[start : j + 1]
    # Unbalanced (e.g. truncated output) — hand back the fence-stripped text.
    return cleaned


def _extract_agy_response(output: str) -> str:
    """Return the model payload from agy's JSON envelope.

    agy 1.1.x provides native structured output with ``--output-format json`` and
    ``--json-schema``. Its stdout is an envelope whose ``structured_output`` holds the
    JSON value required by the schema; treating the whole envelope as model text makes
    Pydantic validation fail. Fall back to the legacy balanced-JSON extraction when a
    caller has an older CLI or returns an unexpected envelope.
    """
    try:
        envelope = json.loads(output)
    except json.JSONDecodeError:
        return _extract_json_payload(output)

    if not isinstance(envelope, dict):
        return _extract_json_payload(output)

    structured = envelope.get("structured_output")
    if structured is not None:
        return json.dumps(structured, ensure_ascii=False)

    response = envelope.get("response")
    if isinstance(response, str):
        return _extract_json_payload(response)
    return _extract_json_payload(output)


def _strip_unsupported_schema_fields(schema: Any) -> Any:
    """Drop JSON-Schema fields the Gemini REST API's responseSchema (an OpenAPI 3.0
    subset) doesn't understand — notably "additionalProperties", which the API
    rejects outright with a 400 INVALID_ARGUMENT ("Cannot find field."). Recurses
    into nested object/array schemas so every level is cleaned, not just the root.
    """
    if isinstance(schema, dict):
        return {
            key: _strip_unsupported_schema_fields(value)
            for key, value in schema.items()
            if key != "additionalProperties"
        }
    if isinstance(schema, list):
        return [_strip_unsupported_schema_fields(item) for item in schema]
    return schema


_CLAUDE_EFFORTS = {"low", "medium", "high", "xhigh", "max"}
_AGY_EFFORTS = {"low", "medium", "high"}


def _claude_effort(effort: str) -> str:
    """Clamp to a value Claude's --effort accepts (Codex additionally allows none/minimal)."""
    e = (effort or "").strip().lower()
    if e in _CLAUDE_EFFORTS:
        return e
    if e in {"none", "minimal"}:
        return "low"
    return "high"


def _agy_model_and_effort(model: str, effort: str) -> tuple[str, str]:
    """Translate the shared effort setting to agy's three supported levels.

    agy 1.1.x requires ``--effort`` for base Gemini model aliases such as
    ``gemini-3.7-flash``. Its model picker also displays the aliases with a trailing
    ``-low`` / ``-medium`` / ``-high`` suffix, so accept either spelling while ensuring
    that a caller's explicit model tier wins over the common effort environment variable.
    """
    normalized_model = model.strip()
    for tier in _AGY_EFFORTS:
        suffix = f"-{tier}"
        if normalized_model.lower().endswith(suffix):
            return normalized_model[: -len(suffix)], tier
    normalized_effort = (effort or "").strip().lower()
    return normalized_model, normalized_effort if normalized_effort in _AGY_EFFORTS else "high"


def _agy_failure_detail(output: str) -> str:
    """Extract agy's JSON error text when it writes diagnostics to stdout.

    A nonempty ``response`` is normal in a successful legacy envelope, so it is only
    considered a failure detail when agy explicitly reports a failing status.
    """
    try:
        envelope = json.loads(output)
    except json.JSONDecodeError:
        return ""
    if not isinstance(envelope, dict):
        return ""
    status = str(envelope.get("status") or "").strip().upper()
    if status not in {"ERROR", "FAILED", "FAILURE"} and not envelope.get("error"):
        return ""
    for key in ("error", "message", "response"):
        value = envelope.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()[:500]
    return ""


def _cli_failure_detail(stdout: str, stderr: str) -> str:
    """Classify a CLI failure without copying untrusted diagnostic text into workflow output."""
    details: list[str] = []
    for output in (stdout, stderr):
        try:
            envelope = json.loads(output)
        except json.JSONDecodeError:
            continue
        if isinstance(envelope, dict) and envelope.get("is_error"):
            for key in ("result", "error", "message"):
                value = envelope.get(key)
                if isinstance(value, str) and value.strip():
                    details.append(value)
    for output in (stderr, stdout):
        for line in reversed(output.splitlines()):
            candidate = line.strip()
            lowered = candidate.lower()
            if (
                lowered.startswith(("error:", "error ", "fatal:", "fatal "))
                or "invalid_request_error" in lowered
                or "authentication error" in lowered
                or "rate limit" in lowered
            ):
                details.append(candidate)
    combined = "\n".join(details).lower()
    if "model is not supported" in combined or "invalid_request_error" in combined:
        return "invalid request (check that the configured model is supported by this CLI account)"
    if "authentication" in combined or "unauthorized" in combined or "forbidden" in combined:
        return "authentication or authorization failure"
    if "rate limit" in combined or "too many requests" in combined:
        return "rate limited"
    if details:
        return "CLI reported an error; diagnostic text was withheld to avoid leaking prompt content"
    return "no diagnostic emitted by CLI"


def _codex_actual_model(event_output: str) -> str | None:
    """Read Codex's resolved model from its JSONL lifecycle events, if exposed by this CLI version."""
    for line in event_output.splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(event, dict):
            continue
        for container in (event, event.get("thread"), event.get("turn")):
            if not isinstance(container, dict):
                continue
            model = container.get("model")
            if isinstance(model, str) and model.strip():
                return model.strip()
    return None


_CLI_VERSION_CACHE: dict[str, str] = {}


async def _cli_version(binary: str, *, cwd: str, timeout: float) -> str:
    """Return a deadline-bounded CLI version once per binary, without affecting the result."""
    if binary in _CLI_VERSION_CACHE:
        return _CLI_VERSION_CACHE[binary]
    try:
        _rc, out, err = await _run_cli(
            [binary, "--version"], stdin_text=None, cwd=cwd, timeout=min(timeout, 5)
        )
        version = (out or err).strip() or "unknown"
    except Exception:
        version = "unknown"
    _CLI_VERSION_CACHE[binary] = version
    return version


async def _terminate_process_tree(proc: "asyncio.subprocess.Process") -> None:
    """Kill the whole process tree of a timed-out CLI, not just the direct child.

    The CLIs (claude/codex/agy) spawn their own node/bun children; a bare proc.kill()
    orphans those grandchildren. We start each child in its own session/group and signal
    the group: SIGTERM, a short grace period, then SIGKILL, finally reaping to avoid zombies.
    """
    if _POSIX:
        pgid = None
        try:
            pgid = os.getpgid(proc.pid)
        except (ProcessLookupError, PermissionError):
            pgid = None
        if pgid is not None:
            with contextlib.suppress(ProcessLookupError):
                os.killpg(pgid, signal.SIGTERM)
            try:
                await asyncio.wait_for(proc.wait(), timeout=_KILL_GRACE_SEC)
                return
            except asyncio.TimeoutError:
                pass
            with contextlib.suppress(ProcessLookupError):
                os.killpg(pgid, signal.SIGKILL)
    else:
        import subprocess
        try:
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        except Exception:
            pass
        with contextlib.suppress(Exception):
            proc.kill()
    with contextlib.suppress(Exception):
        await proc.wait()


def _kill_process_tree_nowait(proc: "asyncio.subprocess.Process") -> None:
    """SIGKILL the child's process group synchronously, without awaiting.

    Used from a cancellation handler, where awaiting is unreliable: the outer canceller is
    already waiting for us to unwind. The asyncio child watcher reaps the process afterwards.
    """
    if _POSIX:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            return
        except (ProcessLookupError, PermissionError):
            pass
    else:
        import subprocess
        with contextlib.suppress(Exception):
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        return
    with contextlib.suppress(Exception):
        proc.kill()


async def _run_cli(
    cmd: list[str],
    *,
    stdin_text: str | None,
    cwd: str | None,
    timeout: float,
) -> tuple[int, str, str]:
    """Run a CLI via subprocess. Long-form input goes through stdin. Returns (rc, stdout, stderr).

    The effective timeout is the smaller of the per-call timeout and the time left in the
    whole-pipeline budget, so a single slow stage cannot blow the overall wall-clock ceiling.
    """
    remaining = _deadline_remaining()
    if remaining <= _MIN_CALL_FLOOR_SEC:
        raise RuntimeError(
            f"deadline budget exhausted ({remaining:.0f}s left); skipping {cmd[0]} "
            "to return partial results before the wall-clock ceiling"
        )
    effective_timeout = min(timeout, remaining)
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdin=asyncio.subprocess.PIPE if stdin_text is not None else None,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=cwd,
        start_new_session=_POSIX,
    )
    payload = stdin_text.encode("utf-8") if stdin_text is not None else None
    try:
        out, err = await asyncio.wait_for(proc.communicate(payload), timeout=effective_timeout)
    except asyncio.TimeoutError:
        await _terminate_process_tree(proc)
        raise RuntimeError(f"CLI timeout after {effective_timeout:.0f}s: {cmd[0]}")
    except asyncio.CancelledError:
        # An OUTER canceller reached us: the per-stage asyncio.wait_for cap, or the
        # context-distillation budget in context_relay.py. CancelledError derives from
        # BaseException, so without this handler it sails past the TimeoutError branch and
        # the child CLI — plus the node/bun grandchildren it spawned — is orphaned, quietly
        # burning CPU and vendor quota for the rest of the run.
        _kill_process_tree_nowait(proc)
        raise
    rc = proc.returncode if proc.returncode is not None else 0
    return rc, out.decode("utf-8", "replace"), err.decode("utf-8", "replace")


def _backend_model(env_name: str | None, configured: str, provider: str) -> str:
    """Resolve the model this backend will actually run, re-checking the model policy.

    main.py validates the resolved config and the override env vars at startup, so this is a
    backstop — but it is the last point before the ID becomes argv, and it also covers callers
    that build an AgentConfig directly instead of going through the CLI. The per-backend
    override in particular reaches a vendor without passing through any role config.
    """
    override = os.getenv(env_name) if env_name else None
    if override and override.strip():
        return ensure_current_model(override, provider=provider, source=env_name or "")
    return ensure_current_model(configured, provider=provider, source="the resolved role config")


@dataclass(slots=True)
class ProviderResponse:
    provider: str
    model: str
    request: dict[str, Any]
    response_text: str
    response_meta: dict[str, Any]
    parsed_output: Any | None = None


class ProviderAdapter(Protocol):
    name: str

    async def generate_structured(
        self,
        *,
        model: str,
        api_key: str | None,
        base_url: str | None,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        schema: dict[str, Any],
        schema_name: str,
        output_model: Any | None,
    ) -> ProviderResponse:
        raise NotImplementedError


# =============================================================================
# Claude Code CLI  (anthropic / claude)  — claude -p --json-schema (native structured)
# =============================================================================

class ClaudeCliAdapter:
    name = "claude"

    async def generate_structured(
        self,
        *,
        model: str,
        api_key: str | None,
        base_url: str | None,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        schema: dict[str, Any],
        schema_name: str,
        output_model: Any | None,
    ) -> ProviderResponse:
        binary = shutil.which("claude") or "claude"
        model_id = _backend_model("MULTILLM_CLAUDE_MODEL", model, "anthropic")
        effort = _reasoning_effort()
        timeout = _cli_timeout()
        with tempfile.TemporaryDirectory(prefix="mll_claude_") as tmp:
            sys_file = os.path.join(tmp, "system.txt")
            with open(sys_file, "w", encoding="utf-8") as fh:
                fh.write(system_prompt)
            cmd = [
                binary, "-p",
                "--output-format", "json",
                "--json-schema", json.dumps(schema, ensure_ascii=False),
                "--append-system-prompt-file", sys_file,
                "--allowed-tools", "",
                "--permission-mode", "dontAsk",
                "--model", model_id,
                "--effort", _claude_effort(effort),
            ]
            # cwd=tmp → avoids loading the project's CLAUDE.md/hooks. Does not use --bare so subscription auth still applies.
            rc, out, err = await _run_cli(cmd, stdin_text=user_prompt, cwd=tmp, timeout=timeout)
        if rc != 0:
            raise RuntimeError(
                f"claude -p failed (exit {rc}): {_cli_failure_detail(out, err)}"
            )
        try:
            data = json.loads(out)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                "claude -p returned an invalid JSON envelope; diagnostic text was withheld "
                "to avoid leaking prompt content"
            ) from exc
        if data.get("is_error"):
            raise RuntimeError(f"claude -p error: {_cli_failure_detail(out, err)}")
        structured = data.get("structured_output")
        if structured is not None:
            response_text = json.dumps(structured, ensure_ascii=False)
        else:
            response_text = data.get("result", "") or ""
        request = {
            "backend": "claude-cli",
            "model": model_id,
            "argv": cmd,
            "system_prompt_chars": len(system_prompt),
            "user_prompt_chars": len(user_prompt),
        }
        meta = {
            "backend": "claude-cli",
            "model": model_id,
            "reasoning_effort": effort,
            "usage": data.get("modelUsage") or data.get("usage"),
            "session_id": data.get("session_id"),
        }
        parsed_output = None
        if output_model is not None:
            try:
                parsed_output = output_model.model_validate_json(_strip_code_fences(response_text))
            except Exception as exc:
                import sys
                print(f"[claude] warning: schema validation failed for {schema_name}: {exc}", file=sys.stderr)
        return ProviderResponse(
            provider=self.name,
            model=model_id,
            request=to_jsonable(request),
            response_text=response_text,
            response_meta=meta,
            parsed_output=parsed_output,
        )


# =============================================================================
# Codex CLI  (openai)  — codex exec --output-schema (native structured), reasoning xhigh
# =============================================================================

class CodexAdapter:
    name = "openai"

    async def generate_structured(
        self,
        *,
        model: str,
        api_key: str | None,
        base_url: str | None,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        schema: dict[str, Any],
        schema_name: str,
        output_model: Any | None,
    ) -> ProviderResponse:
        binary = shutil.which("codex") or "codex"
        model_id = _backend_model("MULTILLM_CODEX_MODEL", model, "openai")
        effort = _reasoning_effort()
        timeout = _cli_timeout()
        with tempfile.TemporaryDirectory(prefix="mll_codex_") as tmp:
            schema_file = os.path.join(tmp, "schema.json")
            out_file = os.path.join(tmp, "out.json")
            with open(schema_file, "w", encoding="utf-8") as fh:
                json.dump(schema, fh, ensure_ascii=False)
            model_args = [] if uses_codex_cli_default(model_id) else ["-m", model_id]
            cmd = [
                binary, "exec",
                system_prompt,                      # role directive = prompt arg
                "--output-schema", schema_file,
                "-o", out_file,
                "--json",
                *model_args,
                "-c", f"model_reasoning_effort={effort}",
                "-s", "read-only",
                "--skip-git-repo-check",
                "--ephemeral",
            ]
            # long-form context (user_prompt) → stdin (codex appends it as a <stdin> block)
            rc, out, err = await _run_cli(cmd, stdin_text=user_prompt, cwd=tmp, timeout=timeout)
            response_text = ""
            try:
                with open(out_file, "r", encoding="utf-8") as fh:
                    response_text = fh.read().strip()
            except FileNotFoundError:
                response_text = ""
            actual_model = _codex_actual_model(out)
            cli_version = await _cli_version(binary, cwd=tmp, timeout=timeout)
        if not response_text:
            if rc != 0:
                raise RuntimeError(
                    f"codex exec failed (exit {rc}): {_cli_failure_detail(out, err)}"
                )
            raise RuntimeError(
                "codex exec produced no structured output: "
                f"{_cli_failure_detail(out, err)}"
            )
        request = {
            "backend": "codex-cli",
            "model": model_id,
            "actual_model": actual_model or "unknown",
            "reasoning_effort": effort,
            "argv": cmd,
            "system_prompt_chars": len(system_prompt),
            "user_prompt_chars": len(user_prompt),
        }
        meta = {
            "backend": "codex-cli",
            "model": model_id,
            "actual_model": actual_model or "unknown",
            "actual_model_resolution": "reported_by_cli" if actual_model else "not_exposed_by_cli",
            "cli_version": cli_version,
            "reasoning_effort": effort,
        }
        parsed_output = None
        if output_model is not None:
            try:
                parsed_output = output_model.model_validate_json(_strip_code_fences(response_text))
            except Exception as exc:
                import sys
                print(f"[codex] warning: schema validation failed for {schema_name}: {exc}", file=sys.stderr)
        return ProviderResponse(
            provider=self.name,
            model=actual_model or model_id,
            request=to_jsonable(request),
            response_text=response_text,
            response_meta=meta,
            parsed_output=parsed_output,
        )


# =============================================================================
# Antigravity CLI  (gemini)  — successor to the Gemini CLI. The model comes from the role
#   config (default in models.py) and is passed to agy explicitly.
#   agy 1.1.x supports --model, --json-schema, and --output-format json, so it can return
#   schema-native structured output just like the Claude and Codex adapters.
#
#   Auth priority is agy CLI (subscription OAuth) first, GEMINI_API_KEY second (fallback only).
#   An incidental GEMINI_API_KEY exported for some unrelated tool must not silently steal traffic
#   away from the user's OAuth session — see module docstring.
# =============================================================================

class AntigravityCliAdapter:
    name = "gemini"

    async def generate_structured(
        self,
        *,
        model: str,
        api_key: str | None,
        base_url: str | None,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        schema: dict[str, Any],
        schema_name: str,
        output_model: Any | None,
    ) -> ProviderResponse:
        model = _backend_model(None, model, "gemini")
        effective_api_key = api_key or os.getenv("GEMINI_API_KEY")

        async def call_api() -> ProviderResponse:
            loop = asyncio.get_running_loop()
            timeout = _cli_timeout()
            remaining = _deadline_remaining()
            effective_timeout = min(timeout, remaining)
            response_text = await loop.run_in_executor(
                None,
                _call_gemini_api,
                model,
                effective_api_key,
                system_prompt,
                user_prompt,
                temperature,
                schema,
                effective_timeout,
            )
            text = _strip_code_fences(response_text.strip())
            request = {
                "backend": "gemini-api",
                "model": model,
                "directive_chars": len(system_prompt),
                "user_prompt_chars": len(user_prompt),
            }
            meta = {"backend": "gemini-api", "model": model}
            parsed_output = None
            if output_model is not None:
                try:
                    parsed_output = output_model.model_validate_json(text)
                except Exception:
                    pass
            return ProviderResponse(
                provider=self.name,
                model=model,
                request=to_jsonable(request),
                response_text=text,
                response_meta=meta,
                parsed_output=parsed_output,
            )

        async def call_agy() -> ProviderResponse:
            binary = shutil.which("agy") or "agy"
            timeout = _cli_timeout()
            effort = _reasoning_effort()
            model_id, agy_effort = _agy_model_and_effort(model, effort)
            # agy does not read stdin as print-mode task content: it starts a request from the
            # -p argument only. Passing user_prompt through stdin therefore yields a successful
            # but empty/unrelated answer. Keep the complete task in the prompt argument instead.
            directive = f"{system_prompt}\n\n=== Task content ===\n{user_prompt}"
            cmd = [
                binary, "-p", directive,
                "--model", model_id,
                "--effort", agy_effort,
                "--json-schema", json.dumps(schema, ensure_ascii=False),
                "--output-format", "json",
                "--disable-slash-commands",
                "--print-timeout", _agy_print_timeout(),
            ]
            # agy creates an .antigravitycli/ working directory in cwd, so isolate it in a tempdir.
            # No tool access or permission bypass is required because the complete task is argv.
            tmp = tempfile.mkdtemp(prefix="mll_agy_")
            last_err = ""
            max_attempts = 2
            try:
                for attempt in range(max_attempts):
                    try:
                        rc, out, err = await _run_cli(cmd, stdin_text=None, cwd=tmp, timeout=timeout)
                    except RuntimeError as exc:
                        # Timeout / exhausted deadline: re-running only burns more of the shared
                        # budget against the same wall-clock ceiling, so do not retry.
                        last_err = str(exc)
                        break
                    failure_detail = _agy_failure_detail(out)
                    text = _extract_agy_response(out)
                    if rc == 0 and not failure_detail and text:
                        request = {
                            "backend": "antigravity-cli",
                            "model": model_id,
                            "directive_chars": len(directive),
                            "user_prompt_chars": len(user_prompt),
                            "attempt": attempt + 1,
                        }
                        meta = {
                            "backend": "antigravity-cli",
                            "model": model_id,
                            "reasoning_effort": agy_effort,
                            "attempt": attempt + 1,
                        }
                        parsed_output = None
                        if output_model is not None:
                            try:
                                parsed_output = output_model.model_validate_json(text)
                            except Exception as exc:
                                import sys
                                print(f"[gemini-cli] warning: schema validation failed for {schema_name}: {exc}", file=sys.stderr)
                        return ProviderResponse(
                            provider=self.name,
                            model=model_id,
                            request=to_jsonable(request),
                            response_text=text,
                            response_meta=meta,
                            parsed_output=parsed_output,
                        )
                    last_err = err.strip()[:500] or failure_detail or f"exit {rc}"
                    # Retry a soft failure once, with bounded jittered backoff, only if the budget allows.
                    if attempt + 1 < max_attempts and _deadline_remaining() > _MIN_CALL_FLOOR_SEC + 5:
                        await asyncio.sleep(1.0 + random.random())
                    else:
                        break
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
            raise RuntimeError(f"agy -p failed: {last_err}")

        import sys

        # agy CLI (subscription OAuth) is tried first and is the normal path. GEMINI_API_KEY (if
        # any) is only a fallback for when agy itself is unusable (not installed, not logged in,
        # or stuck in a sandbox that can't complete OAuth) — an incidental GEMINI_API_KEY exported
        # for some unrelated tool must not silently steal traffic away from the OAuth session.
        try:
            return await call_agy()
        except Exception as agy_exc:
            if not effective_api_key:
                raise
            print(f"agy CLI (OAuth) failed, falling back to direct Gemini API: {agy_exc}", file=sys.stderr)
            try:
                return await call_api()
            except Exception as api_exc:
                raise RuntimeError(
                    f"Direct Gemini API fallback failed: {api_exc} (original agy CLI error: {agy_exc})"
                ) from api_exc


def _call_gemini_api(
    model: str,
    api_key: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    schema: dict[str, Any],
    timeout: float,
) -> str:
    import urllib.request
    import urllib.error
    import json

    model_name = model if model.startswith("models/") else f"models/{model}"
    url = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:generateContent"

    # The Gemini REST API's responseSchema is an OpenAPI 3.0 subset: fields like
    # "additionalProperties" (present in the Pydantic-derived schemas in types.py) are rejected
    # with 400 INVALID_ARGUMENT ("Cannot find field."), so strip them before sending.
    clean_schema = _strip_unsupported_schema_fields(schema)

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": user_prompt}
                ]
            }
        ],
        "systemInstruction": {
            "parts": [
                {"text": system_prompt}
            ]
        },
        "generationConfig": {
            "temperature": temperature,
            "responseMimeType": "application/json",
            "responseSchema": clean_schema
        }
    }

    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=req_data,
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST"
    )

    with urllib.request.urlopen(req, timeout=max(1.0, timeout)) as response:
        res_data = json.loads(response.read().decode("utf-8"))

    try:
        return res_data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        raise ValueError(f"Failed to parse Gemini API response: {res_data}") from e


# =============================================================================
# Mock  (offline smoke tests)
# =============================================================================

class MockAdapter:
    name = "mock"

    async def generate_structured(
        self,
        *,
        model: str,
        api_key: str | None,
        base_url: str | None,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        schema: dict[str, Any],
        schema_name: str,
        output_model: Any | None,
    ) -> ProviderResponse:
        payload = _build_mock_payload(schema_name, schema)
        response_text = json.dumps(payload, ensure_ascii=False)
        request = {
            "model": model,
            "system_prompt": system_prompt,
            "user_prompt": user_prompt,
            "temperature": temperature,
            "mock": True,
        }
        parsed_output = None
        if output_model is not None:
            try:
                parsed_output = output_model.model_validate_json(_strip_code_fences(response_text))
            except Exception:
                pass
        return ProviderResponse(
            provider=self.name,
            model=model,
            request=to_jsonable(request),
            response_text=response_text,
            response_meta={"mock": True},
            parsed_output=parsed_output,
        )


def _mock_value_from_schema(schema: Any) -> Any:
    """Build a minimal schema-valid value from a JSON Schema fragment.

    The mock fallback for any schema_name without a hand-written payload (the
    recursive/reflection stages). Deriving the value from the stage's own JSON
    schema keeps the mock output valid against the Pydantic model, instead of the
    old generic ``{"message": ...}`` blob that failed validation and leaked verbatim
    into required string fields (e.g. integrated_answer / final_response) downstream.
    """
    if not isinstance(schema, dict):
        return "mock"
    schema_type = schema.get("type")
    if isinstance(schema_type, list):
        schema_type = next((t for t in schema_type if t != "null"), "string")
    if schema_type == "object":
        props = schema.get("properties", {})
        required = schema.get("required", list(props.keys()))
        return {key: _mock_value_from_schema(props[key]) for key in required if key in props}
    if schema_type == "array":
        return []
    if schema_type == "integer":
        return 0
    if schema_type == "number":
        return 0.5
    if schema_type == "boolean":
        return False
    return "mock"


def _build_mock_payload(schema_name: str, schema: dict[str, Any]) -> dict[str, Any]:
    """Return deterministic payloads for contract tests.

    The debate roles have hand-written payloads; any other stage (recursive /
    reflection) is derived from its JSON schema so the mock output still validates.
    """
    if schema_name == "proponent_output":
        return {
            "position": "pro (mock)",
            "arguments": ["mock-argument"],
            "evidence": ["mock-evidence"],
            "benefits": ["mock-benefit"],
            "confidence": 0.5,
            "context_digest": "mock-digest",
        }
    if schema_name == "opponent_output":
        return {
            "position": "con (mock)",
            "counter_arguments": ["mock-counter"],
            "risks": ["mock-risk"],
            "weaknesses": ["mock-weakness"],
            "alternatives": ["mock-alternative"],
            "confidence": 0.5,
        }
    if schema_name == "moderator_output":
        return {
            "summary": "mock-summary",
            "proponent_score": 5,
            "opponent_score": 5,
            "key_insights": ["mock-insight"],
            "final_verdict": "mock-verdict",
            "recommendation": "mock-recommendation",
            "confidence": 0.5,
        }
    value = _mock_value_from_schema(schema)
    return value if isinstance(value, dict) else {"value": value}


# =============================================================================
# Registry
# =============================================================================

def get_adapter(provider: str) -> ProviderAdapter:
    normalized = provider.strip().lower()
    if normalized == "mock":
        return MockAdapter()
    if normalized == "openai":
        return CodexAdapter()
    if normalized in {"anthropic", "claude"}:
        return ClaudeCliAdapter()
    if normalized == "gemini":
        return AntigravityCliAdapter()
    raise ValueError(f"Unknown provider: {provider}")
