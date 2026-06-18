"""Debate pattern agent configuration."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class AgentConfig:
    """Configuration for a debate pattern agent."""

    name: str
    role: str  # "proponent", "opponent", "moderator"
    provider: str  # "openai", "anthropic", "gemini"
    model: str
    api_key: Optional[str]
    base_url: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: float = 0.7
    enabled: bool = True

    def normalized_provider(self) -> str:
        return self.provider.strip().lower()
