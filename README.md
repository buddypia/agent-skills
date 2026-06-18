# agent-skills

**English** · [한국어](./README.ko.md) · [日本語](./README.ja.md) · [中文](./README.zh.md)

A small, MIT-licensed collection of cross-agent **[Agent Skills](https://agentskills.io)** by buddypia. Each skill follows the open `SKILL.md` standard, so it works across Claude Code, OpenAI Codex, Cursor, Gemini CLI, and other compatible agents.

## Skills

| Skill | What it does |
|---|---|
| [`multi-llm-debate`](./skills/multi-llm-debate) | Three different-vendor LLMs argue a topic as Proponent / Opponent / Moderator and reach a multi-perspective verdict. |
| [`multi-llm-reflection`](./skills/multi-llm-reflection) | A Generator → Critic → Refiner loop where each role runs on a different-vendor LLM. |
| [`multi-llm-recursive-meta-cognition`](./skills/multi-llm-recursive-meta-cognition) | A Decompose → Solve → Verify → Integrate → Reflect pipeline across different-vendor LLMs. |

> These skills orchestrate vendor CLIs that you install yourself (`agy` / Antigravity, `claude` / Claude Code, `codex` / Codex). See each skill's README for setup, model overrides, and an offline `mock` mode.

## Install

Using the [`skills`](https://skills.sh) CLI (works with Claude Code, Codex, Cursor, Gemini CLI, and many more agents):

```bash
# Browse/add skills from this repo
npx skills add buddypia/agent-skills
```

Or install manually by copying a skill folder into your agent's skills directory — for example `~/.claude/skills/<name>/` (Claude Code) or `~/.agents/skills/<name>/` (Codex). Each skill is a self-contained directory with `SKILL.md`, `scripts/`, and its own `README.md`.

## Requirements

Each skill drives the official vendor CLIs you install yourself, under your own login: `agy` (Antigravity), `claude` (Claude Code), `codex` (Codex). Verify with `command -v agy claude codex`. Python dependencies (`pydantic` / `python-dotenv` / `pyyaml`) are auto-prepared by each skill's `run.sh` (uv if available, else venv + pip).

## Disclaimer

These skills orchestrate official CLIs that you install yourself; they do **not** circumvent authentication or billing, and API keys are supported as an alternative. **You are responsible for complying with each provider's and CLI's terms of service** when automating them — automating subscription-authenticated CLIs may be subject to usage restrictions, and any account or usage consequences are your own.

"Claude" / "Claude Code" (Anthropic), "GPT" / "ChatGPT" / "Codex" (OpenAI), and "Gemini" / "Antigravity" (Google) are trademarks of their respective owners. This is an independent project and is **not affiliated with, endorsed by, or sponsored by** Anthropic, OpenAI, or Google.

Default model IDs (e.g. `gemini-3.5-flash`, `claude-opus-4-8`, `gpt-5.5`) reflect the latest models as of 2026-06 and change over time; override them per skill. Multi-model orchestration is a design choice and **does not guarantee better results**. Treat model outputs as untrusted and review them, and be mindful of prompt-injection when feeding in third-party content.

## License

MIT © 2026 buddypia. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE). Each skill also bundles its own LICENSE and a per-skill **References & Attribution** section crediting the research that inspired it.
