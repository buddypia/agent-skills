"""Debate pattern configuration management.

Configuration priority (highest first):
    1. CLI arguments
    2. Environment variables (DEBATE_<ROLE>_<KEY> or <PROVIDER>_API_KEY)
    3. Configuration file (config.yaml / config.json, etc.)
    4. Default values
"""

from __future__ import annotations

import os
import random
from dataclasses import dataclass
from typing import Any, Optional

from .config import AgentConfig


# =============================================================================
# Default Model IDs by Provider
# =============================================================================

DEFAULT_MODELS: dict[str, str] = {
    # Google Gemini: Antigravity default (Gemini 3.5 Flash, 2026-05)
    # Default for the agy CLI path. The pro line requires the "-preview" suffix in google-genai v1beta.
    "gemini": "gemini-3.5-flash",
    # Anthropic Claude: latest Claude Agent SDK (Opus 4.8, 2026-05)
    "anthropic": "claude-opus-4-8",
    "claude": "claude-opus-4-8",
    # OpenAI: latest Codex SDK flagship (GPT-5.5, 2026-04). For coding-focused use, gpt-5.3-codex.
    "openai": "gpt-5.5",
    # Mock provider (offline smoke tests)
    "mock": "mock-v1",
}

# Available providers for random assignment
AVAILABLE_PROVIDERS: list[str] = ["gemini", "anthropic", "openai"]


def get_random_providers() -> tuple[str, str, str]:
    """Randomly assign providers to the three roles (duplicates allowed).

    Returns:
        (proponent_provider, opponent_provider, moderator_provider)
    """
    return (
        random.choice(AVAILABLE_PROVIDERS),
        random.choice(AVAILABLE_PROVIDERS),
        random.choice(AVAILABLE_PROVIDERS),
    )


def get_shuffled_providers() -> tuple[str, str, str]:
    """Shuffle the three providers and assign one to each role (no duplicates).

    Returns:
        (proponent_provider, opponent_provider, moderator_provider)
    """
    providers = AVAILABLE_PROVIDERS.copy()
    random.shuffle(providers)
    return (providers[0], providers[1], providers[2])


# =============================================================================
# Default Agent Settings
# =============================================================================

@dataclass
class DefaultAgentSettings:
    """Default agent settings"""
    provider: str
    model: Optional[str] = None
    temperature: float = 0.7

    def get_model(self) -> str:
        """Get the model ID (uses the provider default if none is configured)"""
        if self.model:
            return self.model
        normalized = self.provider.strip().lower()
        return DEFAULT_MODELS.get(normalized, "gpt-5.5")


# Default configurations for each agent role
PROPONENT_DEFAULTS = DefaultAgentSettings(provider="gemini")
OPPONENT_DEFAULTS = DefaultAgentSettings(provider="anthropic")
MODERATOR_DEFAULTS = DefaultAgentSettings(provider="openai")


# =============================================================================
# Environment Variable Keys
# =============================================================================

@dataclass
class EnvVarKeys:
    """Definitions of environment variable keys"""
    # Role-specific environment variables
    provider: str
    model: str
    api_key: str
    base_url: str
    temperature: str

    # Provider-specific fallback keys for API
    provider_api_key: str
    provider_model: str


PROPONENT_ENV_KEYS = EnvVarKeys(
    provider="DEBATE_PROPONENT_PROVIDER",
    model="DEBATE_PROPONENT_MODEL",
    api_key="DEBATE_PROPONENT_API_KEY",
    base_url="DEBATE_PROPONENT_BASE_URL",
    temperature="DEBATE_PROPONENT_TEMPERATURE",
    provider_api_key="GEMINI_API_KEY",
    provider_model="GEMINI_MODEL_ID",
)

OPPONENT_ENV_KEYS = EnvVarKeys(
    provider="DEBATE_OPPONENT_PROVIDER",
    model="DEBATE_OPPONENT_MODEL",
    api_key="DEBATE_OPPONENT_API_KEY",
    base_url="DEBATE_OPPONENT_BASE_URL",
    temperature="DEBATE_OPPONENT_TEMPERATURE",
    provider_api_key="ANTHROPIC_API_KEY",
    provider_model="ANTHROPIC_MODEL_ID",
)

