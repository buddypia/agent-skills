"""Provider adapters — subscription-auth CLI backends (pure CLI).

Calls the latest models using the user's subscription auth, with no separate API key:
  - gemini             → Antigravity CLI (`agy -p`)    : plain-text output → JSON-only directive + Pydantic validation
  - anthropic / claude → Claude Code     (`claude -p`) : --json-schema native structured output
  - openai             → Codex           (`codex exec`): --output-schema native structured output

Long-form input is always passed via stdin (avoids ARG_MAX / shell escaping).
The role executors are unchanged — they only return a ProviderResponse via the generate_structured() interface.

Environment variables:
  MULTILLM_REASONING_EFFORT   Reasoning effort (default xhigh; applied to Codex)
  MULTILLM_CLI_TIMEOUT        CLI call timeout in seconds (default 360)
  MULTILLM_AGY_PRINT_TIMEOUT  agy --print-timeout value (default 5m)
  MULTILLM_CLAUDE_MODEL / MULTILLM_CODEX_MODEL  per-backend model override (optional)
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import tempfile
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
    return os.getenv("MULTILLM_REASONING_EFFORT", "xhigh").strip() or "xhigh"


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


async def _run_cli(
    cmd: list[str],
    *,
    stdin_text: str | None,
    cwd: str | None,
    timeout: float,
) -> tuple[int, str, str]:
    """Run a CLI as a subprocess. Long-form input is passed via stdin. Returns (rc, stdout, stderr)."""
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdin=asyncio.subprocess.PIPE if stdin_text is not None else None,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=cwd,
    )
    payload = stdin_text.encode("utf-8") if stdin_text is not None else None
    try:
        out, err = await asyncio.wait_for(proc.communicate(payload), timeout=timeout)
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except ProcessLookupError:
            pass
        raise RuntimeError(f"CLI timeout after {timeout}s: {cmd[0]}")
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
        try:
            for attempt in range(2):
                rc, out, err = await _run_cli(cmd, stdin_text=user_prompt, cwd=tmp, timeout=timeout)
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
