#!/usr/bin/env python3
"""
Multi-LLM debate pattern workflow

Implements a debate pattern using multiple LLMs:
- Proponent (for - Gemini): analyzes from a supportive viewpoint
- Opponent (against - Claude): analyzes from a critical/opposing viewpoint
- Moderator (neutral - OpenAI): evaluates both viewpoints and makes the final judgment

This pattern enables multi-perspective analysis for decision-making,
risk analysis, and strategic planning.

Usage:
    # CLI mode - debate a topic
    python main.py "Should we deploy AI agents in customer service?"

    # Use a config file (auto-discovers config.yaml; explicit path also supported)
    python main.py --config config.yaml "debate topic"

    # Specify custom models
    python main.py "debate topic" \\
        --proponent-model gemini-3.5-flash \\
        --opponent-model claude-opus-4-8 \\
        --moderator-model gpt-5.5

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
        "Fix: normally run.sh (Windows: run.ps1 / run.cmd) prepares dependencies automatically. "
        "Do not launch main.py directly; run it via run.sh.\n"
        "If doing it manually: with uv run `uv sync`, otherwise "
        "`python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt`",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    import yaml
except ImportError:  # pragma: no cover
    print(
        "Missing dependency: pyyaml\n"
        "Fix: normally run.sh (Windows: run.ps1 / run.cmd) prepares dependencies automatically. "
        "Do not launch main.py directly; run it via run.sh.\n"
        "If doing it manually: with uv run `uv sync`, otherwise "
        "`python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt`",
        file=sys.stderr,
    )
    sys.exit(1)

from workflow.config import AgentConfig
from workflow.engine import WorkflowRunResult
from workflow.workflow import build_debate_workflow
from workflow.types import DebateResult
from workflow.settings import (
    DEFAULT_MODELS,
    AVAILABLE_PROVIDERS,
    get_random_providers,
    get_shuffled_providers,
    PROPONENT_DEFAULTS,
    OPPONENT_DEFAULTS,
    MODERATOR_DEFAULTS,
    PROPONENT_ENV_KEYS,
    OPPONENT_ENV_KEYS,
    MODERATOR_ENV_KEYS,
    print_config_info,
)


DEFAULT_DEVUI_PORT = 8096
DEFAULT_CONFIG_PATHS = [
    # Standard
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
    if getattr(args, "fixed_providers", False):
        return "fixed"
    if getattr(args, "random_providers", False):
        return "random"
    if getattr(args, "shuffle_providers", False):
        return "shuffle"

    env_strategy = os.getenv("DEBATE_PROVIDER_STRATEGY") or os.getenv("DEBATE_PROVIDER_MODE")
    if env_strategy:
        normalized = env_strategy.strip().lower()
        if normalized in {"random", "shuffle", "fixed"}:
            return normalized

    if _is_truthy(os.getenv("DEBATE_RANDOM_PROVIDERS")):
        return "random"
    if _is_truthy(os.getenv("DEBATE_SHUFFLE_PROVIDERS")):
        return "shuffle"

    global_cfg = _get_global_config(config_file)
    if "provider_strategy" in global_cfg:
        normalized = str(global_cfg.get("provider_strategy")).strip().lower()
        if normalized in {"random", "shuffle", "fixed"}:
            return normalized

    # Random by default: the three vendors are assigned 1:1 to the three roles at random (shuffle).
    # Roles individually specified via per-role --*-provider / environment variables / config are overridden afterward.
    return "shuffle"


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
        env_prefix="DEBATE",
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

    env_port = os.getenv("DEBATE_DEVUI_PORT") or os.getenv("DEVUI_PORT")
    if env_port is not None:
        return _coerce_int(env_port, DEFAULT_DEVUI_PORT)

    devui_cfg = _get_dict(config_file.get("devui"))
    if "port" in devui_cfg:
        return _coerce_int(devui_cfg.get("port"), DEFAULT_DEVUI_PORT)

    return DEFAULT_DEVUI_PORT


def _require_api_key(config: AgentConfig) -> None:
    """Pure CLI backends (claude / codex / agy subscription login) — no API key validation required."""
    return


@dataclass(frozen=True)
class RuntimeConfig:
    config_path: Optional[str]
    devui_port: int
    proponent: AgentConfig
    opponent: AgentConfig
    moderator: AgentConfig


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Debate-pattern multi-LLM workflow",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
Examples:
    python main.py "Should AI replace human decision-making?"
    python main.py "Is cryptocurrency a good investment?" --temperature 0.5

Default values:
    Proponent: {PROPONENT_DEFAULTS.provider}/{PROPONENT_DEFAULTS.get_model()}
    Opponent:  {OPPONENT_DEFAULTS.provider}/{OPPONENT_DEFAULTS.get_model()}
    Moderator: {MODERATOR_DEFAULTS.provider}/{MODERATOR_DEFAULTS.get_model()}

Configuration precedence: CLI arguments > environment variables > config file > default values
        """,
    )

    parser.add_argument(
        "prompt",
        nargs="?",
        default=None,
        help="The debate topic to analyze from multiple perspectives (positional argument)",
    )

    # Config file options
    parser.add_argument(
        "--config", "-c",
        default=None,
        metavar="PATH",
        help="Path to the config file (YAML/JSON). If omitted, auto-discovers config.yaml/config.json",
    )
    parser.add_argument(
        "--no-config",
        action="store_true",
        help="Disable automatic loading of the config file",
    )
    parser.add_argument(
        "--show-config",
        action="store_true",
        help="Print the resolved configuration and exit (for debugging)",
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
        help=f"Port number for the DevUI server (default: {DEFAULT_DEVUI_PORT})",
    )

    # Proponent (Gemini) options
    parser.add_argument(
        "--proponent-provider",
        default=None,
        help=f"Provider for the Proponent agent (default: {PROPONENT_DEFAULTS.provider})",
    )
    parser.add_argument(
        "--proponent-model",
        default=None,
        help="Model ID for the Proponent (default: inferred from the provider and environment variables)",
    )
    parser.add_argument(
        "--gemini-api-key",
        default=None,
        help="Gemini API key (or set the GEMINI_API_KEY environment variable)",
    )

    # Opponent (Claude) options
    parser.add_argument(
        "--opponent-provider",
        default=None,
        help=f"Provider for the Opponent agent (default: {OPPONENT_DEFAULTS.provider})",
    )
    parser.add_argument(
        "--opponent-model",
        default=None,
        help="Model ID for the Opponent (default: inferred from the provider and environment variables)",
    )
    parser.add_argument(
        "--anthropic-api-key",
        default=None,
        help="Anthropic API key (or set the ANTHROPIC_API_KEY environment variable)",
    )

    # Moderator (OpenAI) options
    parser.add_argument(
        "--moderator-provider",
        default=None,
        help=f"Provider for the Moderator agent (default: {MODERATOR_DEFAULTS.provider})",
    )
    parser.add_argument(
        "--moderator-model",
        default=None,
        help="Model ID for the Moderator (default: inferred from the provider and environment variables)",
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
        help=f"Temperature for all agents (default: {PROPONENT_DEFAULTS.temperature})",
    )

    # Provider assignment strategy options (default=shuffle: random by default)
    provider_group = parser.add_mutually_exclusive_group()
    provider_group.add_argument(
        "--fixed-providers", "--fixed",
        dest="fixed_providers",
        action="store_true",
        help="Disable random assignment and pin providers (for=gemini / against=anthropic / neutral=openai)",
    )
    provider_group.add_argument(
        "--random-providers", "--random",
        dest="random_providers",
        action="store_true",
        help="Assign a provider to each role independently at random (duplicates allowed)",
    )
    provider_group.add_argument(
        "--shuffle-providers", "--shuffle",
        dest="shuffle_providers",
        action="store_true",
        help="Shuffle the three vendors and assign them 1:1 to the roles (no duplicates / default)",
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
        help="Show detailed output (by default only the final result is shown)",
    )
    parser.add_argument(
        "--raw",
        action="store_true",
        help="Include the sanitized raw LLM request/response data (for debugging; in text output, shown only with --verbose)",
    )
    parser.add_argument(
        "--raw-output",
        default=None,
        metavar="PATH",
        help="Write the sanitized raw LLM data to a JSON file",
    )
    parser.add_argument(
        "--raw-max-chars",
        type=int,
        default=8000,
        help="Maximum number of characters per raw text field when displaying (default: 8000). 0 for unlimited.",
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
            print(f"Error: failed to load the config file: {config_path}\n  {exc}", file=sys.stderr)
            sys.exit(1)

    # Random/shuffle provider assignment
    proponent_default_provider = PROPONENT_DEFAULTS.provider
    opponent_default_provider = OPPONENT_DEFAULTS.provider
    moderator_default_provider = MODERATOR_DEFAULTS.provider

    provider_strategy = _resolve_provider_strategy(args=args, config_file=config_file)
    if provider_strategy == "random":
        proponent_default_provider, opponent_default_provider, moderator_default_provider = get_random_providers()
    elif provider_strategy == "shuffle":
        proponent_default_provider, opponent_default_provider, moderator_default_provider = get_shuffled_providers()

    proponent = _resolve_agent_config(
        args=args,
        config_file=config_file,
        name="Proponent",
        role="proponent",
        env_keys=PROPONENT_ENV_KEYS,
        default_provider=proponent_default_provider,
        default_temperature=PROPONENT_DEFAULTS.temperature,
    )
    opponent = _resolve_agent_config(
        args=args,
        config_file=config_file,
        name="Opponent",
        role="opponent",
        env_keys=OPPONENT_ENV_KEYS,
        default_provider=opponent_default_provider,
        default_temperature=OPPONENT_DEFAULTS.temperature,
    )
    moderator = _resolve_agent_config(
        args=args,
        config_file=config_file,
        name="Moderator",
        role="moderator",
        env_keys=MODERATOR_ENV_KEYS,
        default_provider=moderator_default_provider,
        default_temperature=MODERATOR_DEFAULTS.temperature,
    )

    devui_port = _resolve_devui_port(args, config_file)

    return RuntimeConfig(
        config_path=config_path,
        devui_port=devui_port,
        proponent=proponent,
        opponent=opponent,
        moderator=moderator,
    )


def print_config_summary(runtime: RuntimeConfig) -> None:
    """Print a summary of the resolved configuration (API keys are not shown)."""
    print("\n=== Configuration summary ===")
    print(f"Config file: {runtime.config_path or '(none)'}")
    print(f"DevUI Port: {runtime.devui_port}")
    print(f"Proponent: {runtime.proponent.provider}/{runtime.proponent.model} (temp={runtime.proponent.temperature})")
    print(f"Opponent:  {runtime.opponent.provider}/{runtime.opponent.model} (temp={runtime.opponent.temperature})")
    print(f"Moderator: {runtime.moderator.provider}/{runtime.moderator.model} (temp={runtime.moderator.temperature})")
    print("===================\n")


def _truncate_strings(value: object, max_chars: int) -> object:
    """Truncate strings to the specified maximum number of characters."""
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
    result: DebateResult,
    verbose: bool = False,
    as_json: bool = False,
    include_raw: bool = False,
    raw_max_chars: int = 8000,
) -> None:
    """Print the debate result in a readable format."""

    if as_json:
        if include_raw:
            print(result.model_dump_json(indent=2, ensure_ascii=False, exclude_none=True))
        else:
            print(result.model_dump_json(indent=2, ensure_ascii=False, exclude_none=True, exclude={"raw"}))
        return

    # Default (no options): print only the final result
    if not verbose:
        verdict = (result.final_verdict or "").strip()
        recommendation = (result.recommendation or "").strip()
        if verdict:
            print(verdict)
        if recommendation:
            if verdict:
                print()
            print(recommendation)
        return

    print("\n" + "=" * 80)
    print("Debate workflow result")
    print("=" * 80)

    print(f"\nDebate topic: {result.original_topic}")

    print("\n" + "-" * 80)
    print("Stage 1: PROPONENT (for)")
    print("-" * 80)
    print(f"Model: {result.proponent_model}")
    print(f"Confidence: {result.proponent_confidence:.2f}")
    print(f"\nPosition: {result.proponent_position}")

    print("\nArguments for:")
    for arg in result.proponent_arguments:
        print(f"  + {arg}")

    print("\nEvidence:")
    for ev in result.proponent_evidence:
        print(f"  • {ev}")

    print("\nBenefits:")
    for ben in result.proponent_benefits:
        print(f"  ★ {ben}")

    print("\n" + "-" * 80)
    print("Stage 2: OPPONENT (against)")
    print("-" * 80)
    print(f"Model: {result.opponent_model}")
    print(f"Confidence: {result.opponent_confidence:.2f}")
    print(f"\nPosition: {result.opponent_position}")

    print("\nCounter-arguments:")
    for arg in result.opponent_counter_arguments:
        print(f"  - {arg}")

    print("\nRisks:")
    for risk in result.opponent_risks:
        print(f"  ⚠ {risk}")

    print("\nWeaknesses:")
    for weak in result.opponent_weaknesses:
        print(f"  ✗ {weak}")

    print("\nAlternatives:")
    for alt in result.opponent_alternatives:
        print(f"  → {alt}")

    print("\n" + "-" * 80)
    print("Stage 3: MODERATOR (neutral evaluation)")
    print("-" * 80)
    print(f"Model: {result.moderator_model}")

    print(f"\nScores:")
    print(f"  For: {result.proponent_score}/10")
    print(f"  Against: {result.opponent_score}/10")

    print("\nDebate summary:")
    print(f"  {result.debate_summary}")

    print("\nKey insights:")
    for insight in result.key_insights:
        print(f"  💡 {insight}")

    print("\n" + "=" * 80)
    print("Final verdict")
    print("=" * 80)

    print(f"\n{result.final_verdict}")

    print("\n" + "-" * 40)
    print("Recommendation")
    print("-" * 40)
    print(f"\n{result.recommendation}")

    print("\n" + "-" * 80)
    print(f"Total processing time: {result.total_duration_sec:.2f}s")
    print(f"Scores: For {result.proponent_score}/10 vs Against {result.opponent_score}/10")
    print("=" * 80)

    if include_raw:
        print("\n--- RAW data (sanitized) ---")
        raw_data = result.raw.model_dump() if result.raw is not None else {}
        raw_data_view = _truncate_strings(raw_data, raw_max_chars)
        print(json.dumps(raw_data_view, ensure_ascii=False, indent=2))


