"""Opponent agent - performs analysis from a critical/opposing perspective."""

import json
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
    OpponentOutput,
    StageRawData,
    OPPONENT_JSON_SCHEMA,
)

_MAX_OUTPUT_CHARS: Final[int] = 8000

OPPONENT_SYSTEM_PROMPT: Final[str] = get_prompt("opponent")


def _strip_code_fences(text: str) -> str:
    cleaned = text.strip()
    if not cleaned.startswith("```"):
        return cleaned
    cleaned = cleaned.strip("`").strip()
    if cleaned.startswith("json"):
        cleaned = cleaned[4:].strip()
    return cleaned


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


class OpponentExecutor(Executor):
    """Analyzes the topic from an opposing/critical perspective."""

    def __init__(self, config: AgentConfig):
        super().__init__(id="opponent_executor")
        self.config = config

    @handler
    async def analyze(self, prompt: PromptPayload, ctx: WorkflowContext[OpponentOutput]) -> None:
        """Entry point used when the workflow sends the original PromptPayload."""
        started = time.perf_counter()

        await ctx.set_shared_state("opponent_model", self.config.model)

        original_topic = await ctx.get_shared_state("original_topic") or prompt.text
        proponent_output = await ctx.get_shared_state("proponent_output")

        if not await ctx.get_shared_state("original_topic"):
            await ctx.set_shared_state("original_topic", original_topic)

        raw: StageRawData | None = None
        try:
            result = await self._call_opponent_with_raw(original_topic, proponent_output)
        except Exception as exc:
            parsed = OpponentOutput(
                position=f"[Opponent: error ({exc})]",
                counter_arguments=["An error occurred"],
                risks=[],
                weaknesses=[],
                alternatives=[],
                confidence=0.0,
            )
            raw = StageRawData(
                provider=self.config.normalized_provider(),
                model=self.config.model,
                system_prompt=OPPONENT_SYSTEM_PROMPT,
                user_prompt=original_topic,
                request=to_jsonable({"temperature": self.config.temperature}),
                parsed_output=parsed.model_dump(),
                error=str(exc),
            )
            result = parsed
        else:
            result, raw = result

        duration = time.perf_counter() - started

        await ctx.set_shared_state("opponent_output", result.model_dump())
        await ctx.set_shared_state("opponent_duration", duration)
        if raw is not None:
            raw.duration_sec = duration
            await ctx.set_shared_state("opponent_raw", raw.model_dump())

        await ctx.send_message(result)

    @handler
    async def analyze_from_proponent(
        self, proponent_output: ProponentOutput, ctx: WorkflowContext[OpponentOutput]
    ) -> None:
        """Entry point used when the workflow runs sequentially (proponent -> opponent)."""
        started = time.perf_counter()

        await ctx.set_shared_state("opponent_model", self.config.model)

        # Make the proponent's structured output accessible to downstream steps
        proponent_payload = proponent_output.model_dump()
        await ctx.set_shared_state("proponent_output", proponent_payload)

        original_topic = await ctx.get_shared_state("original_topic") or ""

        raw: StageRawData | None = None
        try:
            result = await self._call_opponent_with_raw(original_topic, proponent_payload)
        except Exception as exc:
            parsed = OpponentOutput(
                position=f"[Opponent: error ({exc})]",
                counter_arguments=["An error occurred"],
                risks=[],
                weaknesses=[],
                alternatives=[],
                confidence=0.0,
            )
            raw = StageRawData(
                provider=self.config.normalized_provider(),
                model=self.config.model,
                system_prompt=OPPONENT_SYSTEM_PROMPT,
                user_prompt=original_topic,
                request=to_jsonable({"temperature": self.config.temperature}),
                parsed_output=parsed.model_dump(),
                error=str(exc),
            )
            result = parsed
        else:
            result, raw = result

        duration = time.perf_counter() - started

        await ctx.set_shared_state("opponent_output", result.model_dump())
        await ctx.set_shared_state("opponent_duration", duration)
        if raw is not None:
            raw.duration_sec = duration
            await ctx.set_shared_state("opponent_raw", raw.model_dump())

        await ctx.send_message(result)

    async def _call_opponent_with_raw(self, topic: str, proponent_output: dict | None) -> tuple[OpponentOutput, StageRawData]:
        provider = self.config.normalized_provider()

        # Build a prompt that includes the proponent's arguments when available
        if proponent_output:
            opponent_prompt = f"""Debate topic:
{topic}

=== Proponent's case ===

Position: {proponent_output.get('position', 'N/A')}

Arguments:
{json.dumps(proponent_output.get('arguments', []), ensure_ascii=False, indent=2)}

Evidence:
{json.dumps(proponent_output.get('evidence', []), ensure_ascii=False, indent=2)}

Expected benefits:
{json.dumps(proponent_output.get('benefits', []), ensure_ascii=False, indent=2)}

Proponent's confidence: {proponent_output.get('confidence', 0.0)}

Based on the above, analyze thoroughly from an opposing/critical perspective."""
        else:
            opponent_prompt = f"Debate topic:\n{topic}"

        adapter = get_adapter(provider)
        schema = OPPONENT_JSON_SCHEMA
        if provider == "gemini":
            schema = deepcopy(OPPONENT_JSON_SCHEMA)
            _apply_property_ordering(schema)

        response = await adapter.generate_structured(
            model=self.config.model,
            api_key=self.config.api_key,
            base_url=self.config.base_url,
            system_prompt=OPPONENT_SYSTEM_PROMPT,
            user_prompt=opponent_prompt,
            temperature=self.config.temperature,
            schema=schema,
            schema_name="opponent_output",
            output_model=OpponentOutput,
        )

        raw = StageRawData(
            provider=provider,
            model=self.config.model,
            system_prompt=OPPONENT_SYSTEM_PROMPT,
            user_prompt=opponent_prompt,
            request=response.request,
            response_text=response.response_text,
            response_meta=response.response_meta,
        )

        parsed_output = response.parsed_output
        if parsed_output is not None:
            if not isinstance(parsed_output, OpponentOutput):
                raise ValueError("Anthropic structured output missing for OpponentOutput")
            parsed = parsed_output
        else:
            parsed = self._parse_response(response.response_text)

        raw.parsed_output = parsed.model_dump()
        return parsed, raw

    def _parse_response(self, text: str) -> OpponentOutput:
        cleaned = _strip_code_fences(text)
        try:
            return OpponentOutput.model_validate_json(cleaned)
        except Exception as exc:
            raise ValueError("Failed to parse the Opponent structured output") from exc
