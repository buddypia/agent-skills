"""Reflection-pattern type definitions (5 stages: decompose -> solve -> verify -> integrate -> reflect)."""

from typing import Any, Optional, List

from pydantic import BaseModel, ConfigDict, Field


class PromptPayload(BaseModel):
    """Initial user prompt for the reflection workflow."""

    model_config = ConfigDict(extra="forbid")

    text: str
    metadata: Optional[dict[str, Any]] = None


class DecompositionOutput(BaseModel):
    """Output of the decomposition stage."""

    model_config = ConfigDict(extra="forbid")

    subtasks: List[str] = Field(default_factory=list, description="Subtasks the problem was decomposed into")
    assumptions: List[str] = Field(default_factory=list, description="Premises and assumptions")
    constraints: List[str] = Field(default_factory=list, description="Constraint conditions")
    questions: List[str] = Field(default_factory=list, description="Missing information or items to confirm")
    confidence: float = Field(0.7, ge=0.0, le=1.0, description="Confidence of the decomposition")
    context_digest: str = Field(
        "",
        description=(
            "Faithful, self-contained digest of the original problem/context (goal, "
            "givens, constraints, data) for later stages that will not see the full "
            "original."
        ),
    )


class SolutionItem(BaseModel):
    """Solution for a single subtask."""

    model_config = ConfigDict(extra="forbid")

    subtask: str = Field(..., description="The target subtask")
    answer: str = Field(..., description="The proposed solution for the subtask")


class SolutionOutput(BaseModel):
    """Output of the solution stage."""

    model_config = ConfigDict(extra="forbid")

    solutions: List[SolutionItem] = Field(default_factory=list, description="Per-subtask solutions")
    open_questions: List[str] = Field(default_factory=list, description="Unresolved items or items to confirm")
    risks: List[str] = Field(default_factory=list, description="Potential risks and things to watch out for")
    confidence: float = Field(0.7, ge=0.0, le=1.0, description="Confidence of the solution")


class VerificationOutput(BaseModel):
    """Output of the verification stage."""

    model_config = ConfigDict(extra="forbid")

    issues: List[str] = Field(default_factory=list, description="Logical contradictions, errors, and leaps")
    corrections: List[str] = Field(default_factory=list, description="Proposed corrections")
    self_corrections: List[str] = Field(default_factory=list, description="Record of self-corrections")
    validation_notes: List[str] = Field(default_factory=list, description="Additional verification comments")
    confidence: float = Field(0.7, ge=0.0, le=1.0, description="Confidence of the verification")


class IntegrationOutput(BaseModel):
    """Output of the integration stage."""

    model_config = ConfigDict(extra="forbid")

    integrated_answer: str = Field(..., description="The integrated draft answer")
    applied_corrections: List[str] = Field(default_factory=list, description="The corrections that were applied")
    confidence: float = Field(0.7, ge=0.0, le=1.0, description="Confidence of the integration")


class ReflectionOutput(BaseModel):
    """Output of the reflection stage (final answer)."""

    model_config = ConfigDict(extra="forbid")

    final_response: str = Field(..., description="The final answer (including confidence, uncertainty, and self-corrections)")
    confidence_score: float = Field(0.7, ge=0.0, le=1.0, description="Confidence of the final answer")
    uncertainties: List[str] = Field(default_factory=list, description="Remaining points of uncertainty")
    self_corrections: List[str] = Field(default_factory=list, description="Record of self-corrections")
    reflection_notes: List[str] = Field(default_factory=list, description="Reflections on blind spots and alternative perspectives")


class ContextRelayInfo(BaseModel):
    """How the original context reached the stages (see workflow/context_relay.py).

    Makes relay degradation visible to a caller that only parses the JSON result: a shard
    that failed, a digest truncated to fit the relay budget, or a shard too large to
    summarize faithfully all raise `degraded`, which `main.py` folds into the run's
    top-level `degraded_stages` as "context_distillation".
    """

    model_config = ConfigDict(extra="forbid")

    mode: str = Field("verbatim", description="verbatim | digest | sharded")
    original_chars: int = Field(0, description="Length of the user's original context")
    relayed_chars: int = Field(0, description="Length of what each stage actually received")
    shards: int = Field(0, description="Shards the context was split into (0 if not sharded)")
    failed_shards: int = Field(0, description="Shards that errored, timed out, or were skipped")
    truncated_shards: int = Field(0, description="Shard digests cut to fit the relay budget")
    oversized_shards: int = Field(0, description="Shards above the per-shard size target")
    degraded: bool = Field(False, description="True if the relay lost fidelity in any way")


class StageRawData(BaseModel):
    """Sanitized raw request/response data for a single LLM call."""

    model_config = ConfigDict(extra="forbid")

    provider: str = Field(..., description="Provider name (e.g., openai, anthropic, gemini)")
    model: str = Field(..., description="Model ID used for the call")
    duration_sec: Optional[float] = Field(default=None, description="Time the call took (seconds)")

    # Input (does not contain secrets)
    system_prompt: Optional[str] = Field(default=None, description="System prompt used for the call")
    user_prompt: Optional[str] = Field(default=None, description="User/content prompt used for the call")
    request: dict[str, Any] = Field(default_factory=dict, description="Provider request payload (sanitized)")

    # Output
    response_text: Optional[str] = Field(default=None, description="Raw text returned by the model")
    response_meta: dict[str, Any] = Field(default_factory=dict, description="Metadata such as usage and IDs (sanitized)")
    parsed_output: Optional[dict[str, Any]] = Field(default=None, description="Parsed/normalized output (sanitized)")
    error: Optional[str] = Field(default=None, description="Error message (if any)")


