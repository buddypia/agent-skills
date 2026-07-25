"""Decomposer agent - breaks the problem down into its component parts."""

import asyncio
import json
import time
from copy import deepcopy
from typing import Any, Final

from .engine import Executor, WorkflowContext, handler
from .config import AgentConfig
from .context_relay import distill_context, relay_context
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


def _build_gemini_schema() -> dict[str, Any]:
    """Add Gemini's "propertyOrdering" hint to a copy of the stage schema.

    This used to be gated on a hardcoded list of model IDs ("gemini-3.6-flash",
    "gemini-3.5-flash"), which silently stopped applying the workaround the moment the
    default Gemini model moved on — the schema would then be sent without the hint and
    nothing would say so. The key is additive and only meaningful to Gemini, and this
    helper is already called only on the gemini path, so apply it unconditionally.
    """
    schema = deepcopy(DECOMPOSITION_JSON_SCHEMA)
    _apply_property_ordering(schema)
    return schema


class DecomposerExecutor(Executor):
    """Decomposes the problem.

    Also owns the optional sharded context pre-distillation (tier 2): being the first of
    five stages, it is the only place that can shrink the context before *any* stage reads
    it — and with five stages the saving compounds the most here.
    """

    def __init__(self, config: AgentConfig, distill_configs: list[AgentConfig] | None = None):
        super().__init__(id="decomposer_executor")
        self.config = config
        # Vendors available to the pre-distillation fan-out (round-robin across stages).
        self.distill_configs = list(distill_configs) if distill_configs else [config]

    @handler
    async def decompose(self, prompt: PromptPayload, ctx: WorkflowContext[DecompositionOutput]) -> None:
        started = time.perf_counter()

        await ctx.set_shared_state("original_prompt", prompt.text)
        await ctx.set_shared_state("decomposer_model", self.config.model)

        # Tier 2: for very large context, shard it and distill the shards concurrently
        # across vendors, then let every stage (this one included) work from that pack.
        pack, relay_report = await distill_context(prompt.text, self.distill_configs)
        if pack:
            await ctx.set_shared_state("context_digest", pack)
        if relay_report is not None:
            # Carried to the final stage so per-shard degradation reaches the JSON result.
            await ctx.set_shared_state("context_relay_report", relay_report)
        relay_prompt = relay_context(prompt.text, pack or "")

        raw: StageRawData | None = None
        try:
            result = await asyncio.wait_for(
                self._call_decomposer_with_raw(relay_prompt),
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
                user_prompt=relay_prompt,
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
                user_prompt=relay_prompt,
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
        # With a tier-2 pack the downstream digest is already set; overwriting it with the
        # decomposer's own field would be a digest of a digest, so only tier 1 sets it here.
        if not pack:
            await ctx.set_shared_state("context_digest", result.context_digest)
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
            schema = _build_gemini_schema()

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
