# Multi-LLM Reflection — Installation & Usage Guide

A workflow where LLMs from different vendors run a 3-stage Generate → Critique → Refine process, aiming to improve the result through cross-model critique.
For the skill definition (invocation summary), see [SKILL.md](./SKILL.md)

## How It Works

```
[Task] → Generator(generate) → Critic(critique) → Refiner(refine) → Final output
          agy/Gemini3.5     claude/opus-4-8  codex/gpt-5.5(xhigh)
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
    --generator-model gemini-3.5-flash \
    --critic-model    claude-opus-4-8 \
    --refiner-model   gpt-5.5
# without uv: source scripts/.venv/bin/activate && python scripts/main.py ...
# swap provider: --generator-provider {gemini|anthropic|openai|mock}
```

## Environment Variables

| Variable | Default | Purpose |
|------|------|------|
| `MULTILLM_REASONING_EFFORT` | `high` | Reasoning effort for Claude (`--effort`) and Codex (none/low/medium/high/xhigh/max). `xhigh` is the slowest and often exceeds the wall-clock budget — raise it only when you have the time |
| `MULTILLM_CLI_TIMEOUT` | `360` | Per-CLI-call timeout (seconds); each call is additionally capped at the time left in `MULTILLM_TOTAL_DEADLINE` |
| `MULTILLM_TOTAL_DEADLINE` | `540` | Whole-run wall-clock budget (seconds). Keeps the run under a typical 600s agent/Bash-tool ceiling; once spent, remaining stages return clearly-labeled **partial** output (`"degraded": true`) instead of the process being killed |
| `MULTILLM_AGY_PRINT_TIMEOUT` | `5m` | agy `--print-timeout` |
| `MULTILLM_CLAUDE_MODEL` / `MULTILLM_CODEX_MODEL` | — | per-backend model override |
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
| `... failed (exit ...)` / authentication error | run the relevant CLI interactively once to log in |
| Run is killed at ~10 min when launched by an agent | The run is bounded by `MULTILLM_TOTAL_DEADLINE` (540s) to finish before a typical **600s agent/Bash-tool ceiling**. If your harness still kills it, run as a **background** task, lower `MULTILLM_REASONING_EFFORT` (e.g. `medium`), or shorten the prompt. Do **not** simply raise `MULTILLM_CLI_TIMEOUT` — that makes a run longer, not safer |
| `WARNING: ... DEGRADED mode` / `"degraded": true` | A stage timed out or errored and returned placeholder text, so the result is **partial**. Raise `MULTILLM_TOTAL_DEADLINE` / `MULTILLM_CLI_TIMEOUT`, lower `MULTILLM_REASONING_EFFORT`, or simplify the prompt |
| `Prompt file not found` | check that `assets/prompts/*.txt` are bundled |
| Empty output / broken JSON | check each stage's raw output with `--verbose` |

## Architecture (summary)

- The 3 adapters (Claude/Codex/Antigravity) in `scripts/workflow/providers.py` implement `generate_structured()`. The role executors and workflow are unmodified.
- Structured output: claude `--output-format json --json-schema` (native), codex `--output-schema` (native), agy uses plaintext → JSON instruction + Pydantic validation.
- Long text always goes through stdin (avoiding ARG_MAX/escaping issues). agy is isolated with a tempdir cwd.
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
- **Model names.** Default model IDs (e.g. `gemini-3.5-flash`, `claude-opus-4-8`, `gpt-5.5`) reflect the latest models as of 2026-06 and change over time. Override them with the `--*-model` flags (see Usage) to match what your account can access.
- **No quality guarantee.** Multi-model reflection is a design choice intended to surface more perspectives; it does not guarantee better results, which depend on your task and the models used.
- **Untrusted output & prompt injection.** Prompts are passed to multiple external models. Treat the outputs as untrusted, review them, and be mindful of prompt-injection risk when feeding in third-party content.
