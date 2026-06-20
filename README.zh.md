# agent-skills

[English](./README.md) · [한국어](./README.ko.md) · [日本語](./README.ja.md) · **中文**

由 buddypia 打造的一个小巧、采用 MIT 许可证的跨智能体 **[Agent Skills](https://agentskills.io)** 合集。大多数技能都让 2~3 个来自不同厂商的 LLM（Gemini、Claude、GPT）互相检查彼此的成果并在此基础上继续推进；另一些则是完全在你的智能体内运行的单智能体流程——也就是说，在真正重要的问题上，你得到的结果会超越单一模型的一次性回答。每个技能都遵循开放的 `SKILL.md` 标准，因此可在 Claude Code、OpenAI Codex、Cursor、Gemini CLI 以及其他兼容的智能体中通用。

## Why these skills exist

单个 LLM 有着可预测的盲点：它很少能发现自己的错误，会继承训练数据中的偏见，并且倾向于认同被给定的前提（即谄媚, sycophancy）。让*同一个*模型“自我复核”，往往只是把这些盲点再重复一遍。

多 LLM 技能采用了不同的思路——把每个角色交给**不同厂商**的模型。一个模型提出方案；另一个来自不同实验室、经过不同训练的模型对其进行批评或提出相反意见；然后再对结果进行调和。相互独立的模型所犯的错误*相关性更低*，因此真正的分歧会暴露出实际问题，而不是相互附和。其目标是在单次处理不足以胜任的决策与产出上，获得更稳健的结果。

## Skills

| Skill | 模式 | 解决的问题 |
|---|---|---|
| [`multi-llm-debate`](./skills/multi-llm-debate) | 正方 / 反方 / 主持人 → 结论 | 在需要判断的问题上出现片面或过度自信的回答 |
| [`multi-llm-reflection`](./skills/multi-llm-reflection) | Generator → Critic → Refiner | 需要更犀利的外部批评来改进的草稿 |
| [`multi-llm-recursive-meta-cognition`](./skills/multi-llm-recursive-meta-cognition) | Decompose → Solve → Verify → Integrate → Reflect | 一次推理过于浅显的、困难的多步骤问题 |
| [`reflect`](./skills/reflect) | Trigger → 5 Whys → Placement → Cure + Prevent → Ledger | 因修复落在错误层级而反复出现的缺陷与未遂问题 |

> `multi-llm-*` 技能负责编排你自行安装的厂商 CLI（`agy` / Antigravity、`claude` / Claude Code、`codex` / Codex）；像 `reflect` 这样的单智能体技能则无需任何外部 CLI。有关安装设置、模型覆盖以及离线 `mock` 模式，请参阅各技能各自的 README。

## Use cases

- **multi-llm-debate** —— 架构与技术栈选型、自建还是采购（build vs buy）、风险评估、“这个该不该上线？”之类的判断——适用于你不希望由单一模型的偏见来拍板的各种权衡取舍。
- **multi-llm-reflection** —— 改进高风险的写作与设计：提案、RFC、文档、营销文案，或是你希望由*撰写它的模型之外*的另一个模型来批评的分析。
- **multi-llm-recursive-meta-cognition** —— 复杂的多步骤推理：迁移计划、调试策略、研究型问题——任何能从分解、独立验证以及最终元审查中获益的问题。
- **reflect** —— 缺陷、未遂问题或反复出现的摩擦之后的事后复盘与根因分析：把事件落实为在正确管控层级上的修复以及一份书面台账（ledger），而不是让它复发的临时补丁。

## When to use it (and when not)

当其价值足以抵得上额外的时间与 token 时再使用它们——艰难的决策、必须正确的产出、棘手的多步骤问题。多 LLM 技能会依次运行多个 CLI，因此比单次提示**更慢、成本也更高**；对于快速查询或简单编辑，普通的单模型调用才是更合适的工具。多模型编排能减少盲点，但**并不保证**给出正确答案，因此请务必审查输出。

## Install

使用 [`skills`](https://skills.sh) CLI（可配合 Claude Code、Codex、Cursor、Gemini CLI 以及更多智能体使用）：

```bash
# Browse/add skills from this repo
npx skills add buddypia/agent-skills
```

或者手动安装，将某个技能文件夹复制到你的智能体技能目录中——例如 `~/.claude/skills/<name>/`（Claude Code）或 `~/.agents/skills/<name>/`（Codex）。每个技能都是一个自包含的目录，内含 `SKILL.md` 以及它自己的 `README.md`（基于脚本的技能还会附带 `scripts/`）。

## Requirements

`multi-llm-*` 技能会驱动你自行安装、并以你自己的账号登录的官方厂商 CLI：`agy`（Antigravity）、`claude`（Claude Code）、`codex`（Codex）。可通过 `command -v agy claude codex` 进行验证。Python 依赖项（`pydantic` / `python-dotenv` / `pyyaml`）会由每个技能的 `run.sh` 自动准备（优先使用 uv，否则使用 venv + pip）。像 `reflect` 这样的单智能体技能则完全不需要这些。

## Disclaimer

这些技能负责编排你自行安装的官方 CLI；它们**不会**绕过身份验证或计费，并且也支持将 API 密钥作为替代方案。**在对这些 CLI 进行自动化时，你有责任遵守各提供商及各 CLI 的服务条款**——对以订阅方式进行身份验证的 CLI 进行自动化可能会受到使用限制，由此产生的任何账户或使用方面的后果均由你自行承担。

"Claude" / "Claude Code"（Anthropic）、"GPT" / "ChatGPT" / "Codex"（OpenAI）以及 "Gemini" / "Antigravity"（Google）均为其各自所有者的商标。本项目为独立项目，**与** Anthropic、OpenAI 或 Google **无任何关联，未获其认可，也未受其赞助**。

默认的模型 ID（例如 `gemini-3.5-flash`、`claude-opus-4-8`、`gpt-5.5`）反映的是截至 2026-06 时的最新模型，且会随时间变化；请按各技能逐一进行覆盖。多模型编排是一种设计选择，**并不保证能带来更好的结果**。请将模型输出视为不可信内容并加以审查，同时在输入第三方内容时务必警惕提示注入（prompt-injection）风险。

## License

MIT © 2026 buddypia。参见 [LICENSE](./LICENSE) 与 [NOTICE](./NOTICE)。每个技能还各自附带其自己的 LICENSE，以及一个针对该技能的 **References & Attribution** 章节，用以致谢启发该技能的相关研究。
