# agent-skills

[English](./README.md) · [한국어](./README.ko.md) · [日本語](./README.ja.md) · **中文**

由 buddypia 打造的一个小巧、采用 MIT 许可证的跨智能体 **[Agent Skills](https://agentskills.io)** 合集。每个技能都遵循开放的 `SKILL.md` 标准，因此可在 Claude Code、OpenAI Codex、Cursor、Gemini CLI 以及其他兼容的智能体中通用。

## Skills

| Skill | What it does |
|---|---|
| [`multi-llm-debate`](./skills/multi-llm-debate) | 三个来自不同厂商的 LLM 分别以正方 / 反方 / 主持人的角色就某一议题展开辩论，最终得出多视角的结论。 |
| [`multi-llm-reflection`](./skills/multi-llm-reflection) | 一个 生成器 → 评论者 → 优化者 的循环，其中每个角色都运行在来自不同厂商的 LLM 上。 |
| [`multi-llm-recursive-meta-cognition`](./skills/multi-llm-recursive-meta-cognition) | 一条横跨不同厂商 LLM 的 分解 → 求解 → 验证 → 整合 → 反思 流水线。 |

> 这些技能负责编排你自行安装的厂商 CLI（`agy` / Antigravity、`claude` / Claude Code、`codex` / Codex）。有关安装设置、模型覆盖以及离线 `mock` 模式，请参阅各技能各自的 README。

## Install

使用 [`skills`](https://skills.sh) CLI（可配合 Claude Code、Codex、Cursor、Gemini CLI 以及更多智能体使用）：

```bash
# Browse/add skills from this repo
npx skills add buddypia/agent-skills
```

或者手动安装，将某个技能文件夹复制到你的智能体技能目录中——例如 `~/.claude/skills/<name>/`（Claude Code）或 `~/.agents/skills/<name>/`（Codex）。每个技能都是一个自包含的目录，内含 `SKILL.md`、`scripts/` 以及它自己的 `README.md`。

## Requirements

每个技能都会驱动你自行安装、并以你自己的账号登录的官方厂商 CLI：`agy`（Antigravity）、`claude`（Claude Code）、`codex`（Codex）。可通过 `command -v agy claude codex` 进行验证。Python 依赖项（`pydantic` / `python-dotenv` / `pyyaml`）会由每个技能的 `run.sh` 自动准备（优先使用 uv，否则使用 venv + pip）。

## Disclaimer

这些技能负责编排你自行安装的官方 CLI；它们**不会**绕过身份验证或计费，并且也支持将 API 密钥作为替代方案。**在对这些 CLI 进行自动化时，你有责任遵守各提供商及各 CLI 的服务条款**——对以订阅方式进行身份验证的 CLI 进行自动化可能会受到使用限制，由此产生的任何账户或使用方面的后果均由你自行承担。

"Claude" / "Claude Code"（Anthropic）、"GPT" / "ChatGPT" / "Codex"（OpenAI）以及 "Gemini" / "Antigravity"（Google）均为其各自所有者的商标。本项目为独立项目，**与** Anthropic、OpenAI 或 Google **无任何关联，未获其认可，也未受其赞助**。

默认的模型 ID（例如 `gemini-3.5-flash`、`claude-opus-4-8`、`gpt-5.5`）反映的是截至 2026-06 时的最新模型，且会随时间变化；请按各技能逐一进行覆盖。多模型编排是一种设计选择，**并不保证能带来更好的结果**。请将模型输出视为不可信内容并加以审查，同时在输入第三方内容时务必警惕提示注入（prompt-injection）风险。

## License

MIT © 2026 buddypia。参见 [LICENSE](./LICENSE) 与 [NOTICE](./NOTICE)。每个技能还各自附带其自己的 LICENSE，以及一个针对该技能的 **References & Attribution** 章节，用以致谢启发该技能的相关研究。
