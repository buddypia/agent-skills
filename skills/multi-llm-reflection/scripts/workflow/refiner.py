"""Refiner agent - creates the final version based on feedback."""

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
    CriticOutput,
    RefinerOutput,
    ReflectionRawData,
    ReflectionResult,
    StageRawData,
    REFINER_JSON_SCHEMA,
)


REFINER_SYSTEM_PROMPT: Final[str] = get_prompt("refiner")


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


def _build_gemini_schema(model_id: str | None) -> dict[str, Any]:
    schema = deepcopy(REFINER_JSON_SCHEMA)
    if _gemini_requires_property_ordering(model_id):
        _apply_property_ordering(schema)
    return schema


class RefinerExecutor(Executor):
    """Creates the final refined version."""

    def __init__(self, config: AgentConfig):
        super().__init__(id="refiner_executor")
        self.config = config

    @handler
    async def refine(self, critic_output: CriticOutput, ctx: WorkflowContext[ReflectionResult]) -> None:
        started = time.perf_counter()

        await ctx.set_shared_state("refiner_model", self.config.model)

        original_prompt = await ctx.get_shared_state("original_prompt") or ""
        generator_output = await ctx.get_shared_state("generator_output") or {}
        generator_duration = await ctx.get_shared_state("generator_duration") or 0.0
        critic_duration = await ctx.get_shared_state("critic_duration") or 0.0

        raw: StageRawData | None = None
        try:
            result = await self._call_refiner_with_raw(original_prompt, generator_output, critic_output)
        except Exception as exc:
            parsed = RefinerOutput(
                final_content=(
                    f"[Refiner: error ({exc})]\n\n"
                    f"Original draft:\n{generator_output.get('draft', 'N/A')}"
                ),
                improvements_made=["Could not apply improvements due to an error"],
                quality_score=critic_output.overall_score,
            )
            raw = StageRawData(
                provider=self.config.normalized_provider(),
                model=self.config.model,
                system_prompt=REFINER_SYSTEM_PROMPT,
                user_prompt=None,
                request=to_jsonable({"temperature": self.config.temperature}),
                parsed_output=parsed.model_dump(),
                error=str(exc),
            )
            result = parsed
        else:
            result, raw = result

        duration = time.perf_counter() - started
        total_duration = generator_duration + critic_duration + duration
        if raw is not None:
            raw.duration_sec = duration
            await ctx.set_shared_state("refiner_raw", raw.model_dump())

        workflow_raw: ReflectionRawData | None = None
        try:
            generator_raw_obj = await ctx.get_shared_state("generator_raw")
            critic_raw_obj = await ctx.get_shared_state("critic_raw")

            workflow_raw = ReflectionRawData(
                generator=StageRawData.model_validate(generator_raw_obj) if generator_raw_obj else None,
                critic=StageRawData.model_validate(critic_raw_obj) if critic_raw_obj else None,
                refiner=raw,
            )
            if workflow_raw.generator is None and workflow_raw.critic is None and workflow_raw.refiner is None:
                workflow_raw = None
        except Exception:
            workflow_raw = None

        final_result = ReflectionResult(
            original_prompt=original_prompt,
            initial_draft=generator_output.get("draft", ""),
            generator_confidence=generator_output.get("confidence", 0.0),
            critic_strengths=critic_output.strengths,
            critic_weaknesses=critic_output.weaknesses,
            critic_suggestions=critic_output.suggestions,
            critic_score=critic_output.overall_score,
            final_content=result.final_content,
            improvements_made=result.improvements_made,
            final_score=result.quality_score,
            total_duration_sec=total_duration,
            generator_model=await ctx.get_shared_state("generator_model") or "",
            critic_model=await ctx.get_shared_state("critic_model") or "",
            refiner_model=self.config.model,
            raw=workflow_raw,
        )

        await ctx.yield_output(final_result)

    async def _call_refiner_with_raw(
        self,
        original_prompt: str,
        generator_output: dict,
        critic_output: CriticOutput,
    ) -> tuple[RefinerOutput, StageRawData]:
        provider = self.config.normalized_provider()
        adapter = get_adapter(provider)

        refine_prompt = (
            f"Original request:\n{original_prompt}\n\n"
            f"Initial draft:\n{generator_output.get('draft', '')}\n\n"
            "=== Critic's feedback ===\n\n"
            f"Strengths:\n{json.dumps(critic_output.strengths, ensure_ascii=False, indent=2)}\n\n"
            f"Weaknesses:\n{json.dumps(critic_output.weaknesses, ensure_ascii=False, indent=2)}\n\n"
            f"Suggestions for improvement:\n{json.dumps(critic_output.suggestions, ensure_ascii=False, indent=2)}\n\n"
            "Critical issues (must be fixed):\n"
            f"{json.dumps(critic_output.critical_issues, ensure_ascii=False, indent=2)}\n\n"
            f"Critic's score: {critic_output.overall_score}/10\n\n"
            "Incorporate all of the feedback above and produce an improved final version."
        )

        schema = REFINER_JSON_SCHEMA
        if provider == "gemini":
            schema = _build_gemini_schema(self.config.model)

        response = await adapter.generate_structured(
            model=self.config.model,
            api_key=self.config.api_key,
            base_url=self.config.base_url,
            system_prompt=REFINER_SYSTEM_PROMPT,
            user_prompt=refine_prompt,
            temperature=self.config.temperature,
            schema=schema,
            schema_name="refiner_output",
            output_model=RefinerOutput,
        )

        raw = StageRawData(
            provider=provider,
            model=self.config.model,
            system_prompt=REFINER_SYSTEM_PROMPT,
            user_prompt=refine_prompt,
            request=response.request,
            response_text=response.response_text,
            response_meta=response.response_meta,
        )

        parsed_output = response.parsed_output
        if parsed_output is not None:
            if not isinstance(parsed_output, RefinerOutput):
                raise ValueError("Anthropic structured output missing for RefinerOutput")
            parsed = parsed_output
        else:
            parsed = self._parse_response(response.response_text)

        raw.parsed_output = parsed.model_dump()
        return parsed, raw

    def _parse_response(self, text: str) -> RefinerOutput:
        cleaned = _strip_code_fences(text)
        try:
            return RefinerOutput.model_validate_json(cleaned)
        except Exception:
            try:
                data = json.loads(cleaned)
                return RefinerOutput(
                    final_content=data.get("final_content", cleaned),
                    improvements_made=data.get("improvements_made", []),
                    quality_score=int(data.get("quality_score", 7)),
                )
            except Exception:
                return RefinerOutput(
                    final_content=cleaned,
                    improvements_made=["Failed to parse the structured response"],
                    quality_score=7,
                )
