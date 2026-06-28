#!/usr/bin/env python3
"""
Multi-LLM recursive meta-cognition workflow (5 stages)

Reflection across multiple LLMs (decompose -> solve -> verify -> integrate -> reflect):
- Decomposer: break the problem down
- Solver: produce candidate solutions
- Verifier: verify and self-correct
- Integrator: integrated answer draft
- Reflector: final answer with reflection and confidence

Usage:
    # CLI mode
    python main.py "Organize and summarize the latest AI technology trends"

    # DevUI mode (currently not supported)
    python main.py --devui --port 8095

    # Use a config file (config.yaml is auto-detected; explicit path also supported)
    python main.py --config config.yaml "prompt"  # explicit path

    # Custom model selection
    python main.py "Your prompt" \
        --decomposer-model gemini-3.5-flash \
        --solver-model gemini-3.5-flash \
        --verifier-model claude-opus-4-8 \
        --integrator-model gpt-5.5 \
        --reflector-model gpt-5.5

Configuration precedence:
    CLI arguments > environment variables > config file > default values
"""

import argparse
import asyncio
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    print(
        "Missing dependency: python-dotenv\n"
        "Fix: run.sh (Windows: run.ps1 / run.cmd) normally prepares dependencies automatically. "
        "Do not launch main.py directly; run it via run.sh instead.\n"
        "Manual setup: if uv is available, `uv sync`; otherwise "
        "`python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt`",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    import yaml
except ImportError:  # pragma: no cover
    print(
        "Missing dependency: pyyaml\n"
        "Fix: run.sh (Windows: run.ps1 / run.cmd) normally prepares dependencies automatically. "
        "Do not launch main.py directly; run it via run.sh instead.\n"
        "Manual setup: if uv is available, `uv sync`; otherwise "
        "`python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt`",
        file=sys.stderr,
    )
    sys.exit(1)

from workflow.engine import WorkflowRunResult

from workflow.config import AgentConfig
from workflow.settings import (
    DEFAULT_MODELS,
    get_random_providers,
    get_shuffled_providers,
    DECOMPOSER_DEFAULTS,
    SOLVER_DEFAULTS,
    VERIFIER_DEFAULTS,
    INTEGRATOR_DEFAULTS,
    REFLECTOR_DEFAULTS,
    DECOMPOSER_ENV_KEYS,
    SOLVER_ENV_KEYS,
    VERIFIER_ENV_KEYS,
    INTEGRATOR_ENV_KEYS,
    REFLECTOR_ENV_KEYS,
    print_config_info,
)
from workflow.workflow import build_reflection_workflow
from workflow.types import ReflectionResult


DEFAULT_DEVUI_PORT = 8095
DEFAULT_CONFIG_PATHS = [
    "config.yaml",
    "config.yml",
    "config.json",
    ".config.yaml",
    ".config.yml",
    ".config.json",
]


def _normalize_provider(provider: str) -> str:
    return provider.strip().lower()


def _resolve_provider_env_keys(provider: str) -> tuple[str, str]:
    normalized = _normalize_provider(provider)
    if normalized == "gemini":
        return "GEMINI_API_KEY", "GEMINI_MODEL_ID"
    if normalized in {"anthropic", "claude"}:
        return "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL_ID"
    if normalized == "openai":
        return "OPENAI_API_KEY", "OPENAI_CHAT_MODEL_ID"
    if normalized == "mock":
        return "", ""
    return "", ""


def _load_config_file(config_path: str) -> dict[str, Any]:
    if config_path.endswith((".yaml", ".yml")):
        with open(config_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    if config_path.endswith(".json"):
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    raise ValueError(f"Unsupported config file format: {config_path}")


def _resolve_config_path(args: argparse.Namespace) -> Optional[str]:
    if getattr(args, "no_config", False):
        return None

    explicit = getattr(args, "config", None)
    if explicit:
        if not os.path.exists(explicit):
            print(f"Error: config file not found: {explicit}", file=sys.stderr)
            sys.exit(1)
        return explicit

    env_path = os.getenv("CONFIG_FILE")
    if env_path:
        if not os.path.exists(env_path):
            print(f"Error: file specified by CONFIG_FILE not found: {env_path}", file=sys.stderr)
            sys.exit(1)
        return env_path

    for candidate in DEFAULT_CONFIG_PATHS:
        if os.path.exists(candidate):
            return candidate

    skill_root = Path(__file__).resolve().parents[1]
    for candidate in DEFAULT_CONFIG_PATHS:
        skill_candidate = skill_root / candidate
        if skill_candidate.exists():
            return str(skill_candidate)

    return None


def _coerce_float(value: object, default: float) -> float:
    if value is None:
        return default
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _coerce_int(value: object, default: int) -> int:
    if value is None:
        return default
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _get_dict(value: object) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _get_global_config(config: dict[str, Any]) -> dict[str, Any]:
    return _get_dict(config.get("global") or config.get("common") or {})


def _is_truthy(value: object) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def _get_timeout_value(config: dict[str, Any]) -> object:
    if "timeout" in config:
        return config.get("timeout")
    return config.get("timeout_sec")


def _normalize_output_schema(value: str) -> str:
    normalized = value.strip().lower()
    if normalized in {"nested", "full", "default"}:
        return "nested"
    if normalized in {"flat", "flattened"}:
        return "flat"
    return "nested"


def _resolve_output_schema(
    *,
    args: argparse.Namespace,
    config_file: dict[str, Any],
) -> str:
    if getattr(args, "output_schema", None):
        return _normalize_output_schema(str(args.output_schema))

    env_schema = os.getenv("REFLECTION_OUTPUT_SCHEMA") or os.getenv("REFLECTION_OUTPUT_FORMAT")
    if env_schema:
        return _normalize_output_schema(env_schema)

    global_cfg = _get_global_config(config_file)
    if "output_schema" in global_cfg:
        return _normalize_output_schema(str(global_cfg.get("output_schema")))

    return "nested"


def _resolve_provider_strategy(
    *,
    args: argparse.Namespace,
    config_file: dict[str, Any],
) -> Optional[str]:
    if getattr(args, "fixed_providers", False):
        return "fixed"
    if getattr(args, "random_providers", False):
        return "random"
    if getattr(args, "shuffle_providers", False):
        return "shuffle"

    env_strategy = os.getenv("REFLECTION_PROVIDER_STRATEGY") or os.getenv("REFLECTION_PROVIDER_MODE")
    if env_strategy:
        normalized = env_strategy.strip().lower()
        if normalized in {"random", "shuffle", "fixed"}:
            return normalized

    if _is_truthy(os.getenv("REFLECTION_RANDOM_PROVIDERS")):
        return "random"
    if _is_truthy(os.getenv("REFLECTION_SHUFFLE_PROVIDERS")):
        return "shuffle"

    global_cfg = _get_global_config(config_file)
    if "provider_strategy" in global_cfg:
        normalized = str(global_cfg.get("provider_strategy")).strip().lower()
        if normalized in {"random", "shuffle", "fixed"}:
            return normalized

    return None


def _resolve_temperature(
    *,
    args: argparse.Namespace,
    env_key_role: str,
    env_prefix: str,
    agent_cfg: dict[str, Any],
    global_cfg: dict[str, Any],
    default: float,
) -> float:
    if getattr(args, "temperature", None) is not None:
        return float(args.temperature)

    if os.getenv(env_key_role) is not None:
        return _coerce_float(os.getenv(env_key_role), default)

    env_global = os.getenv(f"{env_prefix}_TEMPERATURE") or os.getenv("LLM_TEMPERATURE")
    if env_global is not None:
        return _coerce_float(env_global, default)

    if "temperature" in agent_cfg:
        return _coerce_float(agent_cfg.get("temperature"), default)

    if "temperature" in global_cfg:
        return _coerce_float(global_cfg.get("temperature"), default)

    return default


def _resolve_timeout(
    *,
    args: argparse.Namespace,
    env_key_role: str,
    env_prefix: str,
    agent_cfg: dict[str, Any],
    global_cfg: dict[str, Any],
    default: float,
) -> float:
    if getattr(args, "timeout", None) is not None:
        return float(args.timeout)

    if os.getenv(env_key_role) is not None:
        return _coerce_float(os.getenv(env_key_role), default)

    env_global = os.getenv(f"{env_prefix}_TIMEOUT") or os.getenv("LLM_TIMEOUT_SEC")
    if env_global is not None:
        return _coerce_float(env_global, default)

    timeout = _get_timeout_value(agent_cfg)
    if timeout is not None:
        return _coerce_float(timeout, default)

    timeout = _get_timeout_value(global_cfg)
    if timeout is not None:
        return _coerce_float(timeout, default)

    return default


def _resolve_agent_config(
    *,
    args: argparse.Namespace,
    config_file: dict[str, Any],
    name: str,
    role: str,
    env_keys,
    default_provider: str,
    default_temperature: float,
    default_timeout_sec: float,
) -> AgentConfig:
    global_cfg = _get_global_config(config_file)
    agent_cfg = _get_dict(config_file.get(role))

    provider = (
        getattr(args, f"{role}_provider", None)
        or os.getenv(env_keys.provider)
        or agent_cfg.get("provider")
        or default_provider
    )
    provider = _normalize_provider(str(provider))

    _, provider_model_env = _resolve_provider_env_keys(provider)

    model = (
        getattr(args, f"{role}_model", None)
        or os.getenv(env_keys.model)
        or (os.getenv(provider_model_env) if provider_model_env else None)
        or agent_cfg.get("model")
        or DEFAULT_MODELS.get(provider, "gpt-5.5")
    )

    cli_api_key = None
    if provider == "gemini":
        cli_api_key = getattr(args, "gemini_api_key", None)
    elif provider in {"anthropic", "claude"}:
        cli_api_key = getattr(args, "anthropic_api_key", None)
    elif provider == "openai":
        cli_api_key = getattr(args, "openai_api_key", None)

    provider_api_key_env, _ = _resolve_provider_env_keys(provider)
    api_key = (
        cli_api_key
        or os.getenv(env_keys.api_key)
        or (os.getenv(provider_api_key_env) if provider_api_key_env else None)
        or agent_cfg.get("api_key")
    )

    base_url = None
    if provider == "openai":
        base_url = (
            getattr(args, "openai_base_url", None)
            or os.getenv(env_keys.base_url)
            or os.getenv("OPENAI_BASE_URL")
            or agent_cfg.get("base_url")
        )
    else:
        base_url = os.getenv(env_keys.base_url) or agent_cfg.get("base_url")

    temperature = _resolve_temperature(
        args=args,
        env_key_role=env_keys.temperature,
        env_prefix="REFLECTION",
        agent_cfg=agent_cfg,
        global_cfg=global_cfg,
        default=default_temperature,
    )
    timeout_sec = _resolve_timeout(
        args=args,
        env_key_role=env_keys.timeout,
        env_prefix="REFLECTION",
        agent_cfg=agent_cfg,
        global_cfg=global_cfg,
        default=default_timeout_sec,
    )

    return AgentConfig(
        name=name,
        role=role,
        provider=provider,
        model=str(model),
        api_key=str(api_key) if api_key is not None else None,
        base_url=str(base_url) if base_url is not None else None,
        temperature=temperature,
        timeout_sec=timeout_sec,
    )


def _resolve_devui_port(args: argparse.Namespace, config_file: dict[str, Any]) -> int:
    if getattr(args, "port", None) is not None:
        return int(args.port)

    env_port = os.getenv("REFLECTION_DEVUI_PORT") or os.getenv("DEVUI_PORT")
    if env_port is not None:
        return _coerce_int(env_port, DEFAULT_DEVUI_PORT)

    devui_cfg = _get_dict(config_file.get("devui"))
    if "port" in devui_cfg:
        return _coerce_int(devui_cfg.get("port"), DEFAULT_DEVUI_PORT)

    return DEFAULT_DEVUI_PORT


def _require_api_key(config: AgentConfig) -> None:
    """Pure CLI backend (subscription login) — no API key validation needed."""
    return


@dataclass(frozen=True)
class RuntimeConfig:
    config_path: Optional[str]
    devui_port: int
    output_schema: str
    decomposer: AgentConfig
    solver: AgentConfig
    verifier: AgentConfig
    integrator: AgentConfig
    reflector: AgentConfig


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Multi-LLM recursive meta-cognition workflow (5 stages)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
Examples:
    python main.py "Write a blog post about AI"
    python main.py --devui --port 8095
    python main.py --config config.yaml "prompt"
    python main.py "Design a REST API" --temperature 0.5

Default values:
    Decomposer: {DECOMPOSER_DEFAULTS.provider}/{DECOMPOSER_DEFAULTS.get_model()}
    Solver:     {SOLVER_DEFAULTS.provider}/{SOLVER_DEFAULTS.get_model()}
    Verifier:   {VERIFIER_DEFAULTS.provider}/{VERIFIER_DEFAULTS.get_model()}
    Integrator: {INTEGRATOR_DEFAULTS.provider}/{INTEGRATOR_DEFAULTS.get_model()}
    Reflector:  {REFLECTOR_DEFAULTS.provider}/{REFLECTOR_DEFAULTS.get_model()}

Configuration precedence: CLI arguments > environment variables > config file > default values
        """,
    )

    parser.add_argument(
        "prompt",
        nargs="?",
        default=None,
        help="Prompt to process through the reflection workflow",
    )

    # Config file options
    parser.add_argument(
        "--config",
        "-c",
        default=None,
        help="Path to the config file (YAML/JSON). If omitted, config.yaml/config.json is auto-detected",
    )
    parser.add_argument(
        "--no-config",
        action="store_true",
        help="Disable automatic loading of the config file",
    )

    # DevUI options
    parser.add_argument(
        "--devui",
        action="store_true",
        help="Run in DevUI mode with an interactive web UI (currently not supported)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help=f"Port number for the DevUI server (default: {DEFAULT_DEVUI_PORT})",
    )

    # Decomposer options
    parser.add_argument(
        "--decomposer-provider",
        default=None,
        help=f"Provider for the Decomposer agent (default: {DECOMPOSER_DEFAULTS.provider})",
    )
    parser.add_argument(
        "--decomposer-model",
        default=None,
        help=f"Model ID for the Decomposer (default: {DECOMPOSER_DEFAULTS.get_model()})",
    )

    # Solver options
    parser.add_argument(
        "--solver-provider",
        default=None,
        help=f"Provider for the Solver agent (default: {SOLVER_DEFAULTS.provider})",
    )
    parser.add_argument(
        "--solver-model",
        default=None,
        help=f"Model ID for the Solver (default: {SOLVER_DEFAULTS.get_model()})",
    )

    # Verifier options
    parser.add_argument(
        "--verifier-provider",
        default=None,
        help=f"Provider for the Verifier agent (default: {VERIFIER_DEFAULTS.provider})",
    )
    parser.add_argument(
        "--verifier-model",
        default=None,
        help=f"Model ID for the Verifier (default: {VERIFIER_DEFAULTS.get_model()})",
    )

    # Integrator options
    parser.add_argument(
        "--integrator-provider",
        default=None,
        help=f"Provider for the Integrator agent (default: {INTEGRATOR_DEFAULTS.provider})",
    )
    parser.add_argument(
        "--integrator-model",
        default=None,
        help=f"Model ID for the Integrator (default: {INTEGRATOR_DEFAULTS.get_model()})",
    )

    # Reflector options
    parser.add_argument(
        "--reflector-provider",
        default=None,
        help=f"Provider for the Reflector agent (default: {REFLECTOR_DEFAULTS.provider})",
    )
    parser.add_argument(
        "--reflector-model",
        default=None,
        help=f"Model ID for the Reflector (default: {REFLECTOR_DEFAULTS.get_model()})",
    )

    # Provider API keys
    parser.add_argument(
        "--gemini-api-key",
        default=None,
        help="Gemini API key (or set the GEMINI_API_KEY environment variable)",
    )
    parser.add_argument(
        "--anthropic-api-key",
        default=None,
        help="Anthropic API key (or set the ANTHROPIC_API_KEY environment variable)",
    )
    parser.add_argument(
        "--openai-api-key",
        default=None,
        help="OpenAI API key (or set the OPENAI_API_KEY environment variable)",
    )
    parser.add_argument(
        "--openai-base-url",
        default=None,
        help="OpenAI base URL (optional)",
    )

    # Common options
    parser.add_argument(
        "--temperature",
        type=float,
        default=None,
        help=f"Temperature for all agents (default: {DECOMPOSER_DEFAULTS.temperature})",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=None,
        help=f"Timeout in seconds per agent (default: {DECOMPOSER_DEFAULTS.timeout_sec})",
    )
    parser.add_argument(
        "--output-schema",
        default=None,
        choices=["nested", "flat"],
        help="Schema format for JSON output (nested/flat)",
    )

    # Provider random-selection options
    provider_group = parser.add_mutually_exclusive_group()
    provider_group.add_argument(
        "--fixed-providers", "--fixed",
        dest="fixed_providers",
        action="store_true",
        help="Pin providers to the per-role defaults (no random/shuffle assignment)",
    )
    provider_group.add_argument(
        "--random-providers", "--random",
        dest="random_providers",
        action="store_true",
        help="Assign providers to each role at random (duplicates allowed)",
    )
    provider_group.add_argument(
        "--shuffle-providers", "--shuffle",
        dest="shuffle_providers",
        action="store_true",
        help="Shuffle providers and assign them to each role (cycles based on the number of roles)",
    )

    # Output options
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output the result in JSON format",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Show detailed output (default shows the final content only)",
    )
    parser.add_argument(
        "--raw",
        action="store_true",
        help="Include sanitized raw LLM request/response data (for debugging; in text output, shown only with --verbose)",
    )
    parser.add_argument(
        "--raw-output",
        default=None,
        help="Write sanitized raw LLM data to a JSON file",
    )
    parser.add_argument(
        "--raw-max-chars",
        type=int,
        default=8000,
        help="Maximum number of characters per raw text field when displaying (default: 8000). 0 for unlimited.",
    )

    # Debug options
    parser.add_argument(
        "--show-config",
        action="store_true",
        help="Print the resolved configuration and exit (for debugging)",
    )

    return parser.parse_args()


def get_runtime_config(args: argparse.Namespace) -> RuntimeConfig:
    """Resolve the runtime configuration from CLI arguments, environment variables, and the config file."""

    config_path = _resolve_config_path(args)
    config_file: dict[str, Any] = {}
    if config_path:
        try:
            config_file = _load_config_file(config_path)
        except Exception as exc:
            print(f"Error: failed to load config file: {config_path}\n  {exc}", file=sys.stderr)
            sys.exit(1)

    output_schema = _resolve_output_schema(args=args, config_file=config_file)

    decomposer_default_provider = DECOMPOSER_DEFAULTS.provider
    solver_default_provider = SOLVER_DEFAULTS.provider
    verifier_default_provider = VERIFIER_DEFAULTS.provider
    integrator_default_provider = INTEGRATOR_DEFAULTS.provider
    reflector_default_provider = REFLECTOR_DEFAULTS.provider

    provider_strategy = _resolve_provider_strategy(args=args, config_file=config_file)
    if provider_strategy == "random":
        (
            decomposer_default_provider,
            solver_default_provider,
            verifier_default_provider,
            integrator_default_provider,
            reflector_default_provider,
        ) = get_random_providers()
    elif provider_strategy == "shuffle":
        (
            decomposer_default_provider,
            solver_default_provider,
            verifier_default_provider,
            integrator_default_provider,
            reflector_default_provider,
        ) = get_shuffled_providers()

    decomposer = _resolve_agent_config(
        args=args,
        config_file=config_file,
        name="Decomposer",
        role="decomposer",
        env_keys=DECOMPOSER_ENV_KEYS,
        default_provider=decomposer_default_provider,
        default_temperature=DECOMPOSER_DEFAULTS.temperature,
        default_timeout_sec=DECOMPOSER_DEFAULTS.timeout_sec,
    )
    solver = _resolve_agent_config(
        args=args,
        config_file=config_file,
        name="Solver",
        role="solver",
        env_keys=SOLVER_ENV_KEYS,
        default_provider=solver_default_provider,
        default_temperature=SOLVER_DEFAULTS.temperature,
        default_timeout_sec=SOLVER_DEFAULTS.timeout_sec,
    )
    verifier = _resolve_agent_config(
        args=args,
        config_file=config_file,
        name="Verifier",
        role="verifier",
        env_keys=VERIFIER_ENV_KEYS,
        default_provider=verifier_default_provider,
        default_temperature=VERIFIER_DEFAULTS.temperature,
        default_timeout_sec=VERIFIER_DEFAULTS.timeout_sec,
    )
    integrator = _resolve_agent_config(
        args=args,
        config_file=config_file,
        name="Integrator",
        role="integrator",
        env_keys=INTEGRATOR_ENV_KEYS,
        default_provider=integrator_default_provider,
        default_temperature=INTEGRATOR_DEFAULTS.temperature,
        default_timeout_sec=INTEGRATOR_DEFAULTS.timeout_sec,
    )
    reflector = _resolve_agent_config(
        args=args,
        config_file=config_file,
        name="Reflector",
        role="reflector",
        env_keys=REFLECTOR_ENV_KEYS,
        default_provider=reflector_default_provider,
        default_temperature=REFLECTOR_DEFAULTS.temperature,
        default_timeout_sec=REFLECTOR_DEFAULTS.timeout_sec,
    )

    devui_port = _resolve_devui_port(args, config_file)

    return RuntimeConfig(
        config_path=config_path,
        devui_port=devui_port,
        output_schema=output_schema,
        decomposer=decomposer,
        solver=solver,
        verifier=verifier,
        integrator=integrator,
        reflector=reflector,
    )


def print_config_summary(runtime: RuntimeConfig) -> None:
    """Print a summary of the resolved configuration (API keys are not shown)."""

    print("\n=== Configuration Summary ===")
    print(f"Config file: {runtime.config_path or '(none)'}")
    print(f"DevUI Port: {runtime.devui_port}")
    print(f"Output Schema: {runtime.output_schema}")
    print(
        f"Decomposer: {runtime.decomposer.provider}/{runtime.decomposer.model} (temp={runtime.decomposer.temperature}, timeout={runtime.decomposer.timeout_sec}s)"
    )
    print(
        f"Solver:     {runtime.solver.provider}/{runtime.solver.model} (temp={runtime.solver.temperature}, timeout={runtime.solver.timeout_sec}s)"
    )
    print(
        f"Verifier:   {runtime.verifier.provider}/{runtime.verifier.model} (temp={runtime.verifier.temperature}, timeout={runtime.verifier.timeout_sec}s)"
    )
    print(
        f"Integrator: {runtime.integrator.provider}/{runtime.integrator.model} (temp={runtime.integrator.temperature}, timeout={runtime.integrator.timeout_sec}s)"
    )
    print(
        f"Reflector:  {runtime.reflector.provider}/{runtime.reflector.model} (temp={runtime.reflector.temperature}, timeout={runtime.reflector.timeout_sec}s)"
    )
    print("===================\n")


def _truncate_strings(value: object, max_chars: int) -> object:
    if max_chars <= 0:
        return value
    if isinstance(value, str):
        if len(value) <= max_chars:
            return value
        return value[:max_chars] + "\n...<truncated>"
    if isinstance(value, list):
        return [_truncate_strings(v, max_chars) for v in value]
    if isinstance(value, dict):
        return {k: _truncate_strings(v, max_chars) for k, v in value.items()}
    return value


def print_result(
    result: ReflectionResult,
    verbose: bool = False,
    as_json: bool = False,
    include_raw: bool = False,
    raw_max_chars: int = 8000,
    output_schema: str = "nested",
) -> None:
    """Print the reflection result in a readable format."""

    if as_json:
        if output_schema == "flat":
            payload: dict[str, Any] = {
                "original_prompt": result.original_prompt,
                "decomposer_subtasks": result.decomposition.subtasks,
                "decomposer_assumptions": result.decomposition.assumptions,
                "decomposer_constraints": result.decomposition.constraints,
                "decomposer_questions": result.decomposition.questions,
                "decomposer_confidence": result.decomposition.confidence,
                "solver_solutions": [item.model_dump() for item in result.solution.solutions],
                "solver_open_questions": result.solution.open_questions,
                "solver_risks": result.solution.risks,
                "solver_confidence": result.solution.confidence,
                "verifier_issues": result.verification.issues,
                "verifier_corrections": result.verification.corrections,
                "verifier_self_corrections": result.verification.self_corrections,
                "verifier_validation_notes": result.verification.validation_notes,
                "verifier_confidence": result.verification.confidence,
                "integrator_integrated_answer": result.integration.integrated_answer,
                "integrator_applied_corrections": result.integration.applied_corrections,
                "integrator_confidence": result.integration.confidence,
                "reflector_final_response": result.reflection.final_response,
                "reflector_confidence_score": result.reflection.confidence_score,
                "reflector_uncertainties": result.reflection.uncertainties,
                "reflector_self_corrections": result.reflection.self_corrections,
                "reflector_reflection_notes": result.reflection.reflection_notes,
                "total_duration_sec": result.total_duration_sec,
                "decomposer_model": result.decomposer_model,
                "solver_model": result.solver_model,
                "verifier_model": result.verifier_model,
                "integrator_model": result.integrator_model,
                "reflector_model": result.reflector_model,
            }
            if include_raw and result.raw is not None:
                payload["raw"] = result.raw.model_dump()
            print(json.dumps(payload, ensure_ascii=False, indent=2))
        else:
            exclude = {} if include_raw else {"raw"}
            payload = result.model_dump(exclude_none=True, exclude=exclude)
            print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    if not verbose:
        print(result.reflection.final_response)
        return

    print("\n" + "=" * 70)
    print("Reflection Workflow Results (5 stages)")
    print("=" * 70)

    print("\n--- Original Prompt ---")
    print(result.original_prompt)

    print("\n--- Stage 1: Decompose (Decomposer) ---")
    print(f"Model: {result.decomposer_model}")
    print(f"Confidence: {result.decomposition.confidence:.2f}")
    print("Subtasks:")
    for s in result.decomposition.subtasks:
        print(f"  - {s}")
    print("Assumptions:")
    for a in result.decomposition.assumptions:
        print(f"  - {a}")
    print("Constraints:")
    for c in result.decomposition.constraints:
        print(f"  - {c}")
    print("Open questions:")
    for q in result.decomposition.questions:
        print(f"  - {q}")

    print("\n--- Stage 2: Solve (Solver) ---")
    print(f"Model: {result.solver_model}")
    print(f"Confidence: {result.solution.confidence:.2f}")
    print("Solutions:")
    for item in result.solution.solutions:
        print(f"  * {item.subtask}: {item.answer}")
    print("Open questions:")
    for q in result.solution.open_questions:
        print(f"  - {q}")
    print("Risks:")
    for r in result.solution.risks:
        print(f"  - {r}")

    print("\n--- Stage 3: Verify (Verifier) ---")
    print(f"Model: {result.verifier_model}")
    print(f"Confidence: {result.verification.confidence:.2f}")
    print("Issues:")
    for issue in result.verification.issues:
        print(f"  - {issue}")
    print("Corrections:")
    for corr in result.verification.corrections:
        print(f"  - {corr}")
    print("Self-corrections:")
    for sc in result.verification.self_corrections:
        print(f"  - {sc}")
    print("Validation notes:")
    for note in result.verification.validation_notes:
        print(f"  - {note}")

    print("\n--- Stage 4: Integrate (Integrator) ---")
    print(f"Model: {result.integrator_model}")
    print(f"Confidence: {result.integration.confidence:.2f}")
    print("Applied corrections:")
    for imp in result.integration.applied_corrections:
        print(f"  - {imp}")
    print("Integrated answer draft:")
    print(result.integration.integrated_answer)

    print("\n--- Stage 5: Reflect (Reflector) ---")
    print(f"Model: {result.reflector_model}")
    print(f"Confidence score: {result.reflection.confidence_score:.2f}")
    print("Uncertainties:")
    for u in result.reflection.uncertainties:
        print(f"  - {u}")
    print("Self-corrections:")
    for sc in result.reflection.self_corrections:
        print(f"  - {sc}")
    print("Reflection:")
    for note in result.reflection.reflection_notes:
        print(f"  - {note}")

    print("\n### Final Content ###\n")
    print(result.reflection.final_response)

    print("\n" + "-" * 70)
    print(f"Total processing time: {result.total_duration_sec:.2f}s")
    print("=" * 70)

    if include_raw:
        print("\n--- RAW Data (sanitized) ---")
        raw_data = result.raw.model_dump() if result.raw is not None else {}
        raw_data_view = _truncate_strings(raw_data, raw_max_chars)
        print(json.dumps(raw_data_view, ensure_ascii=False, indent=2))


def _extract_reflection_result(run_result: object) -> ReflectionResult | None:
    """Extract a ReflectionResult from the return value of workflow.run()."""

    if isinstance(run_result, ReflectionResult):
        return run_result

    outputs: list[object] = []

    if WorkflowRunResult is not None and isinstance(run_result, WorkflowRunResult):
        outputs = run_result.get_outputs()
    elif isinstance(run_result, list):
        for event in run_result:
            data = getattr(event, "data", None)
            if data is not None:
                outputs.append(data)

    for candidate in reversed(outputs):
        if isinstance(candidate, ReflectionResult):
            return candidate
        try:
            return ReflectionResult.model_validate(candidate)
        except Exception:
            continue

    return None


def _annotate_degradation(result: ReflectionResult) -> None:
    """Flag a partial/degraded run (a stage timed out or errored) and warn loudly on stderr.

    The exit code stays 0 for backward compatibility, but the result carries `degraded=True`
    plus the list of stages so a caller never mistakes placeholder output for a real answer.
    """
    degraded_stages: list[str] = []
    if result.raw is not None:
        for stage in ("decomposer", "solver", "verifier", "integrator", "reflector"):
            stage_raw = getattr(result.raw, stage, None)
            if stage_raw is not None and getattr(stage_raw, "error", None):
                degraded_stages.append(stage)

    if not degraded_stages:
        return

    result.degraded = True
    result.degraded_stages = degraded_stages
    print(
        "WARNING: multi-llm-recursive-meta-cognition ran in DEGRADED mode — these stages timed "
        f"out or errored and returned placeholder output: {', '.join(degraded_stages)}. "
        "The final answer is PARTIAL. Re-run with a larger MULTILLM_TOTAL_DEADLINE / "
        "MULTILLM_CLI_TIMEOUT, a lower MULTILLM_REASONING_EFFORT, or a simpler prompt.",
        file=sys.stderr,
    )


async def run_cli(args: argparse.Namespace, runtime: RuntimeConfig) -> None:
    """Run the workflow in CLI mode."""

    if not args.prompt:
        print("Error: a prompt is required in CLI mode")
        print("Usage: python main.py 'enter your prompt here'")
        sys.exit(1)

    _require_api_key(runtime.decomposer)
    _require_api_key(runtime.solver)
    _require_api_key(runtime.verifier)
    _require_api_key(runtime.integrator)
    _require_api_key(runtime.reflector)

    decomposer_config = runtime.decomposer
    solver_config = runtime.solver
    verifier_config = runtime.verifier
    integrator_config = runtime.integrator
    reflector_config = runtime.reflector

    log_stream = sys.stderr if args.json else sys.stdout
    if args.verbose:
        print("\nStarting the reflection workflow...", file=log_stream)
        print(f"  Decomposer: {decomposer_config.provider}/{decomposer_config.model}", file=log_stream)
        print(f"  Solver: {solver_config.provider}/{solver_config.model}", file=log_stream)
        print(f"  Verifier: {verifier_config.provider}/{verifier_config.model}", file=log_stream)
        print(f"  Integrator: {integrator_config.provider}/{integrator_config.model}", file=log_stream)
        print(f"  Reflector: {reflector_config.provider}/{reflector_config.model}", file=log_stream)
        print(file=log_stream)

    workflow = build_reflection_workflow(
        decomposer_config=decomposer_config,
        solver_config=solver_config,
        verifier_config=verifier_config,
        integrator_config=integrator_config,
        reflector_config=reflector_config,
    )

    run_result = await workflow.run(args.prompt)
    reflection_result = _extract_reflection_result(run_result)

    if reflection_result is None:
        print(f"Error: could not extract a ReflectionResult: {type(run_result)}", file=sys.stderr)
        print(run_result)
        sys.exit(1)

    _annotate_degradation(reflection_result)

    if args.raw_output:
        raw_data = reflection_result.raw.model_dump() if reflection_result.raw is not None else {}
        with open(args.raw_output, "w", encoding="utf-8") as f:
            json.dump(raw_data, f, ensure_ascii=False, indent=2)
        if args.verbose:
            print(f"Wrote raw data to: {args.raw_output}", file=sys.stderr if args.json else sys.stdout)

    print_result(
        reflection_result,
        verbose=args.verbose,
        as_json=args.json,
        include_raw=args.raw,
        raw_max_chars=args.raw_max_chars,
        output_schema=runtime.output_schema,
    )


def run_devui(args: argparse.Namespace, runtime: RuntimeConfig) -> None:
    """Run the workflow in DevUI mode."""
    print("Error: DevUI is not supported by the lightweight engine. Please use the CLI.")
    sys.exit(1)


def main() -> None:
    load_dotenv()
    args = parse_args()

    runtime = get_runtime_config(args)

    if getattr(args, "show_config", False):
        print_config_summary(runtime)
        print_config_info()
        sys.exit(0)

    if args.devui:
        run_devui(args, runtime)
    else:
        asyncio.run(run_cli(args, runtime))


if __name__ == "__main__":
    main()
