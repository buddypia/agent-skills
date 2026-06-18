# Multi-LLM Recursive Meta-Cognition — Setup & Usage Guide

A workflow where LLMs from different vendors run a 5-stage pipeline (decompose -> solve -> verify -> integrate -> reflect), aiming for more rigorous results on hard problems.
For the skill definition (invocation summary) see [SKILL.md](./SKILL.md).

## How It Works

```
[problem] → Decomposer → Solver → Verifier → Integrator → Reflector → final result
            agy/Gemini3.5  agy/Gemini3.5   claude/opus-4-8  codex/gpt-5.5      codex/gpt-5.5(xhigh)
```
Each stage runs in an independent context and emits structured JSON; the integrate and reflect stages incorporate the points raised by verification.

## Setup

### 1. CLI backends (use your existing CLI login)

| CLI | Stage | Install | Login |
|-----|------|------|------|
| `agy` (Antigravity CLI) | decompose · solve | https://antigravity.google → after installing, run `agy install` | OAuth on first run of `agy` |
| `claude` (Claude Code) | verify | `npm i -g @anthropic-ai/claude-code` | run `claude` → log in (subscription) |
| `codex` (Codex CLI) | integrate · reflect | `npm i -g @openai/codex` | `codex login` (ChatGPT subscription) |

Verify installation/login:
```bash
command -v agy claude codex      # OK if all three paths are printed
```

### 2. Python dependencies (one-time · a few MB)

