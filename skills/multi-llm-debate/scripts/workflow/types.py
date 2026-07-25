"""Debate pattern type definitions."""

from typing import Any, Optional, List

from pydantic import BaseModel, ConfigDict, Field


class PromptPayload(BaseModel):
    """Initial user prompt/topic for the debate workflow."""

    model_config = ConfigDict(extra="forbid")

    text: str
    metadata: Optional[dict[str, Any]] = None


class ProponentOutput(BaseModel):
    """Output of the Proponent agent (supportive/affirmative perspective)."""

    model_config = ConfigDict(extra="forbid")

    position: str = Field(..., description="Clear statement of the supporting position")
    arguments: List[str] = Field(default_factory=list, description="Supporting arguments")
    evidence: List[str] = Field(default_factory=list, description="Evidence and examples")
    benefits: List[str] = Field(default_factory=list, description="Expected benefits")
    confidence: float = Field(0.7, ge=0.0, le=1.0, description="Confidence in the position")
    context_digest: str = Field(
        "",
        description=(
            "Neutral, self-contained digest of the debate topic/context (facts, constraints, "
            "options, evidence) for later stages that will not see the full original. "
            "Do not slant it toward your position."
        ),
    )


class OpponentOutput(BaseModel):
    """Output of the Opponent agent (opposing/critical perspective)."""

    model_config = ConfigDict(extra="forbid")

    position: str = Field(..., description="Clear statement of the opposing position")
    counter_arguments: List[str] = Field(default_factory=list, description="Counterarguments")
    risks: List[str] = Field(default_factory=list, description="Risks and concerns")
    weaknesses: List[str] = Field(default_factory=list, description="Weaknesses of the proposal")
    alternatives: List[str] = Field(default_factory=list, description="Alternative approaches")
    confidence: float = Field(0.7, ge=0.0, le=1.0, description="Confidence in the position")


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

    provider: str = Field(..., description="Provider name (e.g. openai, anthropic, gemini)")
    model: str = Field(..., description="Model ID used for the call")
    duration_sec: Optional[float] = Field(default=None, description="Duration of the call (in seconds)")

    # Inputs (no secrets included)
    system_prompt: Optional[str] = Field(default=None, description="System prompt used for the call")
    user_prompt: Optional[str] = Field(default=None, description="User/content prompt used for the call")
    request: dict[str, Any] = Field(default_factory=dict, description="Provider request payload (sanitized)")

    # Outputs
    response_text: Optional[str] = Field(default=None, description="Raw text returned by the model")
    response_meta: dict[str, Any] = Field(default_factory=dict, description="Metadata such as usage and IDs (sanitized)")
    parsed_output: Optional[dict[str, Any]] = Field(default=None, description="Parsed/normalized output (sanitized)")
    error: Optional[str] = Field(default=None, description="Error message (if any)")


class DebateRawData(BaseModel):
    """Raw data for the entire debate workflow (Proponent/Opponent/Moderator)."""

    model_config = ConfigDict(extra="forbid")

    proponent: Optional[StageRawData] = None
    opponent: Optional[StageRawData] = None
    moderator: Optional[StageRawData] = None


class ModeratorOutput(BaseModel):
    """Output of the Moderator agent (neutral evaluation and final verdict)."""

    model_config = ConfigDict(extra="forbid")

    summary: str = Field(..., description="Summary of both perspectives")
    proponent_score: int = Field(5, ge=0, le=10, description="Score for the Proponent's arguments")
    opponent_score: int = Field(5, ge=0, le=10, description="Score for the Opponent's arguments")
    key_insights: List[str] = Field(default_factory=list, description="Key insights from the debate")
    final_verdict: str = Field(..., description="Final balanced verdict")
    recommendation: str = Field(..., description="Actionable recommendation")
    confidence: float = Field(0.7, ge=0.0, le=1.0, description="Confidence in the verdict")


