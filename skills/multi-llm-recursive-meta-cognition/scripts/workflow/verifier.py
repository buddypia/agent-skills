"""Verifier agent - verifies the proposed solution and performs self-correction."""

import asyncio
import json
import time
from copy import deepcopy
from typing import Any, Final

from .engine import Executor, WorkflowContext, handler
from .config import AgentConfig
from .prompts import get_prompt
from .providers import get_adapter
from .raw import to_jsonable
from .types import (
    SolutionOutput,
    VerificationOutput,
    StageRawData,
    VERIFICATION_JSON_SCHEMA,
)


VERIFIER_SYSTEM_PROMPT: Final[str] = get_prompt("verifier")


def _strip_code_fences(text: str) -> str:
    cleaned = text.strip()
    if not cleaned.startswith("```"):
        return cleaned
    cleaned = cleaned.strip("`").strip()
    if cleaned.startswith("json"):
        cleaned = cleaned[4:].strip()
    return cleaned


def _gemini_requires_property_ordering(model_id: str | None) -> bool:
    model = (model_id or "").lower()
    return any(token in model for token in ("gemini-3.5-flash",))


def _apply_property_ordering(schema: dict[str, Any]) -> None:
    if not isinstance(schema, dict):
        return
    schema_type = schema.get("type")
    if schema_type == "object" or (isinstance(schema_type, list) and "object" in schema_type):
        props = schema.get("properties")
        if isinstance(props, dict):
            schema.setdefault("propertyOrdering", list(props.keys()))
            for prop_schema in props.values():
                if isinstance(prop_schema, dict):
                    _apply_property_ordering(prop_schema)
    items = schema.get("items")
    if isinstance(items, dict):
        _apply_property_ordering(items)
    elif isinstance(items, list):
        for entry in items:
            if isinstance(entry, dict):
                _apply_property_ordering(entry)


def _build_gemini_schema(model_id: str | None) -> dict[str, Any]:
    schema = deepcopy(VERIFICATION_JSON_SCHEMA)
    if _gemini_requires_property_ordering(model_id):
        _apply_property_ordering(schema)
    return schema


class VerifierExecutor(Executor):
    """Verifies the proposed solution and performs self-correction."""

    def __init__(self, config: AgentConfig):
        super().__init__(id="verifier_executor")
        self.config = config

    @handler
    async def verify(self, solution: SolutionOutput, ctx: WorkflowContext[VerificationOutput]) -> None:
        started = time.perf_counter()

        await ctx.set_shared_state("verifier_model", self.config.model)

        original_prompt = await ctx.get_shared_state("original_prompt") or ""
        decomposition_output = await ctx.get_shared_state("decomposition_output") or {}

        raw: StageRawData | None = None
        try:
            result = await asyncio.wait_for(
                self._call_verifier_with_raw(original_prompt, decomposition_output, solution),
                timeout=self.config.timeout_sec,
            )
        except asyncio.TimeoutError:
            parsed = VerificationOutput(
                issues=["A timeout occurred"],
                corrections=[],
                self_corrections=[],
                validation_notes=["Could not verify due to a timeout"],
                confidence=0.0,
            )
            raw = StageRawData(
                provider=self.config.normalized_provider(),
                model=self.config.model,
                system_prompt=VERIFIER_SYSTEM_PROMPT,
                user_prompt=None,
                request=to_jsonable(
                    {"temperature": self.config.temperature, "timeout_sec": self.config.timeout_sec}
                ),
                parsed_output=parsed.model_dump(),
                error=f"Timeout ({self.config.timeout_sec}s)",
            )
            result = parsed
        except Exception as exc:
            parsed = VerificationOutput(
                issues=[f"An error occurred during verification: {exc}"],
                corrections=[],
                self_corrections=[],
                validation_notes=["An error occurred"],
                confidence=0.0,
            )
            raw = StageRawData(
                provider=self.config.normalized_provider(),
                model=self.config.model,
                system_prompt=VERIFIER_SYSTEM_PROMPT,
                user_prompt=None,
                request=to_jsonable(
                    {"temperature": self.config.temperature, "timeout_sec": self.config.timeout_sec}
                ),
                parsed_output=parsed.model_dump(),
                error=str(exc),
            )
            result = parsed
        else:
            result, raw = result

        duration = time.perf_counter() - started

        await ctx.set_shared_state("verification_output", result.model_dump())
        await ctx.set_shared_state("verifier_duration", duration)
        if raw is not None:
            raw.duration_sec = duration
            await ctx.set_shared_state("verifier_raw", raw.model_dump())

        await ctx.send_message(result)

    async def _call_verifier_with_raw(
        self,
        original_prompt: str,
        decomposition_output: dict,
        solution: SolutionOutput,
    ) -> tuple[VerificationOutput, StageRawData]:
        provider = self.config.normalized_provider()
        adapter = get_adapter(provider)

        verify_prompt = (
            f"Original request:\n{original_prompt}\n\n"
            "Decomposition result:\n"
            f"Subtasks: {json.dumps(decomposition_output.get('subtasks', []), ensure_ascii=False, indent=2)}\n"
            f"Assumptions: {json.dumps(decomposition_output.get('assumptions', []), ensure_ascii=False, indent=2)}\n"
            f"Constraints: {json.dumps(decomposition_output.get('constraints', []), ensure_ascii=False, indent=2)}\n"
            f"Items to confirm: {json.dumps(decomposition_output.get('questions', []), ensure_ascii=False, indent=2)}\n\n"
            "Proposed solution:\n"
            f"{json.dumps(solution.model_dump(), ensure_ascii=False, indent=2)}\n\n"
            "Please verify the proposed solution above and present any problems and proposed corrections."
        )

        schema = VERIFICATION_JSON_SCHEMA
        if provider == "gemini":
            schema = _build_gemini_schema(self.config.model)

        response = await adapter.generate_structured(
            model=self.config.model,
            api_key=self.config.api_key,
            base_url=self.config.base_url,
            system_prompt=VERIFIER_SYSTEM_PROMPT,
            user_prompt=verify_prompt,
            temperature=self.config.temperature,
            schema=schema,
            schema_name="verification_output",
            output_model=VerificationOutput,
        )

        raw = StageRawData(
            provider=provider,
            model=self.config.model,
            system_prompt=VERIFIER_SYSTEM_PROMPT,
            user_prompt=verify_prompt,
            request=response.request,
            response_text=response.response_text,
            response_meta=response.response_meta,
        )

        parsed_output = response.parsed_output
        if parsed_output is not None:
            if not isinstance(parsed_output, VerificationOutput):
                raise ValueError("Anthropic structured output missing for VerificationOutput")
            parsed = parsed_output
        else:
            parsed = self._parse_response(response.response_text)

        raw.parsed_output = parsed.model_dump()
        return parsed, raw

    def _parse_response(self, text: str) -> VerificationOutput:
        cleaned = _strip_code_fences(text)
        try:
            return VerificationOutput.model_validate_json(cleaned)
        except Exception:
            try:
                data = json.loads(cleaned)
                return VerificationOutput(
                    issues=data.get("issues", []),
                    corrections=data.get("corrections", []),
                    self_corrections=data.get("self_corrections", []),
                    validation_notes=data.get("validation_notes", []),
                    confidence=float(data.get("confidence", 0.7)),
                )
            except Exception:
                return VerificationOutput(
                    issues=[cleaned[:500] if cleaned else "The response is empty"],
                    corrections=[],
                    self_corrections=[],
                    validation_notes=[],
                    confidence=0.5,
                )
