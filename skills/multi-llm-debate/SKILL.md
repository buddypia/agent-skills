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
>
> **Large context** (two tiers, both automatic):
> - **Above `MULTILLM_DIGEST_THRESHOLD`** (8000 chars): the opponent/moderator get the proponent's `context_digest` + a short verbatim excerpt instead of the full original.
> - **Above `MULTILLM_SHARD_THRESHOLD`** (24000 chars): the context is first **split into topic shards and distilled in parallel by all three vendors**, and *every* role — proponent included — works from that digest pack, so no single call reads the whole original. Costs one extra fan-out (~1 call of wall-clock, `MULTILLM_DISTILL_EFFORT=low`).
>
> Shard **count** follows input size (`MULTILLM_SHARD_CHARS`, capped at `MULTILLM_SHARD_MAX`) while **concurrency** is capped separately (`MULTILLM_SHARD_CONCURRENCY`), so a huge input neither produces giant shards nor spawns a matching number of CLI processes. The pre-stage is also bounded in wall clock (a share of the remaining budget, split fairly across batches) and in size (the pack stays near the tier-1 threshold even if a distiller doesn't compress).
>
> Failures degrade loudly, never silently: a failed shard becomes a labeled verbatim excerpt, and if all shards fail (or the budget is too tight) the run falls back to the digest tier. Every lossy outcome is counted in the result's **`context_relay`** field and folded into `degraded_stages` as `context_distillation`, so a JSON-only caller sees it. `MULTILLM_DIGEST_THRESHOLD=0` relays the full original always. Curating a brief yourself still beats both tiers when you can.

`run.sh` auto-prepares Python deps (uses uv if available, else venv+pip — no manual `pip`). The only prerequisite is installing the three CLIs once.

## Prerequisites & details

`command -v agy claude codex` must resolve all three. CLI install/auth, model & env overrides, and troubleshooting → see [README.md](./README.md). Offline contract test (no CLI/network): the `mock` provider.
