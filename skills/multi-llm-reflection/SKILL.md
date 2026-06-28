---
name: multi-llm-reflection
description: Runs a Generator→Critic→Refiner reflection loop across different-vendor LLMs (Gemini, Claude, GPT) to draft content, critique it, and produce an improved version. Use when generating high-quality writing, designs, or analyses that benefit from cross-model self-critique. Runs via subscription-authenticated CLIs; API keys are also supported.
---

# Multi-LLM Reflection

Different-vendor CLIs (`agy` / `claude` / `codex`) run as **generator, critic, and refiner** in sequence: draft content, critique it, then produce an improved final version. Each CLI runs under your existing login; API keys are also supported. See the Disclaimer in the README before use.

## Run

```bash
# macOS / Linux
<skill-dir>/scripts/run.sh "task to write or solve (add context for better quality)"
# Windows: <skill-dir>\scripts\run.ps1 "..."   (or run.cmd "...")
# Flags: --verbose (3-stage detail) | --json
```

> **Long runs / timeouts:** the Generator→Critic→Refiner loop makes **3 sequential** model calls and can take a few minutes. The run self-bounds to `MULTILLM_TOTAL_DEADLINE` (540s) so it returns before a typical **600s agent/Bash-tool ceiling**. When invoking from an agent harness, run it as a **background** task to avoid that wall-clock limit. If a stage times out, the result is flagged `"degraded": true` with a stderr warning — treat it as partial. Speed levers: lower `MULTILLM_REASONING_EFFORT` (`high`→`medium`); do **not** just raise `MULTILLM_CLI_TIMEOUT`.

`run.sh` auto-prepares Python deps (uses uv if available, else venv+pip — no manual `pip`). The only prerequisite is installing the three CLIs once.

## Prerequisites & details

`command -v agy claude codex` must resolve all three. CLI install/auth, model & env overrides, and troubleshooting → see [README.md](./README.md). Offline contract test (no CLI/network): the `mock` provider.
