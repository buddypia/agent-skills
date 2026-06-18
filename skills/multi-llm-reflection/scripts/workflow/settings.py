"""Reflection pattern configuration management.

Configuration priority (highest first):
    1. CLI arguments
    2. Environment variables (REFLECTION_<ROLE>_<KEY> or <PROVIDER>_API_KEY)
    3. Config file (config.yaml / config.json, etc.)
    4. Default values
"""

from __future__ import annotations

import os
import random
from dataclasses import dataclass
from typing import Any, Optional

from .config import AgentConfig


# =============================================================================
# Available Providers
# =============================================================================

AVAILABLE_PROVIDERS: list[str] = ["gemini", "anthropic", "openai"]


def get_random_providers() -> tuple[str, str, str]:
    """Randomly assign a provider to each of the three roles (duplicates allowed)."""
    return (
        random.choice(AVAILABLE_PROVIDERS),
        random.choice(AVAILABLE_PROVIDERS),
        random.choice(AVAILABLE_PROVIDERS),
    )


def get_shuffled_providers() -> tuple[str, str, str]:
    """Shuffle the three providers and assign one to each role (no duplicates)."""
    providers = AVAILABLE_PROVIDERS.copy()
    random.shuffle(providers)
    return (providers[0], providers[1], providers[2])


# =============================================================================
# Default Model IDs by Provider
# =============================================================================

DEFAULT_MODELS: dict[str, str] = {
    # Google Gemini: Antigravity CLI default (Gemini 3.5 Flash, 2026-05)
    "gemini": "gemini-3.5-flash",
    # Anthropic Claude: Claude Code CLI latest (2026-05)
    "anthropic": "claude-opus-4-8",
    "claude": "claude-opus-4-8",
    # OpenAI: Codex CLI latest flagship (2026-04)
    "openai": "gpt-5.5",
    # Mock provider (offline smoke tests)
    "mock": "mock-v1",
}


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
        """Get the model ID (uses the provider's default if not set)"""
        if self.model:
            return self.model
        normalized = self.provider.strip().lower()
        return DEFAULT_MODELS.get(normalized, "gpt-5.5")


# Default configurations for each agent role
GENERATOR_DEFAULTS = DefaultAgentSettings(provider="gemini", model="gemini-3.5-flash")
CRITIC_DEFAULTS = DefaultAgentSettings(provider="anthropic", model="claude-opus-4-8")
REFINER_DEFAULTS = DefaultAgentSettings(provider="openai", model="gpt-5.5")


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


GENERATOR_ENV_KEYS = EnvVarKeys(
    provider="REFLECTION_GENERATOR_PROVIDER",
    model="REFLECTION_GENERATOR_MODEL",
    api_key="REFLECTION_GENERATOR_API_KEY",
    base_url="REFLECTION_GENERATOR_BASE_URL",
    temperature="REFLECTION_GENERATOR_TEMPERATURE",
    provider_api_key="GEMINI_API_KEY",
    provider_model="GEMINI_MODEL_ID",
)

CRITIC_ENV_KEYS = EnvVarKeys(
    provider="REFLECTION_CRITIC_PROVIDER",
    model="REFLECTION_CRITIC_MODEL",
    api_key="REFLECTION_CRITIC_API_KEY",
    base_url="REFLECTION_CRITIC_BASE_URL",
    temperature="REFLECTION_CRITIC_TEMPERATURE",
    provider_api_key="ANTHROPIC_API_KEY",
    provider_model="ANTHROPIC_MODEL_ID",
)

REFINER_ENV_KEYS = EnvVarKeys(
    provider="REFLECTION_REFINER_PROVIDER",
    model="REFLECTION_REFINER_MODEL",
    api_key="REFLECTION_REFINER_API_KEY",
    base_url="REFLECTION_REFINER_BASE_URL",
    temperature="REFLECTION_REFINER_TEMPERATURE",
    provider_api_key="OPENAI_API_KEY",
    provider_model="OPENAI_CHAT_MODEL_ID",
)


# =============================================================================
# Settings Resolver
# =============================================================================

def get_env(key: str, default: Any = None) -> Any:
    """Get an environment variable"""
    return os.getenv(key, default)


def select_random_provider(
    available_providers: Optional[list[str]] = None,
    exclude: Optional[list[str]] = None,
) -> str:
    """Randomly select one provider from the available providers.

    Args:
        available_providers: List of providers to choose from (default: AVAILABLE_PROVIDERS)
        exclude: List of providers to exclude

    Returns:
        The selected provider name
    """
    providers = available_providers or AVAILABLE_PROVIDERS.copy()
    if exclude:
        providers = [p for p in providers if p not in exclude]
    if not providers:
        providers = AVAILABLE_PROVIDERS.copy()
    return random.choice(providers)


