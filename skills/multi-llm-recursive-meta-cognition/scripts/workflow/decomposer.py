"""Decomposer agent - breaks the problem down into its component parts."""

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
    PromptPayload,
    DecompositionOutput,
    StageRawData,
    DECOMPOSITION_JSON_SCHEMA,
)


DECOMPOSER_SYSTEM_PROMPT: Final[str] = get_prompt("decomposer")


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
    schema = deepcopy(DECOMPOSITION_JSON_SCHEMA)
    if _gemini_requires_property_ordering(model_id):
        _apply_property_ordering(schema)
    return schema


class DecomposerExecutor(Executor):
    """Decomposes the problem."""

    def __init__(self, config: AgentConfig):
        super().__init__(id="decomposer_executor")
        self.config = config

    @handler
    async def decompose(self, prompt: PromptPayload, ctx: WorkflowContext[DecompositionOutput]) -> None:
        started = time.perf_counter()

        await ctx.set_shared_state("original_prompt", prompt.text)
        await ctx.set_shared_state("decomposer_model", self.config.model)

        raw: StageRawData | None = None
        try:
            result = await asyncio.wait_for(
                self._call_decomposer_with_raw(prompt.text),
                timeout=self.config.timeout_sec,
            )
        except asyncio.TimeoutError:
            parsed = DecompositionOutput(
                subtasks=["A timeout occurred"],
                assumptions=[],
                constraints=[],
                questions=["Could not decompose due to a timeout"],
                confidence=0.0,
            )
            raw = StageRawData(
                provider=self.config.normalized_provider(),
                model=self.config.model,
                system_prompt=DECOMPOSER_SYSTEM_PROMPT,
                user_prompt=prompt.text,
                request=to_jsonable(
                    {"temperature": self.config.temperature, "timeout_sec": self.config.timeout_sec}
                ),
                parsed_output=parsed.model_dump(),
                error=f"Timeout ({self.config.timeout_sec}s)",
            )
            result = parsed
        except Exception as exc:
            parsed = DecompositionOutput(
                subtasks=["An error occurred"],
                assumptions=[],
                constraints=[],
                questions=[f"An error occurred during decomposition: {exc}"],
                confidence=0.0,
            )
            raw = StageRawData(
                provider=self.config.normalized_provider(),
                model=self.config.model,
                system_prompt=DECOMPOSER_SYSTEM_PROMPT,
                user_prompt=prompt.text,
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

        await ctx.set_shared_state("decomposition_output", result.model_dump())
        await ctx.set_shared_state("decomposer_duration", duration)
        if raw is not None:
            raw.duration_sec = duration
            await ctx.set_shared_state("decomposer_raw", raw.model_dump())

        await ctx.send_message(result)

    async def _call_decomposer_with_raw(self, user_prompt: str) -> tuple[DecompositionOutput, StageRawData]:
        provider = self.config.normalized_provider()
        adapter = get_adapter(provider)

        schema = DECOMPOSITION_JSON_SCHEMA
        if provider == "gemini":
            schema = _build_gemini_schema(self.config.model)

        response = await adapter.generate_structured(
            model=self.config.model,
            api_key=self.config.api_key,
            base_url=self.config.base_url,
            system_prompt=DECOMPOSER_SYSTEM_PROMPT,
            user_prompt=f"User's request:\n{user_prompt}",
            temperature=self.config.temperature,
            schema=schema,
            schema_name="decomposition_output",
            output_model=DecompositionOutput,
        )

        raw = StageRawData(
            provider=provider,
            model=self.config.model,
            system_prompt=DECOMPOSER_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            request=response.request,
            response_text=response.response_text,
            response_meta=response.response_meta,
        )

        parsed_output = response.parsed_output
        if parsed_output is not None:
            if not isinstance(parsed_output, DecompositionOutput):
                raise ValueError("Anthropic structured output missing for DecompositionOutput")
            parsed = parsed_output
        else:
            parsed = self._parse_response(response.response_text)

        raw.parsed_output = parsed.model_dump()
        return parsed, raw

    def _parse_response(self, text: str) -> DecompositionOutput:
        cleaned = _strip_code_fences(text)
        try:
            return DecompositionOutput.model_validate_json(cleaned)
        except Exception:
            try:
                data = json.loads(cleaned)
                return DecompositionOutput(
                    subtasks=data.get("subtasks", []),
                    assumptions=data.get("assumptions", []),
                    constraints=data.get("constraints", []),
                    questions=data.get("questions", []),
                    confidence=float(data.get("confidence", 0.7)),
                )
            except Exception:
                return DecompositionOutput(
                    subtasks=[],
                    assumptions=[],
                    constraints=[],
                    questions=[cleaned[:500] if cleaned else "The response is empty"],
                    confidence=0.5,
                )