class DebateResult(BaseModel):
    """Complete debate workflow result."""

    model_config = ConfigDict(extra="forbid")

    original_topic: str = Field(..., description="Original debate topic")

    # Proponent stage
    proponent_position: str = Field(..., description="Proponent's position")
    proponent_arguments: List[str] = Field(default_factory=list)
    proponent_evidence: List[str] = Field(default_factory=list)
    proponent_benefits: List[str] = Field(default_factory=list)
    proponent_confidence: float = Field(0.7)

    # Opponent stage
    opponent_position: str = Field(..., description="Opponent's position")
    opponent_counter_arguments: List[str] = Field(default_factory=list)
    opponent_risks: List[str] = Field(default_factory=list)
    opponent_weaknesses: List[str] = Field(default_factory=list)
    opponent_alternatives: List[str] = Field(default_factory=list)
    opponent_confidence: float = Field(0.7)

    # Moderator stage
    debate_summary: str = Field(..., description="Moderator's summary")
    proponent_score: int = Field(5, description="Proponent's score")
    opponent_score: int = Field(5, description="Opponent's score")
    key_insights: List[str] = Field(default_factory=list)
    final_verdict: str = Field(..., description="Final verdict")
    recommendation: str = Field(..., description="Final recommendation")

    # Context relay provenance — how the original context reached the stages, and whether
    # the relay itself lost fidelity (see `degraded_stages` for the folded-in signal).
    context_relay: Optional[ContextRelayInfo] = Field(
        default=None,
        description="How the original context was relayed to each stage",
    )

    # Degradation signal — set when one or more roles timed out or errored and returned
    # placeholder output, so callers can tell a real verdict from a partial/degraded one
    # (the process still exits 0 for backward compatibility; see the stderr warning in main.py).
    degraded: bool = Field(False, description="True if any role timed out or errored")
    degraded_stages: List[str] = Field(default_factory=list, description="Names of roles that degraded")

    # Metadata
    total_duration_sec: float = Field(0.0)
    proponent_model: str = Field("")
    opponent_model: str = Field("")
    moderator_model: str = Field("")

    # Raw trace (optional)
    raw: Optional[DebateRawData] = Field(
        default=None,
        description="Sanitized raw request/response data for each LLM stage (for debugging)",
    )


# JSON schemas for structured output
PROPONENT_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "position": {
            "type": "string",
            "description": "Clear statement of the supporting position",
        },
        "arguments": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Arguments supporting the position",
        },
        "evidence": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Evidence and examples supporting the position",
        },
        "benefits": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Expected benefits of the position",
        },
        "confidence": {
            "type": "number",
            "description": "Confidence level 0-1",
        },
        "context_digest": {
            "type": "string",
            "description": (
                "Neutral, self-contained digest of the debate topic/context (facts, "
                "constraints, options, evidence) for later stages that will not see the "
                "full original. Do not slant it toward your position; if the topic is "
                "already brief, restate it verbatim."
            ),
        },
    },
    "required": ["position", "arguments", "evidence", "benefits", "confidence", "context_digest"],
    "additionalProperties": False,
}

OPPONENT_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "position": {
            "type": "string",
            "description": "Clear statement of the opposing position",
        },
        "counter_arguments": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Counterarguments to the proposal",
        },
        "risks": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Risks and concerns",
        },
        "weaknesses": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Weaknesses of the original proposal",
        },
        "alternatives": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Alternative approaches to consider",
        },
        "confidence": {
            "type": "number",
            "description": "Confidence level 0-1",
        },
    },
    "required": ["position", "counter_arguments", "risks", "weaknesses", "alternatives", "confidence"],
    "additionalProperties": False,
}

MODERATOR_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "summary": {
            "type": "string",
            "description": "Summary of both perspectives",
        },
        "proponent_score": {
            "type": "integer",
            "description": "Score for the Proponent's arguments (0-10)",
        },
        "opponent_score": {
            "type": "integer",
            "description": "Score for the Opponent's arguments (0-10)",
        },
        "key_insights": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Key insights from the debate",
        },
        "final_verdict": {
            "type": "string",
            "description": "Final balanced verdict",
        },
        "recommendation": {
            "type": "string",
            "description": "Actionable recommendation",
        },
        "confidence": {
            "type": "number",
            "description": "Confidence level 0-1",
        },
    },
    "required": ["summary", "proponent_score", "opponent_score", "key_insights", "final_verdict", "recommendation", "confidence"],
    "additionalProperties": False,
}