def resolve_provider_with_random(
    provider: Optional[str],
    default_provider: str,
    available_providers: Optional[list[str]] = None,
) -> str:
    """Resolve the provider. If 'random', select one at random.

    Args:
        provider: The specified provider (None, 'random', or a concrete provider name)
        default_provider: The default provider
        available_providers: List of providers to consider for random selection

    Returns:
        The resolved provider name
    """
    if provider is None:
        return default_provider

    normalized = provider.strip().lower()
    if normalized == "random":
        return select_random_provider(available_providers)

    return normalized


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
    """Resolve the API key environment variable name based on the provider"""
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
        1. Role-specific environment variable (REFLECTION_<ROLE>_API_KEY)
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
    """Create an AgentConfig from environment variables and the config file

    Args:
        name: Agent name
        role: Agent role
        env_keys: Definitions of environment variable keys
        defaults: Default settings
        config_file: Values loaded from the config file (optional)

    Returns:
        AgentConfig instance
    """
    if config_file is None:
        config_file = {}

    agent_config = config_file.get(role, {})
    global_config = config_file.get("global", {}) or config_file.get("common", {})

    def get_value(key: str, env_key: str, default: Any) -> Any:
        """Get a config value (environment variable > config file > default)"""
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

    # Resolve base_url
    base_url = get_value("base_url", env_keys.base_url, None)
    if provider.strip().lower() == "openai" and not base_url:
        base_url = os.getenv("OPENAI_BASE_URL")

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
        config_file: Values loaded from the config file (optional)

    Returns:
        (generator_config, critic_config, refiner_config)
    """
    generator = create_agent_config_from_env(
        name="Generator",
        role="generator",
        env_keys=GENERATOR_ENV_KEYS,
        defaults=GENERATOR_DEFAULTS,
        config_file=config_file,
    )

    critic = create_agent_config_from_env(
        name="Critic",
        role="critic",
        env_keys=CRITIC_ENV_KEYS,
        defaults=CRITIC_DEFAULTS,
        config_file=config_file,
    )

    refiner = create_agent_config_from_env(
        name="Refiner",
        role="refiner",
        env_keys=REFINER_ENV_KEYS,
        defaults=REFINER_DEFAULTS,
        config_file=config_file,
    )

    return generator, critic, refiner


def print_config_info() -> None:
    """Display the configuration priority and environment variable names"""
    print("""
Configuration priority (highest first):
    1. CLI arguments (--generator-model, --temperature, etc.)
    2. Environment variables
    3. Config file
    4. Default values

Config file:
    - Explicitly specified with --config PATH
    - Or the CONFIG_FILE environment variable
    - Or auto-discovered: config.yaml / config.yml / config.json / .config.yaml / .config.yml / .config.json
    - Disabled with --no-config

Environment variables:
    [API keys]
    GEMINI_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY
    OPENAI_BASE_URL (OpenAI base_url)

    [Model IDs]
    GEMINI_MODEL_ID / ANTHROPIC_MODEL_ID / OPENAI_CHAT_MODEL_ID

    [Generator (creates the initial draft)]
    REFLECTION_GENERATOR_PROVIDER  : Provider (gemini/anthropic/openai)
    REFLECTION_GENERATOR_MODEL     : Model ID
    REFLECTION_GENERATOR_API_KEY   : API key (or GEMINI_API_KEY)
    REFLECTION_GENERATOR_BASE_URL  : base_url (mainly for OpenAI)
    REFLECTION_GENERATOR_TEMPERATURE: Temperature

    [Critic (critique and improvement suggestions)]
    REFLECTION_CRITIC_PROVIDER   : Provider (gemini/anthropic/openai)
    REFLECTION_CRITIC_MODEL      : Model ID
    REFLECTION_CRITIC_API_KEY    : API key (or ANTHROPIC_API_KEY)
    REFLECTION_CRITIC_BASE_URL   : base_url (mainly for OpenAI)
    REFLECTION_CRITIC_TEMPERATURE : Temperature

    [Refiner (creates the final version)]
    REFLECTION_REFINER_PROVIDER  : Provider (gemini/anthropic/openai)
    REFLECTION_REFINER_MODEL     : Model ID
    REFLECTION_REFINER_API_KEY   : API key (or OPENAI_API_KEY)
    REFLECTION_REFINER_BASE_URL  : base_url (or OPENAI_BASE_URL)
    REFLECTION_REFINER_TEMPERATURE: Temperature

    [Common parameters (apply to all roles; lower priority than per-role)]
    REFLECTION_PROVIDER_STRATEGY: fixed / random / shuffle
    REFLECTION_PROVIDER_MODE     : fixed / random / shuffle (alias)
    REFLECTION_RANDOM_PROVIDERS  : true/false
    REFLECTION_SHUFFLE_PROVIDERS : true/false
    REFLECTION_TEMPERATURE       : Temperature (or LLM_TEMPERATURE)
    REFLECTION_DEVUI_PORT        : DevUI port (or DEVUI_PORT)

Default values:
    Generator: gemini / gemini-3.5-flash
    Critic:    anthropic / claude-opus-4-8
    Refiner:   openai / gpt-5.5
""")
