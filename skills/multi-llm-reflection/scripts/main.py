#!/usr/bin/env python3
"""
Multi-LLM reflection-pattern workflow

Implements a reflection (review & improve) pattern using multiple LLMs:
- Generator (Gemini): creates the initial draft
- Critic (Claude): provides review and feedback
- Refiner (OpenAI): creates the polished final version

Usage:
    # CLI mode
    python main.py "Organize and summarize AI technology trends"

    # DevUI mode (currently unsupported)
    python main.py --devui --port 8095

    # Use a configuration file (config.yaml is auto-discovered; explicit path also allowed)
    python main.py --config config.yaml "prompt"  # explicit path

    # Custom model specification
    python main.py "Your prompt" \\
        --generator-model gemini-3.5-flash \\
        --critic-model claude-opus-4-8 \\
        --refiner-model gpt-5.5

Configuration precedence:
    CLI arguments > environment variables > configuration file > default values
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
        "Fix: normally run.sh (run.ps1 / run.cmd on Windows) prepares dependencies automatically. "
        "Do not launch main.py directly; run it via run.sh.\n"
        "Manual: if uv is available, `uv sync`; otherwise "
        "`python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt`",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    import yaml
except ImportError:  # pragma: no cover
    print(
        "Missing dependency: pyyaml\n"
        "Fix: normally run.sh (run.ps1 / run.cmd on Windows) prepares dependencies automatically. "
        "Do not launch main.py directly; run it via run.sh.\n"
        "Manual: if uv is available, `uv sync`; otherwise "
        "`python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt`",
        file=sys.stderr,
    )
    sys.exit(1)

from workflow.engine import WorkflowRunResult

from workflow.config import AgentConfig
from workflow.settings import (
    AVAILABLE_PROVIDERS,
    DEFAULT_MODELS,
    GENERATOR_DEFAULTS,
    CRITIC_DEFAULTS,
    REFINER_DEFAULTS,
    get_random_providers,
    get_shuffled_providers,
    GENERATOR_ENV_KEYS,
    CRITIC_ENV_KEYS,
    REFINER_ENV_KEYS,
    print_config_info,
    resolve_provider_with_random,
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
    raise ValueError(f"Unsupported configuration file format: {config_path}")


def _resolve_config_path(args: argparse.Namespace) -> Optional[str]:
    if getattr(args, "no_config", False):
        return None

    explicit = getattr(args, "config", None)
    if explicit:
        if not os.path.exists(explicit):
            print(f"Error: configuration file not found: {explicit}", file=sys.stderr)
            sys.exit(1)
        return explicit

    env_path = os.getenv("CONFIG_FILE")
    if env_path:
        if not os.path.exists(env_path):
            print(f"Error: the file specified by CONFIG_FILE was not found: {env_path}", file=sys.stderr)
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


def _is_truthy(value: object) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def _get_dict(value: object) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _get_global_config(config: dict[str, Any]) -> dict[str, Any]:
    return _get_dict(config.get("global") or config.get("common") or {})


def _resolve_provider_strategy(
    *,
    args: argparse.Namespace,
    config_file: dict[str, Any],
) -> Optional[str]:
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


def _resolve_agent_config(
    *,
    args: argparse.Namespace,
    config_file: dict[str, Any],
    name: str,
    role: str,
    env_keys,
    default_provider: str,
    default_temperature: float,
    force_random: bool = False,
) -> AgentConfig:
    global_cfg = _get_global_config(config_file)
    agent_cfg = _get_dict(config_file.get(role))

    # Get the provider (random selection if --random-providers or --<role>-provider random)
    raw_provider = (
        getattr(args, f"{role}_provider", None)
        or os.getenv(env_keys.provider)
        or agent_cfg.get("provider")
    )

    if force_random and raw_provider is None:
        raw_provider = "random"

    provider = resolve_provider_with_random(
        provider=raw_provider,
        default_provider=default_provider,
        available_providers=AVAILABLE_PROVIDERS,
    )

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

    return AgentConfig(
        name=name,
        role=role,
        provider=provider,
        model=str(model),
        api_key=str(api_key) if api_key is not None else None,
        base_url=str(base_url) if base_url is not None else None,
        temperature=temperature,
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
    """Pure CLI backend (subscription login) — API key validation not required."""
    return


@dataclass(frozen=True)
class RuntimeConfig:
    config_path: Optional[str]
    devui_port: int
    generator: AgentConfig
    critic: AgentConfig
    refiner: AgentConfig


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Reflection-pattern multi-LLM workflow",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
Usage examples:
    python main.py "Write a blog post about AI"
    python main.py --devui --port 8095
    python main.py --config config.yaml "prompt"
    python main.py "Create a REST API design" --temperature 0.5

Default values:
    Generator: {GENERATOR_DEFAULTS.provider}/{GENERATOR_DEFAULTS.get_model()}
    Critic: {CRITIC_DEFAULTS.provider}/{CRITIC_DEFAULTS.get_model()}
    Refiner: {REFINER_DEFAULTS.provider}/{REFINER_DEFAULTS.get_model()}

Configuration precedence: CLI arguments > environment variables > configuration file > default values
        """,
    )

    parser.add_argument(
        "prompt",
        nargs="?",
        default=None,
        help="The prompt to process through the reflection workflow",
    )

    # Configuration file options
    parser.add_argument(
        "--config", "-c",
        default=None,
        help="Path to the configuration file (YAML/JSON). If unspecified, config.yaml/config.json is auto-discovered",
    )
    parser.add_argument(
        "--no-config",
        action="store_true",
        help="Disable automatic loading of the configuration file",
    )

    # DevUI options
    parser.add_argument(
        "--devui",
        action="store_true",
        help="Run in DevUI mode with an interactive web UI (currently unsupported)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help=f"DevUI server port number (default: {DEFAULT_DEVUI_PORT})",
    )

    # Random provider selection options
    parser.add_argument(
        "--random-providers",
        action="store_true",
        help="Randomly select the provider for all agents (random from gemini/anthropic/openai)",
    )
    parser.add_argument(
        "--shuffle-providers",
        action="store_true",
        help="Shuffle and assign providers across all agents (no duplicates)",
    )

    # Generator (Gemini) options
    parser.add_argument(
        "--generator-provider",
        default=None,
        help=f"Provider for the Generator agent (default: {GENERATOR_DEFAULTS.provider}). Specify 'random' for random selection",
    )
    parser.add_argument(
        "--generator-model",
        default=None,
        help=f"Generator model ID (default: {GENERATOR_DEFAULTS.get_model()})",
    )
    parser.add_argument(
        "--gemini-api-key",
        default=None,
        help="Gemini API key (or set the GEMINI_API_KEY environment variable)",
    )

    # Critic (Claude) options
    parser.add_argument(
        "--critic-provider",
        default=None,
        help=f"Provider for the Critic agent (default: {CRITIC_DEFAULTS.provider}). Specify 'random' for random selection",
    )
    parser.add_argument(
        "--critic-model",
        default=None,
        help=f"Critic model ID (default: {CRITIC_DEFAULTS.get_model()})",
    )
    parser.add_argument(
        "--anthropic-api-key",
        default=None,
        help="Anthropic API key (or set the ANTHROPIC_API_KEY environment variable)",
    )

    # Refiner (OpenAI) options
    parser.add_argument(
        "--refiner-provider",
        default=None,
        help=f"Provider for the Refiner agent (default: {REFINER_DEFAULTS.provider}). Specify 'random' for random selection",
    )
    parser.add_argument(
        "--refiner-model",
        default=None,
        help=f"Refiner model ID (default: {REFINER_DEFAULTS.get_model()})",
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
        help=f"Temperature for all agents (default: {GENERATOR_DEFAULTS.temperature})",
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
        help="Show detailed output (default is final content only)",
    )
    parser.add_argument(
        "--raw",
        action="store_true",
        help="Include the sanitized raw LLM request/response data (for debugging; in text output, shown only with --verbose)",
    )
    parser.add_argument(
        "--raw-output",
        default=None,
        help="Write the sanitized raw LLM data to a JSON file",
    )
    parser.add_argument(
        "--raw-max-chars",
        type=int,
        default=8000,
        help="Maximum characters per raw text field when displaying (default: 8000). 0 for unlimited.",
    )

    # Debug options
    parser.add_argument(
        "--show-config",
        action="store_true",
        help="Show the resolved configuration and exit (for debugging)",
    )

    return parser.parse_args()


