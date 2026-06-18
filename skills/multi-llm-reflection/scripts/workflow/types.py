"""Reflection pattern type definitions."""

from typing import Any, Optional, List

from pydantic import BaseModel, ConfigDict, Field


class PromptPayload(BaseModel):
    """Initial user prompt for the reflection workflow."""

    model_config = ConfigDict(extra="forbid")

    text: str
    metadata: Optional[dict[str, Any]] = None


class GeneratorOutput(BaseModel):
    """Output of the Generator agent (initial draft)."""

    model_config = ConfigDict(extra="forbid")

    draft: str = Field(..., description="Initial draft created by the Generator")
    key_points: List[str] = Field(default_factory=list, description="Key points covered")
    confidence: float = Field(0.7, ge=0.0, le=1.0, description="Confidence level")


class CriticOutput(BaseModel):
    """Output of the Critic agent (feedback and improvements)."""

    model_config = ConfigDict(extra="forbid")

    strengths: List[str] = Field(default_factory=list, description="Strengths of the draft")
    weaknesses: List[str] = Field(default_factory=list, description="Weaknesses to improve")
    suggestions: List[str] = Field(default_factory=list, description="Specific suggestions for improvement")
    overall_score: int = Field(5, ge=0, le=10, description="Overall quality score 0-10")
    critical_issues: List[str] = Field(default_factory=list, description="Critical issues that must be fixed")


class RefinerOutput(BaseModel):
    """Output of the Refiner agent (final version)."""

    model_config = ConfigDict(extra="forbid")

    final_content: str = Field(..., description="The final refined content")
    improvements_made: List[str] = Field(default_factory=list, description="List of improvements applied")
    quality_score: int = Field(8, ge=0, le=10, description="Final quality score")


class StageRawData(BaseModel):
    """Sanitized raw request/response data for a single LLM call."""

    model_config = ConfigDict(extra="forbid")

    provider: str = Field(..., description="Provider name (e.g., openai, anthropic, gemini)")
    model: str = Field(..., description="Model ID used for the call")
    duration_sec: Optional[float] = Field(default=None, description="Time taken for the call (seconds)")

    # Input (does not include secrets)
    system_prompt: Optional[str] = Field(default=None, description="System prompt used for the call")
    user_prompt: Optional[str] = Field(default=None, description="User/content prompt used for the call")
    request: dict[str, Any] = Field(default_factory=dict, description="Provider request payload (sanitized)")

    # Output
    response_text: Optional[str] = Field(default=None, description="Raw text returned by the model")
    response_meta: dict[str, Any] = Field(default_factory=dict, description="Metadata such as usage and IDs (sanitized)")
    parsed_output: Optional[dict[str, Any]] = Field(default=None, description="Parsed/normalized output (sanitized)")
    error: Optional[str] = Field(default=None, description="Error message (if any)")


class ReflectionRawData(BaseModel):
    """Raw data for the entire reflection workflow (Generator/Critic/Refiner)."""

    model_config = ConfigDict(extra="forbid")

    generator: Optional[StageRawData] = None
    critic: Optional[StageRawData] = None
    refiner: Optional[StageRawData] = None


class ReflectionResult(BaseModel):
    """Complete reflection workflow result."""

    model_config = ConfigDict(extra="forbid")

    original_prompt: str = Field(..., description="The original user prompt")

    # Generator stage
    initial_draft: str = Field(..., description="Initial draft from the Generator")
    generator_confidence: float = Field(0.7, description="Generator's confidence")

    # Critic stage
    critic_strengths: List[str] = Field(default_factory=list)
    critic_weaknesses: List[str] = Field(default_factory=list)
    critic_suggestions: List[str] = Field(default_factory=list)
    critic_score: int = Field(5, description="Critic's score for the initial draft")

    # Refiner stage
    final_content: str = Field(..., description="The final refined content")
    improvements_made: List[str] = Field(default_factory=list)
    final_score: int = Field(8, description="Final quality score")

    # Metadata
    total_duration_sec: float = Field(0.0)
    generator_model: str = Field("")
    critic_model: str = Field("")
    refiner_model: str = Field("")

    # Raw trace (optional)
    raw: Optional[ReflectionRawData] = Field(
        default=None,
        description="Sanitized raw request/response data for each LLM stage (for debugging)",
    )


# JSON schemas for structured output
GENERATOR_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "draft": {
            "type": "string",
            "description": "Initial draft content",
        },
        "key_points": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Key points covered in the draft",
        },
        "confidence": {
            "type": "number",
            "description": "Confidence level 0-1",
        },
    },
    "required": ["draft", "key_points", "confidence"],
    "additionalProperties": False,
}

CRITIC_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "strengths": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Strengths of the draft",
        },
        "weaknesses": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Weaknesses to improve",
        },
        "suggestions": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Specific suggestions for improvement",
        },
        "overall_score": {
            "type": "integer",
            "description": "Overall quality score 0-10",
        },
        "critical_issues": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Critical issues that must be fixed",
        },
    },
    "required": ["strengths", "weaknesses", "suggestions", "overall_score", "critical_issues"],
    "additionalProperties": False,
}

REFINER_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "final_content": {
            "type": "string",
            "description": "The final refined content",
        },
        "improvements_made": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of improvements applied",
        },
        "quality_score": {
            "type": "integer",
            "description": "Final quality score 0-10",
        },
    },
    "required": ["final_content", "improvements_made", "quality_score"],
    "additionalProperties": False,
}
