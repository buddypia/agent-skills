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

> **Long runs / timeouts:** the **5 sequential** stages can take several minutes (may show no output while running) — this is the heaviest of the three skills. The run self-bounds to `MULTILLM_TOTAL_DEADLINE` (540s) so it returns before a typical **600s agent/Bash-tool ceiling**, but when invoking from an agent harness you should run it as a **background** task. If a stage times out it returns placeholder text and the result is flagged `"degraded": true` with a stderr warning — treat it as partial. Speed levers: lower `MULTILLM_REASONING_EFFORT` (`high`→`medium`); do **not** just raise `MULTILLM_CLI_TIMEOUT`.
>
> **Large context** (two tiers, both automatic — this skill benefits most, having 5 stages):
> - **Above `MULTILLM_DIGEST_THRESHOLD`** (8000 chars): the 4 later stages get the decomposer's `context_digest` + a short verbatim excerpt instead of the full original.
> - **Above `MULTILLM_SHARD_THRESHOLD`** (24000 chars): the context is first **split into topic shards and distilled in parallel across all five stages' vendors**, and *every* stage — decomposer included — works from that digest pack, so no single call reads the whole original. Costs one extra fan-out (~1 call of wall-clock, `MULTILLM_DISTILL_EFFORT=low`).
>
> Shard **count** follows input size (`MULTILLM_SHARD_CHARS`, capped at `MULTILLM_SHARD_MAX`) while **concurrency** is capped separately (`MULTILLM_SHARD_CONCURRENCY`), so a huge input neither produces giant shards nor spawns a matching number of CLI processes. The pre-stage is also bounded in wall clock (a share of the remaining budget, split fairly across batches) and in size (the pack stays near the tier-1 threshold even if a distiller doesn't compress).
>
> Failures degrade loudly, never silently: a failed shard becomes a labeled verbatim excerpt, and if all shards fail (or the budget is too tight) the run falls back to the digest tier. Every lossy outcome is counted in the result's **`context_relay`** field and folded into `degraded_stages` as `context_distillation`, so a JSON-only caller sees it. `MULTILLM_DIGEST_THRESHOLD=0` relays the full original always. Curating a brief yourself still beats both tiers when you can.

## Prerequisites & details

`command -v agy claude codex` must resolve all three. CLI install/auth, model & env overrides, and troubleshooting → see [README.md](./README.md). Offline contract test (no CLI/network): the `mock` provider.