def get_runtime_config(args: argparse.Namespace) -> RuntimeConfig:
    """Resolve the runtime configuration from CLI arguments, environment variables, and the configuration file."""

    config_path = _resolve_config_path(args)
    config_file: dict[str, Any] = {}
    if config_path:
        try:
            config_file = _load_config_file(config_path)
        except Exception as exc:
            print(f"Error: failed to load the configuration file: {config_path}\n  {exc}", file=sys.stderr)
            sys.exit(1)

    provider_strategy = _resolve_provider_strategy(args=args, config_file=config_file)
    generator_default_provider = GENERATOR_DEFAULTS.provider
    critic_default_provider = CRITIC_DEFAULTS.provider
    refiner_default_provider = REFINER_DEFAULTS.provider
    if provider_strategy == "random":
        (
            generator_default_provider,
            critic_default_provider,
            refiner_default_provider,
        ) = get_random_providers()
    elif provider_strategy == "shuffle":
        (
            generator_default_provider,
            critic_default_provider,
            refiner_default_provider,
        ) = get_shuffled_providers()

    force_random = getattr(args, "random_providers", False)

    generator = _resolve_agent_config(
        args=args,
        config_file=config_file,
        name="Generator",
        role="generator",
        env_keys=GENERATOR_ENV_KEYS,
        default_provider=generator_default_provider,
        default_temperature=GENERATOR_DEFAULTS.temperature,
        force_random=force_random,
    )
    critic = _resolve_agent_config(
        args=args,
        config_file=config_file,
        name="Critic",
        role="critic",
        env_keys=CRITIC_ENV_KEYS,
        default_provider=critic_default_provider,
        default_temperature=CRITIC_DEFAULTS.temperature,
        force_random=force_random,
    )
    refiner = _resolve_agent_config(
        args=args,
        config_file=config_file,
        name="Refiner",
        role="refiner",
        env_keys=REFINER_ENV_KEYS,
        default_provider=refiner_default_provider,
        default_temperature=REFINER_DEFAULTS.temperature,
        force_random=force_random,
    )

    devui_port = _resolve_devui_port(args, config_file)

    return RuntimeConfig(
        config_path=config_path,
        devui_port=devui_port,
        generator=generator,
        critic=critic,
        refiner=refiner,
    )


