"""Solver agent - solves the decomposed subtasks."""

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
    StageRawData,
    SOLUTION_JSON_SCHEMA,
)


SOLVER_SYSTEM_PROMPT: Final[str] = get_prompt("solver")


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
    schema = deepcopy(SOLUTION_JSON_SCHEMA)
    if _gemini_requires_property_ordering(model_id):
        _apply_property_ordering(schema)
    return schema


class SolverExecutor(Executor):
    """Solves the subtasks."""

    def __init__(self, config: AgentConfig):
        super().__init__(id="solver_executor")
        self.config = config

    @handler
    async def solve(self, decomposition: DecompositionOutput, ctx: WorkflowContext[SolutionOutput]) -> None:
        started = time.perf_counter()

        await ctx.set_shared_state("solver_model", self.config.model)

        original_prompt = await ctx.get_shared_state("original_prompt") or ""

        raw: StageRawData | None = None
        try:
            result = await asyncio.wait_for(
                self._call_solver_with_raw(original_prompt, decomposition),
                timeout=self.config.timeout_sec,
            )
        except asyncio.TimeoutError:
            parsed = SolutionOutput(
                solutions=[],
                open_questions=["Could not solve due to a timeout"],
                risks=["A timeout occurred"],
                confidence=0.0,
            )
            raw = StageRawData(
                provider=self.config.normalized_provider(),
                model=self.config.model,
                system_prompt=SOLVER_SYSTEM_PROMPT,
                user_prompt=None,
                request=to_jsonable(
                    {"temperature": self.config.temperature, "timeout_sec": self.config.timeout_sec}
                ),
                parsed_output=parsed.model_dump(),
                error=f"Timeout ({self.config.timeout_sec}s)",
            )
            result = parsed
        except Exception as exc:
            parsed = SolutionOutput(
                solutions=[],
                open_questions=[f"An error occurred during solving: {exc}"],
                risks=["An error occurred"],
                confidence=0.0,
            )
            raw = StageRawData(
                provider=self.config.normalized_provider(),
                model=self.config.model,
                system_prompt=SOLVER_SYSTEM_PROMPT,
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

        await ctx.set_shared_state("solution_output", result.model_dump())
        await ctx.set_shared_state("solver_duration", duration)
        if raw is not None:
            raw.duration_sec = duration
            await ctx.set_shared_state("solver_raw", raw.model_dump())

        await ctx.send_message(result)

    async def _call_solver_with_raw(
        self, original_prompt: str, decomposition: DecompositionOutput
    ) -> tuple[SolutionOutput, StageRawData]:
        provider = self.config.normalized_provider()
        adapter = get_adapter(provider)

        solve_prompt = (
            f"Original request:\n{original_prompt}\n\n"
            "Decomposition result:\n"
            f"Subtasks: {json.dumps(decomposition.subtasks, ensure_ascii=False, indent=2)}\n"
            f"Assumptions: {json.dumps(decomposition.assumptions, ensure_ascii=False, indent=2)}\n"
            f"Constraints: {json.dumps(decomposition.constraints, ensure_ascii=False, indent=2)}\n"
            f"Items to confirm: {json.dumps(decomposition.questions, ensure_ascii=False, indent=2)}\n\n"
            "Please present a concrete solution for each of the subtasks above."
        )

        schema = SOLUTION_JSON_SCHEMA
        if provider == "gemini":
            schema = _build_gemini_schema(self.config.model)

        response = await adapter.generate_structured(
            model=self.config.model,
            api_key=self.config.api_key,
            base_url=self.config.base_url,
            system_prompt=SOLVER_SYSTEM_PROMPT,
            user_prompt=solve_prompt,
            temperature=self.config.temperature,
            schema=schema,
            schema_name="solution_output",
            output_model=SolutionOutput,
        )

        raw = StageRawData(
            provider=provider,
            model=self.config.model,
            system_prompt=SOLVER_SYSTEM_PROMPT,
            user_prompt=solve_prompt,
            request=response.request,
            response_text=response.response_text,
            response_meta=response.response_meta,
        )

        parsed_output = response.parsed_output
        if parsed_output is not None:
            if not isinstance(parsed_output, SolutionOutput):
                raise ValueError("Anthropic structured output missing for SolutionOutput")
            parsed = parsed_output
        else:
            parsed = self._parse_response(response.response_text)

        raw.parsed_output = parsed.model_dump()
        return parsed, raw

    def _parse_response(self, text: str) -> SolutionOutput:
        cleaned = _strip_code_fences(text)
        try:
            return SolutionOutput.model_validate_json(cleaned)
        except Exception:
            try:
                data = json.loads(cleaned)
                return SolutionOutput(
                    solutions=data.get("solutions", []),
                    open_questions=data.get("open_questions", []),
                    risks=data.get("risks", []),
                    confidence=float(data.get("confidence", 0.7)),
                )
            except Exception:
                return SolutionOutput(
                    solutions=[],
                    open_questions=[cleaned[:500] if cleaned else "The response is empty"],
                    risks=[],
                    confidence=0.5,
                )
