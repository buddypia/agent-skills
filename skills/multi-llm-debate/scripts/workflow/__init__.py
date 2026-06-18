"""Debate pattern workflow module."""

from .config import AgentConfig
from .settings import (
    DEFAULT_MODELS,
    PROPONENT_DEFAULTS,
    OPPONENT_DEFAULTS,
    MODERATOR_DEFAULTS,
    PROPONENT_ENV_KEYS,
    OPPONENT_ENV_KEYS,
    MODERATOR_ENV_KEYS,
    create_agent_config_from_env,
    create_default_configs,
    print_config_info,
)
from .types import (
    PromptPayload,
    ProponentOutput,
    OpponentOutput,
    ModeratorOutput,
    DebateResult,
)
from .proponent import ProponentExecutor
from .opponent import OpponentExecutor
from .moderator import ModeratorExecutor
from .workflow import build_debate_workflow, PromptIngress

__all__ = [
    # Config
    "AgentConfig",
    "DEFAULT_MODELS",
    "PROPONENT_DEFAULTS",
    "OPPONENT_DEFAULTS",
    "MODERATOR_DEFAULTS",
    "PROPONENT_ENV_KEYS",
    "OPPONENT_ENV_KEYS",
    "MODERATOR_ENV_KEYS",
    "create_agent_config_from_env",
    "create_default_configs",
    "print_config_info",
    # Types
    "PromptPayload",
    "ProponentOutput",
    "OpponentOutput",
    "ModeratorOutput",
    "DebateResult",
    # Executors
    "ProponentExecutor",
    "OpponentExecutor",
    "ModeratorExecutor",
    # Workflow
    "build_debate_workflow",
    "PromptIngress",
]
