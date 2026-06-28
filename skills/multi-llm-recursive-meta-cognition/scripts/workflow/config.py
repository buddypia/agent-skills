"""Reflection-pattern agent configuration."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class AgentConfig:
    """Configuration for a reflection-pattern agent."""

    name: str
    role: str  # "generator", "critic", "refiner"
    provider: str  # "openai", "anthropic", "gemini"
    model: str
    api_key: Optional[str]
    base_url: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: float = 0.7
    # Per-stage safety cap (s). The real total bound is the whole-pipeline deadline enforced in
    # providers.py (MULTILLM_TOTAL_DEADLINE); this just stops a single stage from hanging forever.
    # 120s was too tight for "high"/reasoning models and silently degraded stages mid-run.
    timeout_sec: float = 300.0
    enabled: bool = True

    def normalized_provider(self) -> str:
        return self.provider.strip().lower()
