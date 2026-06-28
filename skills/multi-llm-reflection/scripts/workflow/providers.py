"""Provider adapters — subscription-auth CLI backends (pure CLI).

Calls the latest models using the user's subscription auth, with no separate API key:
  - gemini             → Antigravity CLI (`agy -p`)    : plain-text output → JSON-only directive + Pydantic validation
  - anthropic / claude → Claude Code     (`claude -p`) : --json-schema native structured output
  - openai             → Codex           (`codex exec`): --output-schema native structured output

Long-form input is always passed via stdin (avoids ARG_MAX / shell escaping).
The role executors are unchanged — they only return a ProviderResponse via the generate_structured() interface.

Environment variables:
  MULTILLM_REASONING_EFFORT   Reasoning effort (default high; applied to both Claude and Codex)
  MULTILLM_CLI_TIMEOUT        per-CLI-call timeout in seconds (default 360)
  MULTILLM_TOTAL_DEADLINE     whole-pipeline wall-clock budget in seconds (default 540; keeps the
                              run under a typical 600s agent/Bash tool ceiling — each call is capped
                              at the remaining budget and calls are skipped once it is exhausted)
  MULTILLM_AGY_PRINT_TIMEOUT  agy --print-timeout value (default 5m)
  MULTILLM_CLAUDE_MODEL / MULTILLM_CODEX_MODEL  per-backend model override (optional)
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import random
import shutil
import signal
import tempfile
import time
from dataclasses import dataclass
from typing import Any, Protocol

from .raw import to_jsonable


# =============================================================================
# Common CLI helpers
# =============================================================================

def _cli_timeout() -> float:
    try:
        return float(os.getenv("MULTILLM_CLI_TIMEOUT", "360"))
    except ValueError:
        return 360.0


def _reasoning_effort() -> str:
    # Default "high" (not "xhigh"): under the whole-pipeline wall-clock budget each stage gets a
    # limited slice, and xhigh routinely exceeds it. "high" is the balanced default; override with
    # MULTILLM_REASONING_EFFORT=xhigh|max when you have the time budget.
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


_CLAUDE_EFFORTS = {"low", "medium", "high", "xhigh", "max"}


def _claude_effort(effort: str) -> str:
    """Clamp to a value Claude's --effort accepts (Codex additionally allows none/minimal)."""
    e = (effort or "").strip().lower()
    if e in _CLAUDE_EFFORTS:
        return e
    if e in {"none", "minimal"}:
        return "low"
    return "high"


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
        with contextlib.suppress(ProcessLookupError):
            proc.kill()
    with contextlib.suppress(Exception):
        await proc.wait()


