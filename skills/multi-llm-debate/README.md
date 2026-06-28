# Multi-LLM Debate — Installation & Usage Guide

A workflow where LLMs from different vendors debate a topic in three roles: proponent, opponent, and moderator. Each role runs its respective **vendor CLI** as a subprocess (it uses each CLI's existing login; API keys are also supported).
For the skill definition (invocation summary), see [SKILL.md](./SKILL.md).

## How it works

```
[topic] → Proponent(for) → Opponent(against) → Moderator(neutral eval) → integrated output
          agy (Antigravity)   claude (Claude)   codex (Codex)
          gemini-3.5-flash    claude-opus-4-8    gpt-5.5(xhigh)
```

Each role produces structured JSON based solely on its assigned role within an independent context, and each stage references the output of the previous one.
**Provider assignment is random by default** (the three vendors are shuffled across the three roles on every run; use `--fixed` to pin them).

## CLIs used (official, latest models with structured output)

| Provider | CLI (the CLI binary itself, not pip) | Authentication | Structured output |
|------|------|------|------|
| anthropic | `claude` (`npm i -g @anthropic-ai/claude-code`) | `claude` login (subscription) | `claude -p --json-schema` → `structured_output` |
| openai | `codex` (`npm i -g @openai/codex`) | `codex login` (ChatGPT) | `codex exec --output-schema` |
| gemini | `agy` (https://antigravity.google → `agy install`) | `agy` first-run OAuth | `agy -p` (plain text → JSON extraction + Pydantic validation) |

Each CLI runs under the user's existing login, so no API key is required by default (except when running inside an agent sandbox, where API keys can be supplied). Please follow each CLI's and provider's terms of service — see the [Disclaimer](#disclaimer).

> **Design note**: Previously each vendor's heavyweight SDK (`claude-agent-sdk` / `openai-codex` / `google-antigravity`) was used, but these bundle OS- and architecture-specific CLI binaries (hundreds of MB in total), making them impossible to distribute or port to another environment. We therefore standardized on a lightweight approach that calls the CLIs the user has installed directly via `subprocess` (the same as reflection / recursive). The only Python dependencies are the three packages `pydantic / python-dotenv / pyyaml`.

### Authentication

- **Running directly from a terminal**: works without an API key as long as each CLI is logged in.
- **Running in an agent (sandbox)**: since the local login session cannot be read, set `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` as environment variables or in `.env`. When an API key is available, Gemini calls the API directly (via the standard library `urllib`) without going through the `agy` CLI, avoiding the login prompt.

## Installation

### 1. Vendor CLIs (use your existing CLI login)

| CLI | Installation | Authentication |
|-----|------|------|
| `agy` (Antigravity CLI) | https://antigravity.google → `agy install` | OAuth on first run |
| `claude` (Claude Code) | `npm i -g @anthropic-ai/claude-code` | log in with `claude` |
| `codex` (Codex CLI) | `npm i -g @openai/codex` | `codex login` (ChatGPT) |

If `command -v agy claude codex` (Windows: `where agy claude codex`) finds all three, you are good to go.

### 2. Python dependencies (one-time, a few MB)

Dependency management uses **uv (recommended)** ([install](https://docs.astral.sh/uv/)). `run.sh` (Windows: `run.ps1`/`run.cmd`) **automatically uses `uv run` when uv is available** (it creates and syncs `.venv` per `uv.lock`, in tens of milliseconds), and **falls back to venv + pip** otherwise. Manual setup is normally unnecessary.

To do it manually:
```bash
cd <skill-dir>/scripts
uv sync                                          # uv recommended: create/sync .venv from uv.lock
# --- environments without uv (fallback) ---
python3 -m venv .venv && . .venv/bin/activate    # Windows: py -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt                  # pydantic / python-dotenv / pyyaml only
```

> **When changing dependencies (maintenance)**: edit `dependencies` in `pyproject.toml` → run `uv lock` (updates `uv.lock`) → run `uv export --frozen --no-hashes -o requirements.txt` (regenerates `requirements.txt`). `requirements.txt` is a **derived artifact of `uv.lock`, so do not edit it by hand**.

## Usage

### run.sh (recommended)
```bash
<skill-dir>/scripts/run.sh "Should we deploy AI in customer support?

[Context]
- B2B SaaS / 3,000 inquiries per month / annual budget 5M JPY / SOC2 compliance required"

<skill-dir>/scripts/run.sh --verbose "..."   # detail for all three roles
<skill-dir>/scripts/run.sh --json    "..."   # JSON output
```
On Windows, use `run.ps1` (PowerShell) or `run.cmd` (cmd) with the same arguments.

### Provider assignment strategy (random by default)
```bash
<skill-dir>/scripts/run.sh "..."            # default = shuffle (three vendors assigned 1:1 to the three roles at random, varying each run)
<skill-dir>/scripts/run.sh --random "..."   # independent random per role (duplicates allowed)
<skill-dir>/scripts/run.sh --fixed  "..."   # fixed (for=gemini / against=anthropic / neutral=openai)
```

### Model override / per-role provider
```bash
# uv recommended (set cwd to scripts)
uv run --directory scripts main.py "topic" \
    --proponent-model gemini-3.5-flash \
    --opponent-model  claude-opus-4-8 \
    --moderator-model gpt-5.5
# without uv: scripts/.venv/bin/python scripts/main.py ... (Windows: .venv\Scripts\python.exe)
# per-role provider: --{proponent,opponent,moderator}-provider {gemini|anthropic|openai|mock}
```

## Environment variables

| Variable | Default | Purpose |
|------|------|------|
| `DEBATE_PROVIDER_STRATEGY` | `shuffle` | Assignment strategy (shuffle / random / fixed) |
| `MULTILLM_REASONING_EFFORT` | `high` | Reasoning effort for Claude (`--effort`) and Codex (none/minimal/low/medium/high/xhigh/max). `xhigh` is the slowest and routinely exceeds the wall-clock budget — raise it only when you have the time |
| `MULTILLM_CLI_TIMEOUT` | `360` | Per-CLI-call timeout (seconds); each call is additionally capped at the time left in `MULTILLM_TOTAL_DEADLINE` |
| `MULTILLM_TOTAL_DEADLINE` | `540` | Whole-run wall-clock budget (seconds). Keeps the run under a typical 600s agent/Bash-tool ceiling: each call is capped at the time remaining, and once the budget is spent the remaining stages return clearly-labeled **partial** output (`"degraded": true`) instead of the whole process being killed |
| `MULTILLM_AGY_PRINT_TIMEOUT` | `5m` | agy `--print-timeout` |
| `MULTILLM_CLAUDE_MODEL` / `MULTILLM_CODEX_MODEL` | — | Per-backend model override |
| `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | — | API keys (when not using CLI login / when running in a sandbox). Only Gemini uses it for direct API calls |
| `DEBATE_{PROPONENT,OPPONENT,MODERATOR}_{PROVIDER,MODEL}` | — | Per-role override |

## Offline contract test (mock — no CLI/network required)
```bash
DEBATE_PROPONENT_PROVIDER=mock DEBATE_OPPONENT_PROVIDER=mock DEBATE_MODERATOR_PROVIDER=mock \
  uv run --directory scripts main.py --no-config "test"   # without uv: scripts/.venv/bin/python scripts/main.py
```

## Troubleshooting

| Symptom | Resolution |
|------|------|
| `agy / claude / codex: command not found` | Install the relevant CLI and add it to your PATH (verify with `command -v`) |
| `models/... is not found (404)` (gemini) | The default is `gemini-3.5-flash`. The `agy` CLI takes over automatically |
| Authentication error | Run the relevant CLI interactively to log in once, or set an API key |
| Run is killed at ~10 min when launched by an agent | The run is bounded by `MULTILLM_TOTAL_DEADLINE` (540s) to finish before a typical **600s agent/Bash-tool ceiling**. If your harness still kills it, run the skill as a **background** task, lower `MULTILLM_REASONING_EFFORT` (e.g. `medium`), or shorten the prompt. Do **not** simply raise `MULTILLM_CLI_TIMEOUT` — that makes a run longer, not safer |
| `WARNING: ... DEGRADED mode` / `"degraded": true` | One or more roles timed out or errored and returned placeholder text, so the verdict is **partial**. Raise `MULTILLM_TOTAL_DEADLINE` / `MULTILLM_CLI_TIMEOUT`, lower `MULTILLM_REASONING_EFFORT`, or simplify the topic, then re-run |
| Codex/Claude slow | Lower `MULTILLM_REASONING_EFFORT` (`high`→`medium`); `xhigh` is the slowest tier |
| Empty output / corrupted JSON | Use `--verbose` to inspect the raw output of each stage |

## Architecture (summary)

- The three adapters in `scripts/workflow/providers.py` (`ClaudeCliAdapter` / `CodexAdapter` / `AntigravityCliAdapter`) implement `generate_structured()`. The role executors and workflow are unchanged.
- Each CLI is invoked via `asyncio.create_subprocess_exec`, and long inputs are passed through stdin (no `shell=True`, OS-independent). claude/codex produce native JSON schema output; Antigravity extracts JSON from plain-text output and validates it with Pydantic.
- claude uses `--allowed-tools "" --permission-mode dontAsk`, and each CLI runs with a working tempdir as its cwd so that project settings and hooks are not read — pure generation.
- Gemini calls the API directly via the standard library `urllib` only when an API key is available; otherwise it uses the `agy` CLI.
- Provider assignment is handled by `settings.get_{shuffled,random}_providers()`, and strategy selection by `main._resolve_provider_strategy()` (default shuffle).
- Dependency management uses uv (`pyproject.toml` + `uv.lock`), with venv + pip as the fallback. The only Python dependencies are the three packages `pydantic / python-dotenv / pyyaml`.

## References & Attribution

This skill is an original implementation; its **design was inspired by the ideas and processes** of the published research below. Methods and ideas are not subject to copyright — these citations are provided as a scholarly courtesy and do not imply any endorsement by the authors.

It implements a structured **Multi-Agent Debate**: fixed adversarial roles (a Proponent arguing *for*, an Opponent arguing *against*) whose outputs a neutral Moderator integrates into a final verdict.

- Irving, G., Christiano, P., & Amodei, D. (2018). *AI safety via debate*. arXiv:1805.00899. https://arxiv.org/abs/1805.00899
- Liang, T., He, Z., Jiao, W., et al. (2023). *Encouraging Divergent Thinking in Large Language Models through Multi-Agent Debate*. arXiv:2305.19118 (EMNLP 2024). https://arxiv.org/abs/2305.19118
- Du, Y., Li, S., Torralba, A., Tenenbaum, J. B., & Mordatch, I. (2023). *Improving Factuality and Reasoning in Language Models through Multiagent Debate*. arXiv:2305.14325 (ICML 2024). https://arxiv.org/abs/2305.14325
- Khan, A., Hughes, J., Valentine, D., et al. (2024). *Debating with More Persuasive LLMs Leads to More Truthful Answers*. arXiv:2402.06782 (ICML 2024). https://arxiv.org/abs/2402.06782

## License

Released under the MIT License — © 2026 buddypia. See [LICENSE](./LICENSE).

This repository bundles only its own source. The runtime Python dependencies (`pydantic`, `python-dotenv`, `pyyaml`, and their transitive dependencies) are installed separately and are distributed under permissive licenses (MIT / BSD-3-Clause / PSF-2.0), all compatible with MIT.

## Disclaimer

- **Third-party CLIs & terms of service.** This project orchestrates the official CLIs you install yourself (`agy` / Antigravity, `claude` / Claude Code, `codex` / Codex). It does not circumvent authentication or billing. You are responsible for complying with each provider's and CLI's terms of service; automating subscription-authenticated CLIs may be subject to usage restrictions, and any account or usage consequences are your own. API keys are supported as an alternative.
- **No affiliation.** "Claude" / "Claude Code" (Anthropic), "GPT" / "ChatGPT" / "Codex" (OpenAI), and "Gemini" / "Antigravity" (Google) are trademarks of their respective owners. This is an independent project and is not affiliated with, endorsed by, or sponsored by Anthropic, OpenAI, or Google.
- **Model names.** Default model IDs (e.g. `gemini-3.5-flash`, `claude-opus-4-8`, `gpt-5.5`) reflect the latest models as of 2026-06 and change over time. Override them with the `--*-model` flags (see Usage) to match what your account can access.
- **No quality guarantee.** Multi-model debate is a design choice intended to surface more perspectives; it does not guarantee better results, which depend on your task and the models used.
- **Untrusted output & prompt injection.** Prompts are passed to multiple external models. Treat the outputs as untrusted, review them, and be mindful of prompt-injection risk when feeding in third-party content.
