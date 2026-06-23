# agent-skills

**English** · [한국어](./README.ko.md) · [日本語](./README.ja.md) · [中文](./README.zh.md)

A small, MIT-licensed collection of cross-agent **[Agent Skills](https://agentskills.io)** by buddypia. Most skills make two or three **different-vendor** LLMs (Gemini, Claude, GPT) check and build on each other's work; others are single-agent procedures that run entirely inside your agent — so you get more than a single model's one-shot answer on the questions that matter. Every skill follows the open `SKILL.md` standard and works across Claude Code, OpenAI Codex, Cursor, Gemini CLI, and other compatible agents.

## Why these skills exist

A single LLM has predictable blind spots: it rarely catches its own mistakes, it inherits the biases of its training data, and it tends to agree with the framing it is given (sycophancy). Asking the *same* model to "double-check itself" mostly repeats those blind spots.

The multi-LLM skills take a different approach — they assign each role to a **different vendor's** model. One model proposes; another, from a different lab with different training, critiques it or argues the opposite; then the results are reconciled. Independent models make *less-correlated* errors, so genuine disagreement surfaces real problems instead of echoing them. The aim is a more robust result on the decisions and deliverables where a single pass is not enough.

## Skills

| Skill | Pattern | Problem it addresses |
|---|---|---|
| [`multi-llm-debate`](./skills/multi-llm-debate) | Proponent / Opponent / Moderator → verdict | One-sided or overconfident answers on judgment calls |
| [`multi-llm-reflection`](./skills/multi-llm-reflection) | Generator → Critic → Refiner | A draft that needs a sharper, outside critique to improve |
| [`multi-llm-recursive-meta-cognition`](./skills/multi-llm-recursive-meta-cognition) | Decompose → Solve → Verify → Integrate → Reflect | Hard, multi-step problems where one pass reasons too shallowly |
| [`reflect`](./skills/reflect) | Trigger → 5 Whys → Placement → Cure + Prevent → Ledger | Bugs and near-misses that recur because the fix lands at the wrong level |
| [`claude-code-steering`](./skills/claude-code-steering) | Route / Audit → 4 axes → right mechanism | Instructions that live in the wrong mechanism, so CLAUDE.md bloats and rules get ignored |

> The `multi-llm-*` skills orchestrate vendor CLIs that you install yourself (`agy` / Antigravity, `claude` / Claude Code, `codex` / Codex); single-agent skills like `reflect` need no external CLI. See each skill's README for setup, model overrides, and an offline `mock` mode.

## Use cases

- **multi-llm-debate** — Architecture and tech-stack choices, build-vs-buy, risk assessment, "should we ship this?" calls — weighing trade-offs where you do not want a single model's bias to decide.
- **multi-llm-reflection** — Improving high-stakes writing and design: proposals, RFCs, docs, marketing copy, or an analysis you want critiqued by a model *other than* the one that wrote it.
- **multi-llm-recursive-meta-cognition** — Complex, multi-step reasoning: migration plans, debugging strategies, research-style questions — anything that benefits from decomposition, independent verification, and a final meta-review.
- **reflect** — Postmortems and root-cause analysis after a bug, near-miss, or repeated friction: turn the incident into a fix at the right control tier plus a written ledger, instead of a quick patch that lets it come back.
- **claude-code-steering** — Deciding where a Claude Code instruction belongs (CLAUDE.md vs rule vs skill vs subagent vs hook vs output style), and auditing an existing .claude config that has drifted or bloated.

## When to use it (and when not)

Reach for these when the stakes justify the extra time and tokens — a hard decision, a deliverable that has to be right, a thorny multi-step problem. The multi-LLM skills run several CLIs in sequence, so they are **slower and cost more** than a single prompt; for quick lookups or simple edits, a normal single-model call is the better tool. Multi-model orchestration reduces blind spots — it does **not** guarantee a correct answer, so always review the output.

## Install

Using the [`skills`](https://skills.sh) CLI (works with Claude Code, Codex, Cursor, Gemini CLI, and many more agents):

```bash
# Browse/add skills from this repo
npx skills add buddypia/agent-skills
```

Or install manually by copying a skill folder into your agent's skills directory — for example `~/.claude/skills/<name>/` (Claude Code) or `~/.agents/skills/<name>/` (Codex). Each skill is a self-contained directory with a `SKILL.md` and its own `README.md` (script-based skills also bundle `scripts/`).

## Requirements

The `multi-llm-*` skills drive the official vendor CLIs you install yourself, under your own login: `agy` (Antigravity), `claude` (Claude Code), `codex` (Codex). Verify with `command -v agy claude codex`. Python dependencies (`pydantic` / `python-dotenv` / `pyyaml`) are auto-prepared by each skill's `run.sh` (uv if available, else venv + pip). Single-agent skills like `reflect` need none of this.

## Disclaimer

These skills orchestrate official CLIs that you install yourself; they do **not** circumvent authentication or billing, and API keys are supported as an alternative. **You are responsible for complying with each provider's and CLI's terms of service** when automating them — automating subscription-authenticated CLIs may be subject to usage restrictions, and any account or usage consequences are your own.

"Claude" / "Claude Code" (Anthropic), "GPT" / "ChatGPT" / "Codex" (OpenAI), and "Gemini" / "Antigravity" (Google) are trademarks of their respective owners. This is an independent project and is **not affiliated with, endorsed by, or sponsored by** Anthropic, OpenAI, or Google.

Default model IDs (e.g. `gemini-3.5-flash`, `claude-opus-4-8`, `gpt-5.5`) reflect the latest models as of 2026-06 and change over time; override them per skill. Multi-model orchestration is a design choice and **does not guarantee better results**. Treat model outputs as untrusted and review them, and be mindful of prompt-injection when feeding in third-party content.

## License

MIT © 2026 buddypia. See [LICENSE](./LICENSE). Each skill also bundles its own LICENSE and a per-skill **References & Attribution** section crediting the research that inspired it.