async def _run_cli(
    cmd: list[str],
    *,
    stdin_text: str | None,
    cwd: str | None,
    timeout: float,
) -> tuple[int, str, str]:
    """Run a CLI as a subprocess. Long-form input is passed via stdin. Returns (rc, stdout, stderr).

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
    rc = proc.returncode if proc.returncode is not None else 0
    return rc, out.decode("utf-8", "replace"), err.decode("utf-8", "replace")


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
# Claude Code CLI  (anthropic / claude)  — claude -p --json-schema (native structured output)
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
        model_id = os.getenv("MULTILLM_CLAUDE_MODEL") or model
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
            # cwd=tmp → avoids loading the project's CLAUDE.md/hooks. --bare is not used so subscription auth works.
            rc, out, err = await _run_cli(cmd, stdin_text=user_prompt, cwd=tmp, timeout=timeout)
        if rc != 0:
            raise RuntimeError(f"claude -p failed (exit {rc}): {err.strip()[:500]}")
        try:
            data = json.loads(out)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"claude -p JSON envelope parsing failed: {out[:300]}") from exc
        if data.get("is_error"):
            raise RuntimeError(f"claude -p error: {str(data.get('result', ''))[:300]}")
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
        return ProviderResponse(
            provider=self.name,
            model=model_id,
            request=to_jsonable(request),
            response_text=response_text,
            response_meta=meta,
        )


# =============================================================================
# Codex CLI  (openai)  — codex exec --output-schema (native structured output), reasoning xhigh
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
        model_id = os.getenv("MULTILLM_CODEX_MODEL") or model
        effort = _reasoning_effort()
        timeout = _cli_timeout()
        with tempfile.TemporaryDirectory(prefix="mll_codex_") as tmp:
            schema_file = os.path.join(tmp, "schema.json")
            out_file = os.path.join(tmp, "out.json")
            with open(schema_file, "w", encoding="utf-8") as fh:
                json.dump(schema, fh, ensure_ascii=False)
            cmd = [
                binary, "exec",
                system_prompt,                      # role directive = prompt arg
                "--output-schema", schema_file,
                "-o", out_file,
                "-m", model_id,
                "-c", f"model_reasoning_effort={effort}",
                "-s", "read-only",
                "--skip-git-repo-check",
                "--ephemeral",
            ]
            # Long-form context (user_prompt) → stdin (codex appends it as a <stdin> block)
            rc, out, err = await _run_cli(cmd, stdin_text=user_prompt, cwd=tmp, timeout=timeout)
            response_text = ""
            try:
                with open(out_file, "r", encoding="utf-8") as fh:
                    response_text = fh.read().strip()
            except FileNotFoundError:
                response_text = ""
        if not response_text:
            if rc != 0:
                raise RuntimeError(f"codex exec failed (exit {rc}): {err.strip()[:500]}")
            raise RuntimeError(f"codex exec produced no structured output: {err.strip()[:300]}")
        request = {
            "backend": "codex-cli",
            "model": model_id,
            "reasoning_effort": effort,
            "argv": cmd,
            "system_prompt_chars": len(system_prompt),
            "user_prompt_chars": len(user_prompt),
        }
        meta = {"backend": "codex-cli", "model": model_id, "reasoning_effort": effort}
        return ProviderResponse(
            provider=self.name,
            model=model_id,
            request=to_jsonable(request),
            response_text=response_text,
            response_meta=meta,
        )


# =============================================================================
# Antigravity CLI  (gemini)  — successor to the Gemini CLI. Default model Gemini 3.5 Flash (High).
#   agy 0.42.0 does not support the --output-format/--model/reasoning flags → the plain-text output
#   is steered with a JSON-only directive and parsed via the executor's Pydantic validation path.
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
        # If an API key was provided via an environment variable or parameter, try calling the Gemini API directly first instead of the agy CLI (works around sandbox login errors)
        effective_api_key = api_key or os.getenv("GEMINI_API_KEY")
        if effective_api_key:
            try:
                loop = asyncio.get_running_loop()
                response_text = await loop.run_in_executor(
                    None,
                    _call_gemini_api,
                    model,
                    effective_api_key,
                    system_prompt,
                    user_prompt,
                    temperature,
                    schema,
                )
                text = _strip_code_fences(response_text.strip())
                request = {
                    "backend": "gemini-api",
                    "model": model,
                    "directive_chars": len(system_prompt),
                    "user_prompt_chars": len(user_prompt),
                }
                meta = {"backend": "gemini-api", "model": model}
                return ProviderResponse(
                    provider=self.name,
                    model=model,
                    request=to_jsonable(request),
                    response_text=text,
                    response_meta=meta,
                )
            except Exception as e:
                import sys
                print(f"Direct Gemini API call failed, falling back to agy CLI: {e}", file=sys.stderr)

        binary = shutil.which("agy") or "agy"
        timeout = _cli_timeout()
        directive = (
            f"{system_prompt}\n\n"
            "[Important] Based on the stdin body below, output exactly one JSON object that "
            "strictly conforms to the following JSON schema, with no code fences or extra explanation:\n"
            f"{json.dumps(schema, ensure_ascii=False)}"
        )
        cmd = [
            binary, "-p", directive,
            "--dangerously-skip-permissions",
            "--print-timeout", _agy_print_timeout(),
        ]
        # agy creates a .antigravitycli/ working directory in cwd, so isolate it in a tempdir.
        tmp = tempfile.mkdtemp(prefix="mll_agy_")
        last_err = ""
        max_attempts = 2
        try:
            for attempt in range(max_attempts):
                try:
                    rc, out, err = await _run_cli(cmd, stdin_text=user_prompt, cwd=tmp, timeout=timeout)
                except RuntimeError as exc:
                    # Timeout / exhausted deadline: re-running only burns more of the shared
                    # budget against the same wall-clock ceiling, so do not retry.
                    last_err = str(exc)
                    break
                text = _strip_code_fences(out.strip())
                if rc == 0 and text:
                    request = {
                        "backend": "antigravity-cli",
                        "model": model,
                        "directive_chars": len(directive),
                        "user_prompt_chars": len(user_prompt),
                        "attempt": attempt + 1,
                    }
                    meta = {"backend": "antigravity-cli", "model": model, "attempt": attempt + 1}
                    return ProviderResponse(
                        provider=self.name,
                        model=model,
                        request=to_jsonable(request),
                        response_text=text,
                        response_meta=meta,
                    )
                last_err = err.strip()[:300] or f"exit {rc}"
                # Retry a soft failure once, with bounded jittered backoff, only if the budget allows.
                if attempt + 1 < max_attempts and _deadline_remaining() > _MIN_CALL_FLOOR_SEC + 5:
                    await asyncio.sleep(1.0 + random.random())
                else:
                    break
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        raise RuntimeError(f"agy -p failed: {last_err}")


def _call_gemini_api(
    model: str,
    api_key: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    schema: dict[str, Any],
) -> str:
    import urllib.request
    import urllib.error
    import json

    model_name = model if model.startswith("models/") else f"models/{model}"
    url = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:generateContent?key={api_key}"
    
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
            "responseSchema": schema
        }
    }
    
    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=req_data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    with urllib.request.urlopen(req, timeout=120) as response:
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
        payload = _build_mock_payload(schema_name, user_prompt)
        response_text = json.dumps(payload, ensure_ascii=False)
        request = {
            "model": model,
            "system_prompt": system_prompt,
            "user_prompt": user_prompt,
            "temperature": temperature,
            "mock": True,
        }
        return ProviderResponse(
            provider=self.name,
            model=model,
            request=to_jsonable(request),
            response_text=response_text,
            response_meta={"mock": True},
        )


def _build_mock_payload(schema_name: str, user_prompt: str) -> dict[str, Any]:
    """Return deterministic payloads for contract tests."""
    if schema_name == "generator_output":
        return {
            "draft": "mock-draft",
            "key_points": ["mock-key-point"],
            "confidence": 0.5,
        }
    if schema_name == "critic_output":
        return {
            "strengths": ["mock-strength"],
            "weaknesses": ["mock-weakness"],
            "suggestions": ["mock-suggestion"],
            "overall_score": 5,
            "critical_issues": [],
        }
    if schema_name == "refiner_output":
        return {
            "final_content": "mock-final-content",
            "improvements_made": ["mock-improvement"],
            "quality_score": 7,
        }
    return {"message": f"mock-response for {schema_name}", "prompt": user_prompt}


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