class ReflectionRawData(BaseModel):
    """Raw data for the entire reflection workflow (5 stages)."""

    model_config = ConfigDict(extra="forbid")

    decomposer: Optional[StageRawData] = None
    solver: Optional[StageRawData] = None
    verifier: Optional[StageRawData] = None
    integrator: Optional[StageRawData] = None
    reflector: Optional[StageRawData] = None


class ReflectionResult(BaseModel):
    """Complete reflection workflow result."""

    model_config = ConfigDict(extra="forbid")

    original_prompt: str = Field(..., description="The original user prompt")

    decomposition: DecompositionOutput
    solution: SolutionOutput
    verification: VerificationOutput
    integration: IntegrationOutput
    reflection: ReflectionOutput

    # Context relay provenance — how the original context reached the stages, and whether
    # the relay itself lost fidelity (see `degraded_stages` for the folded-in signal).
    context_relay: Optional[ContextRelayInfo] = Field(
        default=None,
        description="How the original context was relayed to each stage",
    )

    # Degradation signal — set when one or more stages timed out or errored and returned
    # placeholder output. Lets callers tell a real answer apart from a partial/degraded one
    # (the process still exits 0 for backward compatibility; see the stderr warning in main.py).
    degraded: bool = Field(False, description="True if any stage timed out or errored")
    degraded_stages: List[str] = Field(default_factory=list, description="Names of stages that degraded")

    # Metadata
    total_duration_sec: float = Field(0.0)
    decomposer_model: str = Field("")
    solver_model: str = Field("")
    verifier_model: str = Field("")
    integrator_model: str = Field("")
    reflector_model: str = Field("")

    # Raw trace (optional)
    raw: Optional[ReflectionRawData] = Field(
        default=None,
        description="Sanitized raw request/response data for each LLM stage (for debugging)",
    )


# JSON schemas for structured output
DECOMPOSITION_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "subtasks": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Subtasks the problem was decomposed into",
        },
        "assumptions": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Premises and assumptions",
        },
        "constraints": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Constraint conditions",
        },
        "questions": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Missing information or items to confirm",
        },
        "confidence": {
            "type": "number",
            "description": "Confidence of the decomposition 0-1",
        },
        "context_digest": {
            "type": "string",
            "description": (
                "Faithful, self-contained digest of the original problem/context (goal, "
                "givens, constraints, data) for later stages that will not see the full "
                "original. If the problem is already brief, restate it verbatim."
            ),
        },
    },
    "required": ["subtasks", "assumptions", "constraints", "questions", "confidence", "context_digest"],
    "additionalProperties": False,
}

SOLUTION_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "solutions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "subtask": {"type": "string"},
                    "answer": {"type": "string"},
                },
                "required": ["subtask", "answer"],
                "additionalProperties": False,
            },
            "description": "Per-subtask solutions",
        },
        "open_questions": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Unresolved items or items to confirm",
        },
        "risks": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Potential risks and things to watch out for",
        },
        "confidence": {
            "type": "number",
            "description": "Confidence of the solution 0-1",
        },
    },
    "required": ["solutions", "open_questions", "risks", "confidence"],
    "additionalProperties": False,
}

VERIFICATION_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "issues": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Logical contradictions, errors, and leaps",
        },
        "corrections": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Proposed corrections",
        },
        "self_corrections": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Record of self-corrections",
        },
        "validation_notes": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Additional verification comments",
        },
        "confidence": {
            "type": "number",
            "description": "Confidence of the verification 0-1",
        },
    },
    "required": ["issues", "corrections", "self_corrections", "validation_notes", "confidence"],
    "additionalProperties": False,
}

INTEGRATION_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "integrated_answer": {
            "type": "string",
            "description": "The integrated draft answer",
        },
        "applied_corrections": {
            "type": "array",
            "items": {"type": "string"},
            "description": "The corrections that were applied",
        },
        "confidence": {
            "type": "number",
            "description": "Confidence of the integration 0-1",
        },
    },
    "required": ["integrated_answer", "applied_corrections", "confidence"],
    "additionalProperties": False,
}

REFLECTION_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "final_response": {
            "type": "string",
            "description": "The final answer (including confidence, uncertainty, and self-corrections)",
        },
        "confidence_score": {
            "type": "number",
            "description": "Confidence of the final answer 0-1",
        },
        "uncertainties": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Remaining points of uncertainty",
        },
        "self_corrections": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Record of self-corrections",
        },
        "reflection_notes": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Reflections on blind spots and alternative perspectives",
        },
    },
    "required": [
        "final_response",
        "confidence_score",
        "uncertainties",
        "self_corrections",
        "reflection_notes",
    ],
    "additionalProperties": False,
}