def _extract_debate_result(run_result: object) -> DebateResult | None:
    """Extract the final DebateResult from the various return types of workflow.run().

    It may return a WorkflowRunResult (events) or return the model directly.
    This helper preserves CLI compatibility.
    """

    if isinstance(run_result, DebateResult):
        return run_result

    outputs: list[object] = []
    if isinstance(run_result, WorkflowRunResult):
        outputs = run_result.get_outputs()
    elif isinstance(run_result, list):
        # Backward compatibility: treat a plain list as a list of events and extract `.data`.
        for event in run_result:
            data = getattr(event, "data", None)
            if data is not None:
                outputs.append(data)

    for candidate in reversed(outputs):
        if isinstance(candidate, DebateResult):
            return candidate
        try:
            return DebateResult.model_validate(candidate)
        except Exception:
            continue

    return None


def _annotate_degradation(result: DebateResult) -> None:
    """Flag a partial/degraded debate (a role timed out or errored) and warn loudly on stderr.

    The exit code stays 0 for backward compatibility, but the result carries `degraded=True`
    plus the list of roles so a caller never mistakes placeholder output for a real verdict.
    """
    degraded_stages: list[str] = []
    if result.raw is not None:
        for role in ("proponent", "opponent", "moderator"):
            role_raw = getattr(result.raw, role, None)
            if role_raw is not None and getattr(role_raw, "error", None):
                degraded_stages.append(role)

    if not degraded_stages:
        return

    result.degraded = True
    result.degraded_stages = degraded_stages
    print(
        "WARNING: multi-llm-debate ran in DEGRADED mode — these roles timed out or errored and "
        f"returned placeholder output: {', '.join(degraded_stages)}. The verdict is PARTIAL. "
        "Re-run with a larger MULTILLM_TOTAL_DEADLINE / MULTILLM_CLI_TIMEOUT, a lower "
        "MULTILLM_REASONING_EFFORT, or a simpler topic.",
        file=sys.stderr,
    )


