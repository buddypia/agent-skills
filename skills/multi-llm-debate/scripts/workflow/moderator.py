"""Moderator agent - evaluates both perspectives and renders a final verdict."""

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
    OpponentOutput,
    ModeratorOutput,
    DebateResult,
    DebateRawData,
    StageRawData,
    MODERATOR_JSON_SCHEMA,
)

_MAX_OUTPUT_CHARS: Final[int] = 8000

MODERATOR_SYSTEM_PROMPT: Final[str] = get_prompt("moderator")


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


class ModeratorExecutor(Executor):
    """Evaluates both perspectives and provides a final verdict."""

    def __init__(self, config: AgentConfig):
        super().__init__(id="moderator_executor")
        self.config = config

    @handler
    async def evaluate(self, opponent_output: OpponentOutput, ctx: WorkflowContext[DebateResult]) -> None:
        started = time.perf_counter()

        await ctx.set_shared_state("moderator_model", self.config.model)

        original_topic = await ctx.get_shared_state("original_topic") or ""
        proponent_output = await ctx.get_shared_state("proponent_output") or {}
        proponent_duration = await ctx.get_shared_state("proponent_duration") or 0.0
        opponent_duration = await ctx.get_shared_state("opponent_duration") or 0.0

        raw: StageRawData | None = None
        try:
            result = await self._call_moderator_with_raw(original_topic, proponent_output, opponent_output)
        except Exception as exc:
            parsed = ModeratorOutput(
                summary=f"[Moderator: error ({exc})]",
                proponent_score=5,
                opponent_score=5,
                key_insights=["An error occurred"],
                final_verdict="Could not reach a final verdict due to an error.",
                recommendation="Please try again.",
                confidence=0.0,
            )
            raw = StageRawData(
                provider=self.config.normalized_provider(),
                model=self.config.model,
                system_prompt=MODERATOR_SYSTEM_PROMPT,
                user_prompt=original_topic,
                request=to_jsonable({"temperature": self.config.temperature}),
                parsed_output=parsed.model_dump(),
                error=str(exc),
            )
            result = parsed
        else:
            result, raw = result

        duration = time.perf_counter() - started
        total_duration = proponent_duration + opponent_duration + duration

        if raw is not None:
            raw.duration_sec = duration
            await ctx.set_shared_state("moderator_raw", raw.model_dump())

        # Collect raw data
        proponent_raw_data = await ctx.get_shared_state("proponent_raw")
        opponent_raw_data = await ctx.get_shared_state("opponent_raw")
        moderator_raw_data = raw.model_dump() if raw else None

        debate_raw: DebateRawData | None = None
        if proponent_raw_data or opponent_raw_data or moderator_raw_data:
            debate_raw = DebateRawData(
                proponent=StageRawData(**proponent_raw_data) if proponent_raw_data else None,
                opponent=StageRawData(**opponent_raw_data) if opponent_raw_data else None,
                moderator=StageRawData(**moderator_raw_data) if moderator_raw_data else None,
            )

        final_result = DebateResult(
            original_topic=original_topic,
            # Proponent data
            proponent_position=proponent_output.get("position", ""),
            proponent_arguments=proponent_output.get("arguments", []),
            proponent_evidence=proponent_output.get("evidence", []),
            proponent_benefits=proponent_output.get("benefits", []),
            proponent_confidence=proponent_output.get("confidence", 0.0),
            # Opponent data
            opponent_position=opponent_output.position,
            opponent_counter_arguments=opponent_output.counter_arguments,
            opponent_risks=opponent_output.risks,
            opponent_weaknesses=opponent_output.weaknesses,
            opponent_alternatives=opponent_output.alternatives,
            opponent_confidence=opponent_output.confidence,
            # Moderator data
            debate_summary=result.summary,
            proponent_score=result.proponent_score,
            opponent_score=result.opponent_score,
            key_insights=result.key_insights,
            final_verdict=result.final_verdict,
            recommendation=result.recommendation,
            # Metadata
            total_duration_sec=total_duration,
            proponent_model=await ctx.get_shared_state("proponent_model") or "",
            opponent_model=await ctx.get_shared_state("opponent_model") or "",
            moderator_model=self.config.model,
            # Raw data
            raw=debate_raw,
        )

        await ctx.yield_output(final_result)

    async def _call_moderator_with_raw(
        self,
        original_topic: str,
        proponent_output: dict,
        opponent_output: OpponentOutput,
    ) -> tuple[ModeratorOutput, StageRawData]:
        provider = self.config.normalized_provider()

        moderator_prompt = f"""Debate topic:
{original_topic}

=== Proponent's case ===

Position: {proponent_output.get('position', 'N/A')}

Arguments:
{json.dumps(proponent_output.get('arguments', []), ensure_ascii=False, indent=2)}

Evidence:
{json.dumps(proponent_output.get('evidence', []), ensure_ascii=False, indent=2)}

Benefits:
{json.dumps(proponent_output.get('benefits', []), ensure_ascii=False, indent=2)}

Confidence: {proponent_output.get('confidence', 0.0)}

=== Opponent's case ===

Position: {opponent_output.position}

Counterarguments:
{json.dumps(opponent_output.counter_arguments, ensure_ascii=False, indent=2)}

Risks:
{json.dumps(opponent_output.risks, ensure_ascii=False, indent=2)}

Weaknesses:
{json.dumps(opponent_output.weaknesses, ensure_ascii=False, indent=2)}

Alternatives:
{json.dumps(opponent_output.alternatives, ensure_ascii=False, indent=2)}

Confidence: {opponent_output.confidence}

Evaluate both sides objectively and present a balanced final verdict."""

        adapter = get_adapter(provider)
        schema = MODERATOR_JSON_SCHEMA
        if provider == "gemini":
            schema = deepcopy(MODERATOR_JSON_SCHEMA)
            _apply_property_ordering(schema)

        response = await adapter.generate_structured(
            model=self.config.model,
            api_key=self.config.api_key,
            base_url=self.config.base_url,
            system_prompt=MODERATOR_SYSTEM_PROMPT,
            user_prompt=moderator_prompt,
            temperature=self.config.temperature,
            schema=schema,
            schema_name="moderator_output",
            output_model=ModeratorOutput,
        )

        raw = StageRawData(
            provider=provider,
            model=self.config.model,
            system_prompt=MODERATOR_SYSTEM_PROMPT,
            user_prompt=moderator_prompt,
            request=response.request,
            response_text=response.response_text,
            response_meta=response.response_meta,
        )

        parsed_output = response.parsed_output
        if parsed_output is not None:
            if not isinstance(parsed_output, ModeratorOutput):
                raise ValueError("Anthropic structured output missing for ModeratorOutput")
            parsed = parsed_output
        else:
            parsed = self._parse_response(response.response_text)

        raw.parsed_output = parsed.model_dump()
        return parsed, raw

    def _parse_response(self, text: str) -> ModeratorOutput:
        cleaned = _strip_code_fences(text)
        try:
            return ModeratorOutput.model_validate_json(cleaned)
        except Exception as exc:
            raise ValueError("Failed to parse the Moderator structured output") from exc
