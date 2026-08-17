# Multi-LLM Reflection — Installation & Usage Guide

A workflow where LLMs from different vendors run a 3-stage Generate → Critique → Refine process, aiming to improve the result through cross-model critique.
For the skill definition (invocation summary), see [SKILL.md](./SKILL.md)

## How It Works

```
[Task] → Generator(generate) → Critic(critique) → Refiner(refine) → Final output
          agy/gemini-3.7     claude/opus-5    codex/gpt-3.6-luna(xhigh)
```
Each stage outputs structured JSON in an independent context, and the refine stage incorporates the critique results.

## Installation

### 1. CLI Backends (use your existing CLI login)

| CLI | Stage | Install | Authentication |
|-----|------|------|------|
| `agy` (Antigravity CLI) | Generate | https://antigravity.google → after install, run `agy install` | OAuth on first run of `agy` |
| `claude` (Claude Code) | Critique | `npm i -g @anthropic-ai/claude-code` | run `claude` → log in (subscription) |
| `codex` (Codex CLI) | Refine | `npm i -g @openai/codex` | `codex login` (ChatGPT subscription) |

Verify installation/authentication:
```bash
command -v agy claude codex      # OK if all 3 paths are printed
```

### 2. Python Dependencies (one-time · a few MB)

Dependency management uses **uv (recommended)** ([install](https://docs.astral.sh/uv/)). `run.sh` (Windows: `run.ps1`/`run.cmd`) **automatically uses `uv run` if uv is available** (creating and syncing `.venv` from `uv.lock` in tens of ms), and otherwise **falls back to venv + pip**. Manual installation is usually unnecessary.

To do it manually:
```bash
cd <skill-dir>/scripts
uv sync                                              # uv recommended: create/sync .venv from uv.lock
# --- environment without uv (fallback) ---
python3 -m venv .venv && source .venv/bin/activate   # Windows: py -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt                      # only pydantic / python-dotenv / pyyaml
```

> **When changing dependencies (maintenance)**: edit `dependencies` in `pyproject.toml` → `uv lock` (update `uv.lock`) → `uv export --frozen --no-hashes -o requirements.txt` (regenerate `requirements.txt`). `requirements.txt` is derived from `uv.lock`, so **do not edit it directly**.

## Usage

### run.sh (recommended)
```bash
<skill-dir>/scripts/run.sh "Design the technical architecture for a new SaaS

[Context]
- B2B billing management / 1000 companies in year one / AWS·SOC2 compliant / infrastructure within 500,000 yen per month"

<skill-dir>/scripts/run.sh --verbose "..."   # detailed 3-stage output
<skill-dir>/scripts/run.sh --json    "..."   # JSON output
```
On Windows, use `run.ps1` (PowerShell) or `run.cmd` (cmd) with the same arguments.

### Direct execution / model override
```bash
# uv recommended (cwd set to scripts)
uv run --directory scripts main.py "task" \
    --generator-model gemini-3.7-flash \
    --critic-model    claude-opus-5 \
    --refiner-model   gpt-3.6-luna
# without uv: source scripts/.venv/bin/activate && python scripts/main.py ...
# swap provider: --generator-provider {gemini|anthropic|openai|mock}
```

## Environment Variables

| Variable | Default | Purpose |
|------|------|------|
| `MULTILLM_REASONING_EFFORT` | `high` | Reasoning effort for Claude, Codex, and agy. agy supports low/medium/high; higher-only Codex values are clamped to `high` for agy. `xhigh` is the slowest and often exceeds the wall-clock budget — raise it only when you have the time |
| `MULTILLM_CLI_TIMEOUT` | `360` | Per-CLI-call timeout (seconds); each call is additionally capped at the time left in `MULTILLM_TOTAL_DEADLINE` |
| `MULTILLM_TOTAL_DEADLINE` | `540` | Whole-run wall-clock budget (seconds). Keeps the run under a typical 600s agent/Bash-tool ceiling; once spent, remaining stages return clearly-labeled **partial** output (`"degraded": true`) instead of the process being killed |
| `MULTILLM_AGY_PRINT_TIMEOUT` | `5m` | agy `--print-timeout` |
| `MULTILLM_DIGEST_THRESHOLD` | `8000` | Character threshold for the downstream context relay. When the request/context exceeds it, the critic/refiner receive the generator's `context_digest` plus a short verbatim excerpt instead of the full original (which used to be re-sent to every stage). `0` disables distillation; if the digest is missing (e.g. a degraded stage 1) the full original is relayed as before |
| `MULTILLM_SHARD_THRESHOLD` | `3 x MULTILLM_DIGEST_THRESHOLD` (24000) | Above this, the context is **sharded and distilled in parallel before the generator runs**: it is split on Markdown headings → blank lines → size, and each shard is distilled concurrently by a different vendor (round-robin over the three stages). Every stage — the generator included — then works from the resulting digest pack, so no single call ever reads the whole original. `0` keeps only the generator-digest tier |
| `MULTILLM_SHARD_CHARS` | `12000` | Target maximum characters per shard — this is what sets the shard count, so shard size stays roughly constant as the input grows |
| `MULTILLM_SHARD_MAX` | `16` | Maximum number of shards. When the input needs more than this many shards of `MULTILLM_SHARD_CHARS` to cover, the run warns and reports `context_relay.oversized_shards` — raise this, or curate the input into a brief |
| `MULTILLM_SHARD_CONCURRENCY` | `8` | Maximum **simultaneous** distillation calls. Independent of the shard count: excess shards queue and run in later batches, so a large input never spawns a matching number of CLI processes |
| `MULTILLM_DISTILL_EFFORT` | `low` | Reasoning effort for the shard-distillation calls only (the work is mechanical; stages keep `MULTILLM_REASONING_EFFORT`) |
| `MULTILLM_CLAUDE_MODEL` / `MULTILLM_CODEX_MODEL` | — | per-backend model override (checked against the same policy as every other channel) |
| `MULTILLM_ALLOW_LEGACY_MODELS` | unset | Allow an out-of-date model ID instead of refusing it. By default a retired snapshot or a superseded generation (`claude-3-*`, `gpt-4*`, `gemini-2.*`, …) is rejected **before the run starts**, naming the flag / env var / config key it came from — otherwise it only surfaces later as an opaque vendor 404 that a stage swallows into placeholder text. Set to `1` only when a gateway remaps the old name |
| `REFLECTION_{GENERATOR,CRITIC,REFINER}_{PROVIDER,MODEL}` | — | per-role override |

## Offline Contract Test (mock — no CLI/network required)
```bash
REFLECTION_GENERATOR_PROVIDER=mock REFLECTION_CRITIC_PROVIDER=mock REFLECTION_REFINER_PROVIDER=mock \
  uv run --directory scripts main.py --no-config "test"   # without uv: scripts/.venv/bin/python scripts/main.py
```

## Troubleshooting

| Symptom | Action |
|------|------|
| `agy/claude/codex: command not found` | install above + check PATH |
| `Error: model '...' is out of date` (exit 1, nothing ran) | The model ID is a retired snapshot or a superseded generation. The message names the flag / env var / config key that supplied it — point that at a current ID (`--show-config` lists the defaults). Only set `MULTILLM_ALLOW_LEGACY_MODELS=1` if a gateway remaps the old name |
| `Error: unknown provider '...'` (exit 1) | Typo in a `provider:` value. Valid: `gemini`, `anthropic` (alias `claude`), `openai`, `mock`. This used to silently pair the typo with an OpenAI model ID and fail much later, inside a stage |
| `... failed (exit ...)` / authentication error | run the relevant CLI interactively once to log in |
| Run is killed at ~10 min when launched by an agent | The run is bounded by `MULTILLM_TOTAL_DEADLINE` (540s) to finish before a typical **600s agent/Bash-tool ceiling**. If your harness still kills it, run as a **background** task, lower `MULTILLM_REASONING_EFFORT` (e.g. `medium`), or shorten the prompt. Do **not** simply raise `MULTILLM_CLI_TIMEOUT` — that makes a run longer, not safer |
| `WARNING: ... DEGRADED mode` / `"degraded": true` | A stage timed out or errored and returned placeholder text, so the result is **partial**. Raise `MULTILLM_TOTAL_DEADLINE` / `MULTILLM_CLI_TIMEOUT`, lower `MULTILLM_REASONING_EFFORT`, or simplify the prompt |
| `degraded_stages` contains `context_distillation` | The **context relay** lost fidelity, not a stage. Read `context_relay` in the JSON result: `failed_shards` (a shard errored, timed out, or was skipped for budget), `truncated_shards` (digests cut to fit the relay budget), `oversized_shards` (input too large to cover at `MULTILLM_SHARD_MAX`). Raise `MULTILLM_SHARD_MAX` / `MULTILLM_DIGEST_THRESHOLD`, or curate the input into a brief |
| `Prompt file not found` | check that `assets/prompts/*.txt` are bundled |
| Empty output / broken JSON | check each stage's raw output with `--verbose` |

## Architecture (summary)

- The 3 adapters (Claude/Codex/Antigravity) in `scripts/workflow/providers.py` implement `generate_structured()`. The role executors and workflow are unmodified.
- Structured output: claude `--output-format json --json-schema`, codex `--output-schema`, and agy `--output-format json --json-schema` all use their native structured-output modes.
- Claude and Codex receive long text through stdin. agy's `-p` mode does not consume stdin as task content, so its complete task is passed in the print prompt; agy is isolated with a tempdir cwd.
- Gemini uses the `agy` CLI (subscription OAuth) first; it only falls back to the direct API via the standard library `urllib` when `agy` itself fails and `GEMINI_API_KEY` is available. An incidental `GEMINI_API_KEY` exported for some unrelated tool never overrides the OAuth session. The direct-API path strips schema fields (e.g. `additionalProperties`) that the Gemini REST `responseSchema` (an OpenAPI 3.0 subset) doesn't support.
- Dependency management uses uv (`pyproject.toml` + `uv.lock`), with venv + pip as fallback. Uses each CLI's existing login by default; API keys are also supported.

## References & Attribution

This skill is an original implementation; its **design was inspired by the ideas and processes** of the published research below. Methods and ideas are not subject to copyright — these citations are provided as a scholarly courtesy and do not imply any endorsement by the authors.

It implements a **Generator → Critic → Refiner** reflection loop, with the variation that each role runs on a *different-vendor* LLM. The core generate → critique → refine pattern comes from Self-Refine; the cross-model critique dimension draws on Multi-Agent Debate; it also builds on the self-critique-and-improve line of Reflexion and the critique-then-revise pattern of Constitutional AI.

- Madaan, A., Tandon, N., Gupta, P., et al. (2023). *Self-Refine: Iterative Refinement with Self-Feedback*. NeurIPS 2023 (arXiv:2303.17651). https://arxiv.org/abs/2303.17651
- Shinn, N., Cassano, F., Berman, E., Gopinath, A., Narasimhan, K., & Yao, S. (2023). *Reflexion: Language Agents with Verbal Reinforcement Learning*. NeurIPS 2023 (arXiv:2303.11366). https://arxiv.org/abs/2303.11366
- Bai, Y., Kadavath, S., Kundu, S., Askell, A., Kernion, J., et al. (2022). *Constitutional AI: Harmlessness from AI Feedback*. arXiv preprint, Anthropic (arXiv:2212.08073). https://arxiv.org/abs/2212.08073
- Du, Y., Li, S., Torralba, A., Tenenbaum, J. B., & Mordatch, I. (2024). *Improving Factuality and Reasoning in Language Models through Multiagent Debate*. ICML 2024 (arXiv:2305.14325). https://arxiv.org/abs/2305.14325

## License

Released under the MIT License — © 2026 buddypia. See [LICENSE](./LICENSE).

This repository bundles only its own source. The runtime Python dependencies (`pydantic`, `python-dotenv`, `pyyaml`, and their transitive dependencies) are installed separately and are distributed under permissive licenses (MIT / BSD-3-Clause / PSF-2.0), all compatible with MIT.

## Disclaimer

- **Third-party CLIs & terms of service.** This project orchestrates the official CLIs you install yourself (`agy` / Antigravity, `claude` / Claude Code, `codex` / Codex). It does not circumvent authentication or billing. You are responsible for complying with each provider's and CLI's terms of service; automating subscription-authenticated CLIs may be subject to usage restrictions, and any account or usage consequences are your own. API keys are supported as an alternative.
- **No affiliation.** "Claude" / "Claude Code" (Anthropic), "GPT" / "ChatGPT" / "Codex" (OpenAI), and "Gemini" / "Antigravity" (Google) are trademarks of their respective owners. This is an independent project and is not affiliated with, endorsed by, or sponsored by Anthropic, OpenAI, or Google.
- **Model names.** Default model IDs (e.g. `gemini-3.7-flash`, `claude-opus-5`, `gpt-3.6-luna`) reflect the latest models as of 2026-07 and change over time; they are defined in one place (`scripts/workflow/models.py`). Override them with the `--*-model` flags (see Usage) to match what your account can access. Model IDs from retired or superseded generations are refused before the run starts — see `MULTILLM_ALLOW_LEGACY_MODELS` if you need to override that.
- **No quality guarantee.** Multi-model reflection is a design choice intended to surface more perspectives; it does not guarantee better results, which depend on your task and the models used.
- **Untrusted output & prompt injection.** Prompts are passed to multiple external models. Treat the outputs as untrusted, review them, and be mindful of prompt-injection risk when feeding in third-party content.
