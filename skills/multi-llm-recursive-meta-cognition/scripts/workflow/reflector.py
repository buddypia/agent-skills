"""Reflector agent - finalizes the answer and assigns reflections and a confidence score."""

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
    DecompositionOutput,
    SolutionOutput,
    IntegrationOutput,
    VerificationOutput,
    ReflectionOutput,
    ReflectionRawData,
    ReflectionResult,
    StageRawData,
    REFLECTION_JSON_SCHEMA,
)


REFLECTOR_SYSTEM_PROMPT: Final[str] = get_prompt("reflector")


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
    schema = deepcopy(REFLECTION_JSON_SCHEMA)
    if _gemini_requires_property_ordering(model_id):
        _apply_property_ordering(schema)
    return schema


class ReflectorExecutor(Executor):
    """Finalizes the answer."""

    def __init__(self, config: AgentConfig):
        super().__init__(id="reflector_executor")
        self.config = config

    @handler
    async def reflect(self, integration: IntegrationOutput, ctx: WorkflowContext[ReflectionResult]) -> None:
        started = time.perf_counter()

        await ctx.set_shared_state("reflector_model", self.config.model)

        original_prompt = await ctx.get_shared_state("original_prompt") or ""
        decomposition_output = await ctx.get_shared_state("decomposition_output") or {}
        solution_output = await ctx.get_shared_state("solution_output") or {}
        verification_output = await ctx.get_shared_state("verification_output") or {}

        decomposer_duration = await ctx.get_shared_state("decomposer_duration") or 0.0
        solver_duration = await ctx.get_shared_state("solver_duration") or 0.0
        verifier_duration = await ctx.get_shared_state("verifier_duration") or 0.0
        integrator_duration = await ctx.get_shared_state("integrator_duration") or 0.0

        raw: StageRawData | None = None
        try:
            result = await asyncio.wait_for(
                self._call_reflector_with_raw(
                    original_prompt,
                    decomposition_output,
                    solution_output,
                    verification_output,
                    integration,
                ),
                timeout=self.config.timeout_sec,
            )
        except asyncio.TimeoutError:
            parsed = ReflectionOutput(
                final_response="Could not produce a final answer due to a timeout",
                confidence_score=0.0,
                uncertainties=["A timeout occurred"],
                self_corrections=[],
                reflection_notes=["Reflection skipped due to a timeout"],
            )
            raw = StageRawData(
                provider=self.config.normalized_provider(),
                model=self.config.model,
                system_prompt=REFLECTOR_SYSTEM_PROMPT,
                user_prompt=None,
                request=to_jsonable(
                    {"temperature": self.config.temperature, "timeout_sec": self.config.timeout_sec}
                ),
                parsed_output=parsed.model_dump(),
                error=f"Timeout ({self.config.timeout_sec}s)",
            )
            result = parsed
        except Exception as exc:
            parsed = ReflectionOutput(
                final_response=f"An error occurred while generating the final answer: {exc}",
                confidence_score=0.0,
                uncertainties=["An error occurred"],
                self_corrections=[],
                reflection_notes=["Reflection skipped due to an error"],
            )
            raw = StageRawData(
                provider=self.config.normalized_provider(),
                model=self.config.model,
                system_prompt=REFLECTOR_SYSTEM_PROMPT,
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
        total_duration = (
            decomposer_duration + solver_duration + verifier_duration + integrator_duration + duration
        )
        if raw is not None:
            raw.duration_sec = duration
            await ctx.set_shared_state("reflector_raw", raw.model_dump())

        workflow_raw: ReflectionRawData | None = None
        try:
            decomposer_raw_obj = await ctx.get_shared_state("decomposer_raw")
            solver_raw_obj = await ctx.get_shared_state("solver_raw")
            verifier_raw_obj = await ctx.get_shared_state("verifier_raw")
            integrator_raw_obj = await ctx.get_shared_state("integrator_raw")

            workflow_raw = ReflectionRawData(
                decomposer=StageRawData.model_validate(decomposer_raw_obj) if decomposer_raw_obj else None,
                solver=StageRawData.model_validate(solver_raw_obj) if solver_raw_obj else None,
                verifier=StageRawData.model_validate(verifier_raw_obj) if verifier_raw_obj else None,
                integrator=StageRawData.model_validate(integrator_raw_obj) if integrator_raw_obj else None,
                reflector=raw,
            )
            if (
                workflow_raw.decomposer is None
                and workflow_raw.solver is None
                and workflow_raw.verifier is None
                and workflow_raw.integrator is None
                and workflow_raw.reflector is None
            ):
                workflow_raw = None
        except Exception:
            workflow_raw = None

        final_result = ReflectionResult(
            original_prompt=original_prompt,
            decomposition=DecompositionOutput.model_validate(decomposition_output),
            solution=SolutionOutput.model_validate(solution_output),
            verification=VerificationOutput.model_validate(verification_output),
            integration=integration,
            reflection=result,
            total_duration_sec=total_duration,
            decomposer_model=await ctx.get_shared_state("decomposer_model") or "",
            solver_model=await ctx.get_shared_state("solver_model") or "",
            verifier_model=await ctx.get_shared_state("verifier_model") or "",
            integrator_model=await ctx.get_shared_state("integrator_model") or "",
            reflector_model=self.config.model,
            raw=workflow_raw,
        )

        await ctx.yield_output(final_result)

    async def _call_reflector_with_raw(
        self,
        original_prompt: str,
        decomposition_output: dict,
        solution_output: dict,
        verification_output: dict,
        integration: IntegrationOutput,
    ) -> tuple[ReflectionOutput, StageRawData]:
        provider = self.config.normalized_provider()
        adapter = get_adapter(provider)

        reflect_prompt = (
            f"Original request:\n{original_prompt}\n\n"
            "Decomposition result:\n"
            f"{json.dumps(decomposition_output, ensure_ascii=False, indent=2)}\n\n"
            "Proposed solution:\n"
            f"{json.dumps(solution_output, ensure_ascii=False, indent=2)}\n\n"
            "Verification result:\n"
            f"{json.dumps(verification_output, ensure_ascii=False, indent=2)}\n\n"
            "Integration draft:\n"
            f"{json.dumps(integration.model_dump(), ensure_ascii=False, indent=2)}\n\n"
            "Based on the above, please produce the final answer."
        )

        schema = REFLECTION_JSON_SCHEMA
        if provider == "gemini":
            schema = _build_gemini_schema(self.config.model)

        response = await adapter.generate_structured(
            model=self.config.model,
            api_key=self.config.api_key,
            base_url=self.config.base_url,
            system_prompt=REFLECTOR_SYSTEM_PROMPT,
            user_prompt=reflect_prompt,
            temperature=self.config.temperature,
            schema=schema,
            schema_name="reflection_output",
            output_model=ReflectionOutput,
        )

        raw = StageRawData(
            provider=provider,
            model=self.config.model,
            system_prompt=REFLECTOR_SYSTEM_PROMPT,
            user_prompt=reflect_prompt,
            request=response.request,
            response_text=response.response_text,
            response_meta=response.response_meta,
        )

        parsed_output = response.parsed_output
        if parsed_output is not None:
            if not isinstance(parsed_output, ReflectionOutput):
                raise ValueError("Anthropic structured output missing for ReflectionOutput")
            parsed = parsed_output
        else:
            parsed = self._parse_response(response.response_text)

        raw.parsed_output = parsed.model_dump()
        return parsed, raw

    def _parse_response(self, text: str) -> ReflectionOutput:
        cleaned = _strip_code_fences(text)
        try:
            return ReflectionOutput.model_validate_json(cleaned)
        except Exception:
            try:
                data = json.loads(cleaned)
                return ReflectionOutput(
                    final_response=data.get("final_response", cleaned),
                    confidence_score=float(data.get("confidence_score", 0.7)),
                    uncertainties=data.get("uncertainties", []),
                    self_corrections=data.get("self_corrections", []),
                    reflection_notes=data.get("reflection_notes", []),
                )
            except Exception:
                return ReflectionOutput(
                    final_response=cleaned,
                    confidence_score=0.5,
                    uncertainties=["Failed to parse the structured response"],
                    self_corrections=[],
                    reflection_notes=[],
                )
