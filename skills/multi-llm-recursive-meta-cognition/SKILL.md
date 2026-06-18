---
name: multi-llm-recursive-meta-cognition
description: Runs a 5-stage recursive meta-cognition pipeline (decompose→solve→verify→integrate→reflect) across different-vendor LLMs (Gemini, Claude, GPT) to solve complex problems rigorously. Use for hard multi-step reasoning or deep problem-solving where a single pass is insufficient. Runs via subscription-authenticated CLIs; API keys are also supported.
---

# Multi-LLM Recursive Meta-Cognition

Different-vendor CLIs (`agy` / `claude` / `codex`) run a 5-stage pipeline — **decompose → solve → verify → integrate → reflect** — to solve a complex problem with high rigor. Each CLI runs under your existing login; API keys are also supported. See the Disclaimer in the README before use.

## Run

```bash
# macOS / Linux
<skill-dir>/scripts/run.sh "problem to solve (add known constraints/context)"
# Windows: <skill-dir>\scripts\run.ps1 "..."   (or run.cmd "...")
# Flags: --verbose (5-stage detail) | --json
```

`run.sh` auto-prepares Python deps (uses uv if available, else venv+pip — no manual `pip`). The only prerequisite is installing the three CLIs once.

> The 5 stages can take several minutes (may show no output while running).

## Prerequisites & details

`command -v agy claude codex` must resolve all three. CLI install/auth, model & env overrides, and troubleshooting → see [README.md](./README.md). Offline contract test (no CLI/network): the `mock` provider.
