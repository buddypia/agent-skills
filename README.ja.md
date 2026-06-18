# agent-skills

[English](./README.md) · [한국어](./README.ko.md) · **日本語** · [中文](./README.zh.md)

buddypia による、MIT ライセンスのクロスエージェント **[Agent Skills](https://agentskills.io)** の小さなコレクションです。各スキルはオープンな `SKILL.md` 標準に準拠しているため、Claude Code、OpenAI Codex、Cursor、Gemini CLI、その他の互換エージェントをまたいで動作します。

## Skills

| Skill | What it does |
|---|---|
| [`multi-llm-debate`](./skills/multi-llm-debate) | ベンダーの異なる 3 つの LLM が、賛成者 / 反対者 / 進行役としてトピックを論じ合い、多角的な視点からの結論に到達します。 |
| [`multi-llm-reflection`](./skills/multi-llm-reflection) | Generator → Critic → Refiner のループで、各ロールがそれぞれ異なるベンダーの LLM 上で実行されます。 |
| [`multi-llm-recursive-meta-cognition`](./skills/multi-llm-recursive-meta-cognition) | ベンダーの異なる LLM をまたいで実行される Decompose → Solve → Verify → Integrate → Reflect のパイプラインです。 |

> これらのスキルは、ユーザー自身がインストールするベンダー CLI（`agy` / Antigravity、`claude` / Claude Code、`codex` / Codex）をオーケストレーションします。セットアップ、モデルの上書き設定、オフラインの `mock` モードについては、各スキルの README を参照してください。

## Install

[`skills`](https://skills.sh) CLI を使う方法（Claude Code、Codex、Cursor、Gemini CLI、その他多くのエージェントで動作します）:

```bash
# Browse/add skills from this repo
npx skills add buddypia/agent-skills
```

または、スキルのフォルダをエージェントのスキルディレクトリへ手動でコピーしてインストールすることもできます。たとえば `~/.claude/skills/<name>/`（Claude Code）や `~/.agents/skills/<name>/`（Codex）です。各スキルは、`SKILL.md`、`scripts/`、そして独自の `README.md` を備えた自己完結型のディレクトリです。

## Requirements

各スキルは、ユーザー自身がインストールし、ユーザー自身のログインのもとで動作する公式ベンダー CLI を駆動します: `agy`（Antigravity）、`claude`（Claude Code）、`codex`（Codex）。`command -v agy claude codex` で確認してください。Python の依存パッケージ（`pydantic` / `python-dotenv` / `pyyaml`）は、各スキルの `run.sh` によって自動的に準備されます（uv が利用可能であれば uv を、なければ venv + pip を使用します）。

## Disclaimer

これらのスキルは、ユーザー自身がインストールする公式 CLI をオーケストレーションするものであり、認証や課金を回避するものでは **ありません**。また、代替手段として API キーもサポートされています。**これらを自動化する際に、各プロバイダーおよび CLI の利用規約を遵守する責任はユーザーにあります** — サブスクリプション認証された CLI を自動化することは利用制限の対象となる場合があり、アカウントや利用に関するいかなる結果もユーザー自身の責任となります。

「Claude」/「Claude Code」（Anthropic）、「GPT」/「ChatGPT」/「Codex」（OpenAI）、「Gemini」/「Antigravity」（Google）は、それぞれの所有者の商標です。本プロジェクトは独立したプロジェクトであり、Anthropic、OpenAI、Google と **提携・承認・後援関係にはありません**。

デフォルトのモデル ID（例: `gemini-3.5-flash`、`claude-opus-4-8`、`gpt-5.5`）は 2026 年 6 月時点の最新モデルを反映しており、時間の経過とともに変化します。各スキルごとに上書きしてください。マルチモデルのオーケストレーションは設計上の選択であり、**より良い結果を保証するものではありません**。モデルの出力は信頼できないものとして扱い、必ず確認してください。また、サードパーティのコンテンツを入力する際にはプロンプトインジェクションに注意してください。

## License

MIT © 2026 buddypia. [LICENSE](./LICENSE) および [NOTICE](./NOTICE) を参照してください。各スキルにも独自の LICENSE と、そのスキルが着想を得た研究をクレジットするスキルごとの **References & Attribution** セクションが同梱されています。