For dependency management, **uv is recommended** ([install](https://docs.astral.sh/uv/)). `run.sh` (Windows: `run.ps1`/`run.cmd`) **uses `uv run` automatically when uv is present** (it auto-creates and syncs `.venv` from `uv.lock` in tens of ms), and **falls back to venv + pip** otherwise. Manual setup is usually unnecessary.

To do it manually:
```bash
cd <skill-dir>/scripts
uv sync                                              # uv recommended: create and sync .venv from uv.lock
# --- environments without uv (fallback) ---
python3 -m venv .venv && source .venv/bin/activate   # Windows: py -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt                      # only pydantic / python-dotenv / pyyaml
```

> **When changing dependencies (maintenance)**: edit `dependencies` in `pyproject.toml` → `uv lock` (updates `uv.lock`) → `uv export --frozen --no-hashes -o requirements.txt` (regenerates `requirements.txt`). `requirements.txt` is derived from `uv.lock`, so **do not edit it directly**.

## Usage

### run.sh (recommended)
```bash
<skill-dir>/scripts/run.sh "Walk through, step by step, the risks of moving the new product launch up by 6 months and how to mitigate them

[Context]
- Also note any known constraints such as product type, current stage, and regulatory requirements"

<skill-dir>/scripts/run.sh --verbose "..."   # detailed 5-stage output
<skill-dir>/scripts/run.sh --json    "..."   # JSON output
```
On Windows, use `run.ps1` (PowerShell) or `run.cmd` (cmd) with the same arguments.

### Direct execution / model overrides
```bash
# uv recommended (cwd set to scripts)
uv run --directory scripts main.py "problem" \
    --decomposer-model gemini-3.5-flash \
    --solver-model     gemini-3.5-flash \
    --verifier-model   claude-opus-4-8 \
    --integrator-model gpt-5.5 \
    --reflector-model  gpt-5.5
# without uv: source scripts/.venv/bin/activate && python scripts/main.py ...
# swap provider: --decomposer-provider {gemini|anthropic|openai|mock}
```

## Environment Variables

| Variable | Default | Purpose |
|------|------|------|
| `MULTILLM_REASONING_EFFORT` | `xhigh` | Codex reasoning effort (none/low/medium/high/xhigh) |
| `MULTILLM_CLI_TIMEOUT` | `360` | CLI call timeout (seconds) |
| `MULTILLM_AGY_PRINT_TIMEOUT` | `5m` | agy `--print-timeout` |
| `MULTILLM_CLAUDE_MODEL` / `MULTILLM_CODEX_MODEL` | — | per-backend model override |
| `REFLECTION_{DECOMPOSER,SOLVER,VERIFIER,INTEGRATOR,REFLECTOR}_{PROVIDER,MODEL}` | — | per-role override |

## Offline contract test (mock — no CLI/network required)
```bash
REFLECTION_DECOMPOSER_PROVIDER=mock REFLECTION_SOLVER_PROVIDER=mock REFLECTION_VERIFIER_PROVIDER=mock \
REFLECTION_INTEGRATOR_PROVIDER=mock REFLECTION_REFLECTOR_PROVIDER=mock \
  uv run --directory scripts main.py --no-config "test"   # without uv: scripts/.venv/bin/python scripts/main.py
```

## Troubleshooting

| Symptom | Action |
|------|------|
| `agy/claude/codex: command not found` | the install steps above + check PATH |
| `... failed (exit ...)` / login error | run the relevant CLI interactively once to log in |
| timeout (5 stages take a while) | increase `MULTILLM_CLI_TIMEOUT` (xhigh takes time) |
| `Prompt file not found` | check that `assets/prompts/*.txt` are bundled |
| empty output / broken JSON | inspect each stage's raw output with `--verbose` |

## Architecture (summary)

- The 3 adapters (Claude/Codex/Antigravity) in `scripts/workflow/providers.py` implement `generate_structured()`. The role executors and workflow are unmodified.
- Structured output: claude uses `--output-format json --json-schema` (native), codex uses `--output-schema` (native), and agy uses plain-text-to-JSON instructions + Pydantic validation.
- Long inputs always go through stdin (avoiding ARG_MAX/escaping). agy is isolated with a tempdir cwd.
- Dependency management uses uv (`pyproject.toml` + `uv.lock`), with a venv + pip fallback. Uses each CLI's existing login by default; API keys are also supported.

## References & Attribution

This skill is an original implementation; its **design was inspired by the ideas and processes** of the published research below. Methods and ideas are not subject to copyright — these citations are provided as a scholarly courtesy and do not imply any endorsement by the authors.

It implements an original five-stage pipeline — **Decompose → Solve → Verify → Integrate → Reflect**. The phrase "recursive meta-cognition" is this project's own framing, not a term of art from any single cited work. The individual stages draw on the research below.

- Zhou, D., Schärli, N., Hou, L., Wei, J., et al. (2023). *Least-to-Most Prompting Enables Complex Reasoning in Large Language Models*. ICLR 2023 (arXiv:2205.10625). https://arxiv.org/abs/2205.10625
- Weng, Y., Zhu, M., Xia, F., Li, B., et al. (2023). *Large Language Models are Better Reasoners with Self-Verification*. Findings of EMNLP 2023 (arXiv:2212.09561). https://arxiv.org/abs/2212.09561
- Madaan, A., Tandon, N., Gupta, P., et al. (2023). *Self-Refine: Iterative Refinement with Self-Feedback*. NeurIPS 2023 (arXiv:2303.17651). https://arxiv.org/abs/2303.17651
- Shinn, N., Cassano, F., Berman, E., Gopinath, A., Narasimhan, K., & Yao, S. (2023). *Reflexion: Language Agents with Verbal Reinforcement Learning*. NeurIPS 2023 (arXiv:2303.11366). https://arxiv.org/abs/2303.11366

## License

Released under the MIT License — © 2026 buddypia. See [LICENSE](./LICENSE).

This repository bundles only its own source. The runtime Python dependencies (`pydantic`, `python-dotenv`, `pyyaml`, and their transitive dependencies) are installed separately and are distributed under permissive licenses (MIT / BSD-3-Clause / PSF-2.0), all compatible with MIT.

## Disclaimer

- **Third-party CLIs & terms of service.** This project orchestrates the official CLIs you install yourself (`agy` / Antigravity, `claude` / Claude Code, `codex` / Codex). It does not circumvent authentication or billing. You are responsible for complying with each provider's and CLI's terms of service; automating subscription-authenticated CLIs may be subject to usage restrictions, and any account or usage consequences are your own. API keys are supported as an alternative.
- **No affiliation.** "Claude" / "Claude Code" (Anthropic), "GPT" / "ChatGPT" / "Codex" (OpenAI), and "Gemini" / "Antigravity" (Google) are trademarks of their respective owners. This is an independent project and is not affiliated with, endorsed by, or sponsored by Anthropic, OpenAI, or Google.
- **Model names.** Default model IDs (e.g. `gemini-3.5-flash`, `claude-opus-4-8`, `gpt-5.5`) reflect the latest models as of 2026-06 and change over time. Override them with the `--*-model` flags (see Usage) to match what your account can access.
- **No quality guarantee.** The multi-stage pipeline is a design choice intended to add rigor; it does not guarantee better results, which depend on your task and the models used.
- **Untrusted output & prompt injection.** Prompts are passed to multiple external models. Treat the outputs as untrusted, review them, and be mindful of prompt-injection risk when feeding in third-party content.
