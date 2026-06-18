"""Proponent agent - performs analysis from a supportive/affirmative perspective."""

import time
from copy import deepcopy
from typing import Any, Final

from .engine import Executor, WorkflowContext, handler

from .config import AgentConfig
from .providers import get_adapter
from .prompts import get_prompt
from .raw import to_jsonable
from .types import (
    PromptPayload,
    ProponentOutput,
    StageRawData,
    PROPONENT_JSON_SCHEMA,
)

_MAX_OUTPUT_CHARS: Final[int] = 8000

PROPONENT_SYSTEM_PROMPT: Final[str] = get_prompt("proponent")


def _strip_code_fences(text: str) -> str:
    cleaned = text.strip()
    if not cleaned.startswith("```"):
        return cleaned
    cleaned = cleaned.strip("`").strip()
    if cleaned.startswith("json"):
        cleaned = cleaned[4:].strip()
    return cleaned


def _gemini_requires_property_ordering(model_id: str | None) -> bool:
    # Some Gemini models are strict about JSON schema property ordering.
    # Keep this narrowly scoped to avoid adding non-standard keywords unnecessarily.
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
    schema = deepcopy(PROPONENT_JSON_SCHEMA)
    if _gemini_requires_property_ordering(model_id):
        _apply_property_ordering(schema)
    return schema


class ProponentExecutor(Executor):
    """Analyzes the topic from a supportive perspective."""

    def __init__(self, config: AgentConfig):
        super().__init__(id="proponent_executor")
        self.config = config

    @handler
    async def analyze(self, prompt: PromptPayload, ctx: WorkflowContext[ProponentOutput]) -> None:
        started = time.perf_counter()

        await ctx.set_shared_state("original_topic", prompt.text)
        await ctx.set_shared_state("proponent_model", self.config.model)

        raw: StageRawData | None = None
        try:
            result = await self._call_proponent_with_raw(prompt.text)
        except Exception as exc:
            parsed = ProponentOutput(
                position=f"[Proponent: error ({exc})]",
                arguments=["An error occurred"],
                evidence=[],
                benefits=[],
                confidence=0.0,
            )
            raw = StageRawData(
                provider=self.config.normalized_provider(),
                model=self.config.model,
                system_prompt=PROPONENT_SYSTEM_PROMPT,
                user_prompt=prompt.text,
                request=to_jsonable({"temperature": self.config.temperature}),
                parsed_output=parsed.model_dump(),
                error=str(exc),
            )
            result = parsed
        else:
            result, raw = result

        duration = time.perf_counter() - started

        await ctx.set_shared_state("proponent_output", result.model_dump())
        await ctx.set_shared_state("proponent_duration", duration)
        if raw is not None:
            raw.duration_sec = duration
            await ctx.set_shared_state("proponent_raw", raw.model_dump())

        await ctx.send_message(result)

    async def _call_proponent_with_raw(self, topic: str) -> tuple[ProponentOutput, StageRawData]:
        provider = self.config.normalized_provider()
        adapter = get_adapter(provider)
        user_prompt = f"Debate topic:\n{topic}"

        schema = PROPONENT_JSON_SCHEMA
        if provider == "gemini":
            schema = _build_gemini_schema(self.config.model)

        response = await adapter.generate_structured(
            model=self.config.model,
            api_key=self.config.api_key,
            base_url=self.config.base_url,
            system_prompt=PROPONENT_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=self.config.temperature,
            schema=schema,
            schema_name="proponent_output",
            output_model=ProponentOutput,
        )

        raw = StageRawData(
            provider=provider,
            model=self.config.model,
            system_prompt=PROPONENT_SYSTEM_PROMPT,
            user_prompt=topic,
            request=response.request,
            response_text=response.response_text,
            response_meta=response.response_meta,
        )

        parsed_output = response.parsed_output
        if parsed_output is not None:
            if not isinstance(parsed_output, ProponentOutput):
                raise ValueError("Anthropic structured output missing for ProponentOutput")
            parsed = parsed_output
        else:
            parsed = self._parse_response(response.response_text)

        raw.parsed_output = parsed.model_dump()
        return parsed, raw

    def _parse_response(self, text: str) -> ProponentOutput:
        cleaned = _strip_code_fences(text)
        try:
            return ProponentOutput.model_validate_json(cleaned)
        except Exception as exc:
            raise ValueError("Failed to parse the Proponent structured output") from exc