MODERATOR_ENV_KEYS = EnvVarKeys(
    provider="DEBATE_MODERATOR_PROVIDER",
    model="DEBATE_MODERATOR_MODEL",
    api_key="DEBATE_MODERATOR_API_KEY",
    base_url="DEBATE_MODERATOR_BASE_URL",
    temperature="DEBATE_MODERATOR_TEMPERATURE",
    provider_api_key="OPENAI_API_KEY",
    provider_model="OPENAI_CHAT_MODEL_ID",
)


# =============================================================================
# Settings Resolver
# =============================================================================

def get_env(key: str, default: Any = None) -> Any:
    """Get an environment variable"""
    return os.getenv(key, default)


def get_env_float(key: str, default: float) -> float:
    """Get an environment variable as a float"""
    val = os.getenv(key)
    if val is None:
        return default
    try:
        return float(val)
    except ValueError:
        return default


def resolve_provider_api_key(provider: str) -> tuple[str, str]:
    """Resolve the API KEY environment variable name based on the provider"""
    normalized = provider.strip().lower()
    if normalized == "gemini":
        return "GEMINI_API_KEY", "GEMINI_MODEL_ID"
    elif normalized in {"anthropic", "claude"}:
        return "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL_ID"
    elif normalized == "openai":
        return "OPENAI_API_KEY", "OPENAI_CHAT_MODEL_ID"
    elif normalized == "mock":
        return "", ""
    return "", ""


def resolve_api_key_for_provider(provider: str, role_api_key_env: str) -> Optional[str]:
    """Resolve the API key based on the provider

    Priority:
        1. Role-specific environment variable (DEBATE_<ROLE>_API_KEY)
        2. Provider-specific environment variable (<PROVIDER>_API_KEY)
    """
    # First try role-specific key
    role_key = get_env(role_api_key_env)
    if role_key:
        return role_key

    # Fallback to provider-specific key
    provider_key_env, _ = resolve_provider_api_key(provider)
    return get_env(provider_key_env)


def create_agent_config_from_env(
    name: str,
    role: str,
    env_keys: EnvVarKeys,
    defaults: DefaultAgentSettings,
    config_file: Optional[dict[str, Any]] = None,
) -> AgentConfig:
    """Create an AgentConfig from environment variables and a configuration file

    Args:
        name: Agent name
        role: Agent role
        env_keys: Environment variable key definitions
        defaults: Default settings
        config_file: Values loaded from the configuration file (optional)

    Returns:
        AgentConfig instance
    """
    if config_file is None:
        config_file = {}

    agent_config = config_file.get(role, {})
    global_config = config_file.get("global", {})

    def get_value(key: str, env_key: str, default: Any) -> Any:
        """Get a configuration value (environment variable > config file > default)"""
        # Environment variable first
        env_val = os.getenv(env_key)
        if env_val is not None:
            return env_val

        # Then agent-specific config
        if isinstance(agent_config, dict) and key in agent_config:
            return agent_config[key]

        # Then global config
        if isinstance(global_config, dict) and key in global_config:
            return global_config[key]

        # Finally default
        return default

    # Resolve provider
    provider = get_value("provider", env_keys.provider, defaults.provider)

    # Resolve model
    model_from_env = os.getenv(env_keys.model)
    if model_from_env:
        model = model_from_env
    else:
        # Check provider-specific model env var
        _, provider_model_env = resolve_provider_api_key(provider)
        model_from_provider = os.getenv(provider_model_env)
        if model_from_provider:
            model = model_from_provider
        elif isinstance(agent_config, dict) and "model" in agent_config:
            model = agent_config["model"]
        else:
            # Use provider default
            model = DEFAULT_MODELS.get(provider.strip().lower(), "gpt-5.5")

    # Resolve API key
    api_key = resolve_api_key_for_provider(provider, env_keys.api_key)
    if not api_key and isinstance(agent_config, dict):
        api_key = agent_config.get("api_key")

    # Resolve base_url (env > config > default)
    base_url = os.getenv(env_keys.base_url)
    if provider.strip().lower() == "openai":
        base_url = base_url or os.getenv("OPENAI_BASE_URL")
    if base_url is None:
        if isinstance(agent_config, dict) and "base_url" in agent_config:
            base_url = agent_config.get("base_url")
        elif isinstance(global_config, dict) and "base_url" in global_config:
            base_url = global_config.get("base_url")

    # Resolve numeric values
    temperature_str = get_value("temperature", env_keys.temperature, str(defaults.temperature))

    try:
        temperature = float(temperature_str)
    except (ValueError, TypeError):
        temperature = defaults.temperature

    return AgentConfig(
        name=name,
        role=role,
        provider=provider,
        model=model,
        api_key=api_key,
        base_url=base_url,
        temperature=temperature,
    )