def print_config_summary(runtime: RuntimeConfig) -> None:
    """Print a summary of the resolved configuration (API keys are not shown)."""
    print("\n=== Configuration summary ===")
    print(f"Configuration file: {runtime.config_path or '(none)'}")
    print(f"DevUI Port: {runtime.devui_port}")
    print(f"Generator: {runtime.generator.provider}/{runtime.generator.model} (temp={runtime.generator.temperature})")
    print(f"Critic:    {runtime.critic.provider}/{runtime.critic.model} (temp={runtime.critic.temperature})")
    print(f"Refiner:   {runtime.refiner.provider}/{runtime.refiner.model} (temp={runtime.refiner.temperature})")
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
) -> None:
    """Print the reflection result in a readable format."""

    if as_json:
        if include_raw:
            print(result.model_dump_json(indent=2, ensure_ascii=False, exclude_none=True))
        else:
            print(result.model_dump_json(indent=2, ensure_ascii=False, exclude_none=True, exclude={"raw"}))
        return

    # Default (no options): print only the final result
    if not verbose:
        print(result.final_content)
        return

    print("\n" + "=" * 70)
    print("Reflection Workflow Result")
    print("=" * 70)

    print("\n--- Original prompt ---")
    print(result.original_prompt)

    print("\n--- Stage 1: Initial draft (Generator) ---")
    print(f"Model: {result.generator_model}")
    print(f"Confidence: {result.generator_confidence:.2f}")
    print("-" * 40)
    print(result.initial_draft)

    print("\n--- Stage 2: Critique (Critic) ---")
    print(f"Model: {result.critic_model}")
    print(f"Score: {result.critic_score}/10")
    print("\nStrengths:")
    for s in result.critic_strengths:
        print(f"  + {s}")
    print("\nWeaknesses:")
    for w in result.critic_weaknesses:
        print(f"  - {w}")
    print("\nImprovement suggestions:")
    for s in result.critic_suggestions:
        print(f"  > {s}")

    print("\n--- Stage 3: Refined version (Refiner) ---")
    print(f"Model: {result.refiner_model}")
    print(f"Final score: {result.final_score}/10")
    print("\nImprovements made:")
    for imp in result.improvements_made:
        print(f"  * {imp}")
    print("-" * 40)

    print("\n### Final content ###\n")
    print(result.final_content)

    print("\n" + "-" * 70)
    print(f"Total processing time: {result.total_duration_sec:.2f}s")
    print(f"Quality improvement: {result.critic_score}/10 → {result.final_score}/10")
    print("=" * 70)

    if include_raw:
        print("\n--- RAW data (sanitized) ---")
        raw_data = result.raw.model_dump() if result.raw is not None else {}
        raw_data_view = _truncate_strings(raw_data, raw_max_chars)
        print(json.dumps(raw_data_view, ensure_ascii=False, indent=2))


