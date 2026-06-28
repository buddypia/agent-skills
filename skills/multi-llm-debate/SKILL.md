---
name: multi-llm-debate
description: Runs a 3-role debate (proponent / opponent / moderator) where different-vendor LLMs (Gemini, Claude, GPT) argue a topic to reach a multi-perspective verdict. Use for hard decisions, trade-off analysis, or weighing opposing viewpoints before concluding. Runs via subscription-authenticated CLIs; API keys are also supported.
---

# Multi-LLM Debate

Different-vendor CLIs (`agy` / `claude` / `codex`) run as **proponent, opponent, and moderator** in sequence to debate a topic and produce a verdict. Providers are shuffled across roles each run by default. Each CLI runs under your existing login; API keys are also supported. See the Disclaimer in the README before use.

## Run

```bash
# macOS / Linux
<skill-dir>/scripts/run.sh "your topic (add context for better quality)"
# Windows: <skill-dir>\scripts\run.ps1 "..."   (or run.cmd "...")
# Flags: --verbose (per-role detail) | --json | --shuffle (default) | --random | --fixed
```

> **Long runs / timeouts:** a debate makes **3 sequential** model calls and can take a few minutes. The run self-bounds to `MULTILLM_TOTAL_DEADLINE` (540s) so it returns before a typical **600s agent/Bash-tool ceiling**. When invoking from an agent harness, run it as a **background** task to avoid that wall-clock limit. If a role times out, the result is flagged `"degraded": true` with a stderr warning — treat it as partial. Speed levers: lower `MULTILLM_REASONING_EFFORT` (`high`→`medium`); do **not** just raise `MULTILLM_CLI_TIMEOUT`.

`run.sh` auto-prepares Python deps (uses uv if available, else venv+pip — no manual `pip`). The only prerequisite is installing the three CLIs once.

## Prerequisites & details

`command -v agy claude codex` must resolve all three. CLI install/auth, model & env overrides, and troubleshooting → see [README.md](./README.md). Offline contract test (no CLI/network): the `mock` provider.