def create_default_configs(
    config_file: Optional[dict[str, Any]] = None,
) -> tuple[AgentConfig, AgentConfig, AgentConfig]:
    """Create AgentConfig for the three agents with default settings

    Args:
        config_file: Values loaded from the configuration file (optional)

    Returns:
        (proponent_config, opponent_config, moderator_config)
    """
    proponent = create_agent_config_from_env(
        name="Proponent",
        role="proponent",
        env_keys=PROPONENT_ENV_KEYS,
        defaults=PROPONENT_DEFAULTS,
        config_file=config_file,
    )

    opponent = create_agent_config_from_env(
        name="Opponent",
        role="opponent",
        env_keys=OPPONENT_ENV_KEYS,
        defaults=OPPONENT_DEFAULTS,
        config_file=config_file,
    )

    moderator = create_agent_config_from_env(
        name="Moderator",
        role="moderator",
        env_keys=MODERATOR_ENV_KEYS,
        defaults=MODERATOR_DEFAULTS,
        config_file=config_file,
    )

    return proponent, opponent, moderator


def print_config_info() -> None:
    """Display the configuration priority and environment variable names"""
    print("""
Configuration priority (highest first):
    1. CLI arguments (--proponent-model, --temperature, etc.)
    2. Environment variables
    3. Configuration file
    4. Default values

Configuration file:
    - Specify explicitly with --config PATH
    - Or the CONFIG_FILE environment variable
    - Or auto-discovery: config.yaml / config.yml / config.json / .config.yaml / .config.yml / .config.json
    - Disable with --no-config

Environment variables:
    [Provider assignment strategy]
    DEBATE_PROVIDER_STRATEGY  : fixed / random / shuffle
    DEBATE_PROVIDER_MODE      : alias for the above
    DEBATE_RANDOM_PROVIDERS   : true/1/yes is equivalent to random
    DEBATE_SHUFFLE_PROVIDERS  : true/1/yes is equivalent to shuffle

    [API keys]
    GEMINI_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY
    OPENAI_BASE_URL (base_url for OpenAI)
    * The mock provider requires no API key

    [Model IDs]
    GEMINI_MODEL_ID / ANTHROPIC_MODEL_ID / OPENAI_CHAT_MODEL_ID

    [Proponent]
    DEBATE_PROPONENT_PROVIDER  : provider (gemini/anthropic/openai/mock)
    DEBATE_PROPONENT_MODEL     : model ID
    DEBATE_PROPONENT_API_KEY   : API key (or GEMINI_API_KEY)
    DEBATE_PROPONENT_BASE_URL  : base_url (mainly for OpenAI)
    DEBATE_PROPONENT_TEMPERATURE: temperature

    [Opponent]
    DEBATE_OPPONENT_PROVIDER   : provider (gemini/anthropic/openai/mock)
    DEBATE_OPPONENT_MODEL      : model ID
    DEBATE_OPPONENT_API_KEY    : API key (or ANTHROPIC_API_KEY)
    DEBATE_OPPONENT_BASE_URL   : base_url (mainly for OpenAI)
    DEBATE_OPPONENT_TEMPERATURE : temperature

    [Moderator]
    DEBATE_MODERATOR_PROVIDER  : provider (gemini/anthropic/openai/mock)
    DEBATE_MODERATOR_MODEL     : model ID
    DEBATE_MODERATOR_API_KEY   : API key (or OPENAI_API_KEY)
    DEBATE_MODERATOR_BASE_URL  : base_url (or OPENAI_BASE_URL)
    DEBATE_MODERATOR_TEMPERATURE: temperature

    [Common parameters (applied to all roles; lower priority than per-role)]
    DEBATE_TEMPERATURE       : temperature (or LLM_TEMPERATURE)
    DEBATE_DEVUI_PORT        : DevUI port (or DEVUI_PORT)

Default provider assignment strategy: shuffle (randomly assigns the 3 vendors 1:1 to the 3 roles)
    Switch to the fixed assignment below with --fixed, or to random-with-duplicates with --random.

Default values (when fixed):
    Proponent: gemini / gemini-3.5-flash
    Opponent:  anthropic / claude-opus-4-8
    Moderator: openai / gpt-5.5
""")
