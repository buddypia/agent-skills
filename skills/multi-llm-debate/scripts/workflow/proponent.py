"""Proponent agent - performs analysis from a supportive/affirmative perspective."""

import time
from copy import deepcopy
from typing import Any, Final

from .engine import Executor, WorkflowContext, handler

from .config import AgentConfig
from .context_relay import distill_context, relay_context
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
    schema = deepcopy(PROPONENT_JSON_SCHEMA)
    _apply_property_ordering(schema)
    return schema


class ProponentExecutor(Executor):
    """Analyzes the topic from a supportive perspective.

    Also owns the optional sharded context pre-distillation (tier 2): being the first
    stage, it is the only place that can shrink the context before *any* role reads it.
    """

    def __init__(self, config: AgentConfig, distill_configs: list[AgentConfig] | None = None):
        super().__init__(id="proponent_executor")
        self.config = config
        # Vendors available to the pre-distillation fan-out (round-robin across roles).
        self.distill_configs = list(distill_configs) if distill_configs else [config]

    @handler
    async def analyze(self, prompt: PromptPayload, ctx: WorkflowContext[ProponentOutput]) -> None:
        started = time.perf_counter()

        await ctx.set_shared_state("original_topic", prompt.text)
        await ctx.set_shared_state("proponent_model", self.config.model)

        # Tier 2: for very large context, shard it and distill the shards concurrently
        # across vendors, then let every stage (this one included) work from that pack.
        pack, relay_report = await distill_context(prompt.text, self.distill_configs)
        if pack:
            await ctx.set_shared_state("context_digest", pack)
        if relay_report is not None:
            # Carried to the final stage so per-shard degradation reaches the JSON result.
            await ctx.set_shared_state("context_relay_report", relay_report)
        relay_topic = relay_context(prompt.text, pack or "")

        raw: StageRawData | None = None
        try:
            result = await self._call_proponent_with_raw(relay_topic)
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
                user_prompt=relay_topic,
                request=to_jsonable({"temperature": self.config.temperature}),
                parsed_output=parsed.model_dump(),
                error=str(exc),
            )
            result = parsed
        else:
            result, raw = result

        duration = time.perf_counter() - started

        await ctx.set_shared_state("proponent_output", result.model_dump())
        # With a tier-2 pack the downstream digest is already set; overwriting it with the
        # proponent's own field would be a digest of a digest, so only tier 1 sets it here.
        if not pack:
            await ctx.set_shared_state("context_digest", result.context_digest)
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
            schema = _build_gemini_schema()

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