async def run_cli(args: argparse.Namespace, runtime: RuntimeConfig) -> None:
    """Run the workflow in CLI mode."""

    if not args.prompt:
        print("Error: a debate topic is required in CLI mode")
        print("Usage: python main.py 'enter the debate topic here'")
        sys.exit(1)

    _require_api_key(runtime.proponent)
    _require_api_key(runtime.opponent)
    _require_api_key(runtime.moderator)

    proponent_config = runtime.proponent
    opponent_config = runtime.opponent
    moderator_config = runtime.moderator

    log_stream = sys.stderr if args.json else sys.stdout
    if args.verbose:
        print(f"\nStarting the debate workflow...", file=log_stream)
        print(f"  Proponent (for): {proponent_config.provider}/{proponent_config.model}", file=log_stream)
        print(f"  Opponent (against): {opponent_config.provider}/{opponent_config.model}", file=log_stream)
        print(f"  Moderator (neutral): {moderator_config.provider}/{moderator_config.model}", file=log_stream)
        print(file=log_stream)

    workflow = build_debate_workflow(
        proponent_config=proponent_config,
        opponent_config=opponent_config,
        moderator_config=moderator_config,
    )

    run_result = await workflow.run(args.prompt)
    debate_result = _extract_debate_result(run_result)

    if debate_result is None:
        print(f"Error: could not extract a DebateResult: {type(run_result)}", file=sys.stderr)
        print(run_result)
        sys.exit(1)

    _annotate_degradation(debate_result)

    # Write raw data
    if args.raw_output:
        raw_data = debate_result.raw.model_dump() if debate_result.raw is not None else {}
        with open(args.raw_output, "w", encoding="utf-8") as f:
            json.dump(raw_data, f, ensure_ascii=False, indent=2)
        if args.verbose:
            print(f"Wrote raw data to: {args.raw_output}", file=sys.stderr if args.json else sys.stdout)

    print_result(
        debate_result,
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

    if args.show_config:
        runtime = get_runtime_config(args)
        print_config_summary(runtime)
        print_config_info()
        sys.exit(0)

    runtime = get_runtime_config(args)
    if args.devui:
        run_devui(args, runtime)
    else:
        asyncio.run(run_cli(args, runtime))


if __name__ == "__main__":
    main()