def _extract_reflection_result(run_result: object) -> ReflectionResult | None:
    """Extract the final ReflectionResult from the various return types of workflow.run().

    A helper to maintain compatibility in case it returns a WorkflowRunResult (events)
    or returns the model directly.
    """

    if isinstance(run_result, ReflectionResult):
        return run_result

    outputs: list[object] = []

    if WorkflowRunResult is not None and isinstance(run_result, WorkflowRunResult):
        outputs = run_result.get_outputs()
    elif isinstance(run_result, list):
        # Backward compatibility: treat a plain list as an event list and extract `.data`.
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


async def run_cli(args: argparse.Namespace, runtime: RuntimeConfig) -> None:
    """Run the workflow in CLI mode."""

    if not args.prompt:
        print("Error: a prompt is required in CLI mode")
        print("Usage: python main.py 'enter your prompt here'")
        sys.exit(1)

    _require_api_key(runtime.generator)
    _require_api_key(runtime.critic)
    _require_api_key(runtime.refiner)

    generator_config = runtime.generator
    critic_config = runtime.critic
    refiner_config = runtime.refiner

    log_stream = sys.stderr if args.json else sys.stdout
    if args.verbose:
        print(f"\nStarting the reflection workflow...", file=log_stream)
        print(f"  Generator: {generator_config.provider}/{generator_config.model}", file=log_stream)
        print(f"  Critic: {critic_config.provider}/{critic_config.model}", file=log_stream)
        print(f"  Refiner: {refiner_config.provider}/{refiner_config.model}", file=log_stream)
        print(file=log_stream)

    workflow = build_reflection_workflow(
        generator_config=generator_config,
        critic_config=critic_config,
        refiner_config=refiner_config,
    )

    run_result = await workflow.run(args.prompt)
    reflection_result = _extract_reflection_result(run_result)

    if reflection_result is None:
        print(f"Error: could not extract a ReflectionResult: {type(run_result)}", file=sys.stderr)
        print(run_result)
        sys.exit(1)

    if args.raw_output:
        raw_data = reflection_result.raw.model_dump() if reflection_result.raw is not None else {}
        with open(args.raw_output, "w", encoding="utf-8") as f:
            json.dump(raw_data, f, ensure_ascii=False, indent=2)
        if args.verbose:
            print(f"Wrote raw data: {args.raw_output}", file=sys.stderr if args.json else sys.stdout)

    print_result(
        reflection_result,
        verbose=args.verbose,
        as_json=args.json,
        include_raw=args.raw,
        raw_max_chars=args.raw_max_chars,
    )


def run_devui(args: argparse.Namespace, runtime: RuntimeConfig) -> None:
    """Run the workflow in DevUI mode."""
    print("Error: DevUI is not supported by the lightweight engine. Please use the CLI.")
    sys.exit(1)


def main() -> None:
    load_dotenv()
    args = parse_args()

    # Resolve the configuration
    runtime = get_runtime_config(args)

    # If --show-config is specified, show the configuration and exit
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
