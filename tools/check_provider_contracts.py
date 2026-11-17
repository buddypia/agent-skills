#!/usr/bin/env python3
"""Regression contracts for the shared subscription-CLI provider adapters.

Run with any skill's prepared Python environment, for example:
``uv run --project skills/multi-llm-debate/scripts --frozen python tools/check_provider_contracts.py``.
The checks replace subprocess execution with an in-process fake, so they neither contact a
vendor nor require credentials.
"""

from __future__ import annotations

import asyncio
import importlib
import json
import sys
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
SKILLS = (
    "multi-llm-debate",
    "multi-llm-reflection",
    "multi-llm-recursive-meta-cognition",
)


def _unload_workflow() -> None:
    for name in list(sys.modules):
        if name == "workflow" or name.startswith("workflow."):
            del sys.modules[name]


async def _check_skill(skill: str) -> None:
    scripts = (REPO / "skills" / skill / "scripts").resolve()
    sys.path.insert(0, str(scripts))
    _unload_workflow()
    try:
        providers = importlib.import_module("workflow.providers")
        models = importlib.import_module("workflow.models")
        assert models.AGY_DEFAULT_SENTINEL == "agy-default"
        assert models.CLAUDE_DEFAULT_SENTINEL == "claude-default"
        assert models.CODEX_DEFAULT_SENTINEL == "codex-default"
        assert models.uses_agy_cli_default(models.AGY_DEFAULT_SENTINEL)
        assert not models.uses_agy_cli_default("a-future-concrete-default")
        assert models.uses_claude_cli_default(models.CLAUDE_DEFAULT_SENTINEL)
        assert not models.uses_claude_cli_default("a-future-concrete-default")
        assert models.uses_codex_cli_default(models.CODEX_DEFAULT_SENTINEL)
        assert not models.uses_codex_cli_default("a-future-concrete-default")

        structured_error = '{"is_error":true,"error":"TOP_SECRET"}'
        detail = providers._cli_failure_detail(structured_error, "")
        assert "TOP_SECRET" not in detail
        assert detail.startswith("CLI reported an error")
        assert providers._cli_failure_detail(
            "", 'ERROR: {"type":"invalid_request_error","error":{"message":"model is not supported"}}'
        ).startswith("invalid request")

        calls: list[list[str]] = []
        original_run_cli = providers._run_cli

        async def fake_codex(cmd, **_kwargs):
            calls.append(cmd)
            if "--version" in cmd:
                return 0, "codex-cli test-version", ""
            out_path = Path(cmd[cmd.index("-o") + 1])
            out_path.write_text('{"answer":"ok"}', encoding="utf-8")
            return 0, json.dumps({"type": "thread.started", "thread": {"model": "gpt-test-resolved"}}), ""

        providers._run_cli = fake_codex
        default_response = await providers.CodexAdapter().generate_structured(
            model=models.CODEX_DEFAULT_SENTINEL,
            api_key=None,
            base_url=None,
            system_prompt="system",
            user_prompt="user",
            temperature=0,
            schema={"type": "object"},
            schema_name="test",
            output_model=None,
        )
        default_cmd = calls[0]
        assert "-m" not in default_cmd
        assert "--json" in default_cmd
        assert default_response.model == "gpt-test-resolved"
        assert default_response.response_meta["actual_model"] == "gpt-test-resolved"
        assert default_response.response_meta["actual_model_resolution"] == "reported_by_cli"
        assert default_response.response_meta["cli_version"]

        concrete_response = await providers.CodexAdapter().generate_structured(
            model="concrete-model",
            api_key=None,
            base_url=None,
            system_prompt="system",
            user_prompt="user",
            temperature=0,
            schema={"type": "object"},
            schema_name="test",
            output_model=None,
        )
        concrete_cmd = calls[-1]
        assert concrete_cmd[concrete_cmd.index("-m") + 1] == "concrete-model"
        assert concrete_response.response_meta["actual_model"] == "gpt-test-resolved"

        claude_calls: list[list[str]] = []

        async def fake_claude_ok(cmd, **_kwargs):
            claude_calls.append(cmd)
            if "--version" in cmd:
                return 0, "claude-code test-version", ""
            return 0, json.dumps({
                "is_error": False,
                "structured_output": {"answer": "ok"},
                "modelUsage": {"claude-test-resolved": {"canonicalModel": "claude-test-resolved"}},
            }), ""

        providers._run_cli = fake_claude_ok
        claude_default_response = await providers.ClaudeCliAdapter().generate_structured(
            model=models.CLAUDE_DEFAULT_SENTINEL,
            api_key=None,
            base_url=None,
            system_prompt="system",
            user_prompt="user",
            temperature=0,
            schema={"type": "object"},
            schema_name="test",
            output_model=None,
        )
        claude_default_cmd = claude_calls[0]
        assert "--model" not in claude_default_cmd
        assert "--effort" in claude_default_cmd
        assert claude_default_response.model == "claude-test-resolved"
        assert claude_default_response.response_meta["actual_model"] == "claude-test-resolved"
        assert claude_default_response.response_meta["actual_model_resolution"] == "reported_by_cli"
        assert claude_default_response.response_meta["cli_version"]

        await providers.ClaudeCliAdapter().generate_structured(
            model="concrete-claude-model",
            api_key=None,
            base_url=None,
            system_prompt="system",
            user_prompt="user",
            temperature=0,
            schema={"type": "object"},
            schema_name="test",
            output_model=None,
        )
        claude_concrete_cmd = next(c for c in reversed(claude_calls) if "--version" not in c)
        assert claude_concrete_cmd[claude_concrete_cmd.index("--model") + 1] == "concrete-claude-model"

        agy_calls: list[list[str]] = []

        async def fake_agy_ok(cmd, **_kwargs):
            agy_calls.append(cmd)
            if "--version" in cmd:
                return 0, "agy test-version", ""
            return 0, json.dumps({
                "status": "SUCCESS",
                "model": "agy-test-resolved",
                "structured_output": {"answer": "ok"},
            }), ""

        providers._run_cli = fake_agy_ok
        agy_default_response = await providers.AntigravityCliAdapter().generate_structured(
            model=models.AGY_DEFAULT_SENTINEL,
            api_key=None,
            base_url=None,
            system_prompt="system",
            user_prompt="user",
            temperature=0,
            schema={"type": "object"},
            schema_name="test",
            output_model=None,
        )
        agy_default_cmd = agy_calls[0]
        assert "--model" not in agy_default_cmd
        assert "--effort" not in agy_default_cmd
        assert agy_default_response.model == "agy-test-resolved"
        assert agy_default_response.response_meta["actual_model"] == "agy-test-resolved"
        assert agy_default_response.response_meta["actual_model_resolution"] == "reported_by_cli"
        assert agy_default_response.response_meta["reasoning_effort"] == "cli-default"
        assert agy_default_response.response_meta["cli_version"]

        await providers.AntigravityCliAdapter().generate_structured(
            model="concrete-gemini-model",
            api_key=None,
            base_url=None,
            system_prompt="system",
            user_prompt="user",
            temperature=0,
            schema={"type": "object"},
            schema_name="test",
            output_model=None,
        )
        agy_concrete_cmd = next(c for c in reversed(agy_calls) if "--version" not in c)
        assert agy_concrete_cmd[agy_concrete_cmd.index("--model") + 1] == "concrete-gemini-model"
        assert "--effort" in agy_concrete_cmd

        api_models_seen: list[str] = []
        original_call_gemini_api = providers._call_gemini_api

        async def fake_agy_fail(*_args, **_kwargs):
            return 1, "", "agy unavailable"

        def fake_gemini_api(model_arg, *_args, **_kwargs):
            api_models_seen.append(model_arg)
            return '{"answer":"ok"}'

        providers._run_cli = fake_agy_fail
        providers._call_gemini_api = fake_gemini_api
        try:
            fallback_response = await providers.AntigravityCliAdapter().generate_structured(
                model=models.AGY_DEFAULT_SENTINEL,
                api_key="test-key",
                base_url=None,
                system_prompt="system",
                user_prompt="user",
                temperature=0,
                schema={"type": "object"},
                schema_name="test",
                output_model=None,
            )
            assert api_models_seen == [models.GEMINI_API_DEFAULT_MODEL]
            assert fallback_response.model == models.GEMINI_API_DEFAULT_MODEL
            assert fallback_response.response_meta["actual_model"] == models.GEMINI_API_DEFAULT_MODEL
        finally:
            providers._call_gemini_api = original_call_gemini_api

        async def fake_claude(*_args, **_kwargs):
            return 0, structured_error, ""

        providers._run_cli = fake_claude
        try:
            await providers.ClaudeCliAdapter().generate_structured(
                model=models.CLAUDE_DEFAULT_SENTINEL,
                api_key=None,
                base_url=None,
                system_prompt="system",
                user_prompt="user",
                temperature=0,
                schema={"type": "object"},
                schema_name="test",
                output_model=None,
            )
        except RuntimeError as exc:
            assert "TOP_SECRET" not in str(exc)
            assert "diagnostic text was withheld" in str(exc)
        else:
            raise AssertionError("Claude structured error did not raise")

        async def fake_malformed_claude(*_args, **_kwargs):
            return 0, "TOP_SECRET_FROM_MALFORMED_STDOUT", ""

        providers._run_cli = fake_malformed_claude
        try:
            await providers.ClaudeCliAdapter().generate_structured(
                model=models.CLAUDE_DEFAULT_SENTINEL,
                api_key=None,
                base_url=None,
                system_prompt="system",
                user_prompt="user",
                temperature=0,
                schema={"type": "object"},
                schema_name="test",
                output_model=None,
            )
        except RuntimeError as exc:
            assert "TOP_SECRET" not in str(exc)
            assert "invalid JSON envelope" in str(exc)
        else:
            raise AssertionError("Malformed Claude envelope did not raise")
        providers._run_cli = original_run_cli
    finally:
        _unload_workflow()
        sys.path.pop(0)


async def main() -> None:
    for skill in SKILLS:
        await _check_skill(skill)
        print(f"OK: {skill} provider contract")


if __name__ == "__main__":
    asyncio.run(main())
