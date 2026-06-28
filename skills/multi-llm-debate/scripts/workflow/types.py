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


class OpponentOutput(BaseModel):
    """Output of the Opponent agent (opposing/critical perspective)."""

    model_config = ConfigDict(extra="forbid")

    position: str = Field(..., description="Clear statement of the opposing position")
    counter_arguments: List[str] = Field(default_factory=list, description="Counterarguments")
    risks: List[str] = Field(default_factory=list, description="Risks and concerns")
    weaknesses: List[str] = Field(default_factory=list, description="Weaknesses of the proposal")
    alternatives: List[str] = Field(default_factory=list, description="Alternative approaches")
    confidence: float = Field(0.7, ge=0.0, le=1.0, description="Confidence in the position")


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
    },
    "required": ["position", "arguments", "evidence", "benefits", "confidence"],
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
