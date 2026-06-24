# agent-skills

[English](./README.md) · [한국어](./README.ko.md) · **日本語** · [中文](./README.zh.md)

buddypia による、MIT ライセンスのクロスエージェント **[Agent Skills](https://agentskills.io)** の小さなコレクションです。ほとんどのスキルは、ベンダーの異なる 2〜3 個の LLM（Gemini、Claude、GPT）に互いの成果をチェックさせ、それを土台に作業を進めさせます。一方、エージェント内で完結する単一エージェント手続き型のスキルもあります — つまり、重要な問いに対して単一モデルの一発回答を超える結果が得られます。各スキルはオープンな `SKILL.md` 標準に準拠しており、Claude Code、OpenAI Codex、Cursor、Gemini CLI、その他の互換エージェントをまたいで動作します。

## Why these skills exist

単一の LLM には予測可能な盲点があります。自分の誤りにはなかなか気づけず、学習データのバイアスを受け継ぎ、与えられた前提に同調しがち（追従性, sycophancy）です。*同じ*モデルに「自分で再確認させる」だけでは、その盲点を繰り返すだけになりがちです。

マルチ LLM スキルは別のアプローチを取ります — 各ロールを**異なるベンダー**のモデルに割り当てるのです。あるモデルが案を出し、別の研究所で異なる学習を経たモデルがそれを批評したり反対意見を述べたりし、その結果をすり合わせます。独立したモデルは*相関の低い*誤りを犯すため、本物の意見の相違が、エコー（同調の反響）ではなく実際の問題を浮かび上がらせます。狙いは、単一パスでは不十分な意思決定や成果物において、より頑健な結果を得ることです。

## Skills

| Skill | パターン | 解決する課題 |
|---|---|---|
| [`multi-llm-debate`](./skills/multi-llm-debate) | 賛成者 / 反対者 / 進行役 → 結論 | 判断を要する問いでの、一方的または過信した回答 |
| [`multi-llm-reflection`](./skills/multi-llm-reflection) | Generator → Critic → Refiner | より鋭い外部からの批評で改善すべきドラフト |
| [`multi-llm-recursive-meta-cognition`](./skills/multi-llm-recursive-meta-cognition) | Decompose → Solve → Verify → Integrate → Reflect | 一回の推論では浅すぎる、難しい多段階の問題 |
| [`reflect`](./skills/reflect) | Trigger → 5 Whys → Placement → Cure + Prevent → Ledger | 修正が誤った階層に入るために繰り返すバグやニアミス |
| [`claude-code-steering`](./skills/claude-code-steering) | Route / Audit → 4 axes → right mechanism | 指示が誤ったメカニズムに置かれ、CLAUDE.md が肥大化しルールが無視される |

> `multi-llm-*` スキルは、ユーザー自身がインストールするベンダー CLI（`agy` / Antigravity、`claude` / Claude Code、`codex` / Codex）をオーケストレーションします。`reflect` のような単一エージェントスキルは外部 CLI を必要としません。セットアップ、モデルの上書き設定、オフラインの `mock` モードについては、各スキルの README を参照してください。

## Use cases

- **multi-llm-debate** — アーキテクチャや技術スタックの選定、内製か外部調達か（build vs buy）、リスク評価、「これをリリースすべきか？」といった判断 — 単一モデルのバイアスに決めさせたくない、トレードオフの検討に。
- **multi-llm-reflection** — 重要度の高い文章や設計の改善: 提案書、RFC、ドキュメント、マーケティング文面、あるいは*それを書いたモデルとは別の*モデルに批評させたい分析。
- **multi-llm-recursive-meta-cognition** — 複雑な多段階の推論: 移行計画、デバッグ戦略、研究的な問い — 分解・独立した検証・最終的なメタレビューが効くあらゆる問題。
- **reflect** — バグ・ニアミス・繰り返す摩擦のあとのポストモーテムと根本原因分析: 場当たり的な対処で再発させるのではなく、インシデントを正しい管理階層での修正と書面の台帳（ledger）に落とし込む。
- **claude-code-steering** — Claude Code の指示をどこに置くべきか（CLAUDE.md / ルール / スキル / サブエージェント / hook / アウトプットスタイル）の判断、そしてドリフトや肥大化した既存の .claude 設定の監査。

## When to use it (and when not)

これらは、追加の時間とトークンに見合うだけの重要性があるとき — 難しい意思決定、正確さが求められる成果物、込み入った多段階の問題 — に使ってください。マルチ LLM スキルは複数の CLI を順に実行するため、単一プロンプトより**遅く、コストも高くなります**。手早い調べ物や単純な編集には、通常の単一モデル呼び出しのほうが適しています。マルチモデルのオーケストレーションは盲点を減らしますが、正しい回答を**保証するものではありません**。出力は必ず確認してください。

## Install

[`skills`](https://skills.sh) CLI を使う方法（Claude Code、Codex、Cursor、Gemini CLI、その他多くのエージェントで動作します）:

```bash
# Browse/add skills from this repo
npx skills add buddypia/agent-skills
```

または、スキルのフォルダをエージェントのスキルディレクトリへ手動でコピーしてインストールすることもできます。たとえば `~/.claude/skills/<name>/`（Claude Code）や `~/.agents/skills/<name>/`（Codex）です。各スキルは、`SKILL.md` と独自の `README.md` を備えた自己完結型のディレクトリです（スクリプト型のスキルは `scripts/` も同梱します）。

## Requirements

`multi-llm-*` スキルは、ユーザー自身がインストールし、ユーザー自身のログインのもとで動作する公式ベンダー CLI を駆動します: `agy`（Antigravity）、`claude`（Claude Code）、`codex`（Codex）。`command -v agy claude codex` で確認してください。Python の依存パッケージ（`pydantic` / `python-dotenv` / `pyyaml`）は、各スキルの `run.sh` によって自動的に準備されます（uv が利用可能であれば uv を、なければ venv + pip を使用します）。`reflect` のような単一エージェントスキルにはこれらは不要です。

## Disclaimer

これらのスキルは、ユーザー自身がインストールする公式 CLI をオーケストレーションするものであり、認証や課金を回避するものでは **ありません**。また、代替手段として API キーもサポートされています。**これらを自動化する際に、各プロバイダーおよび CLI の利用規約を遵守する責任はユーザーにあります** — サブスクリプション認証された CLI を自動化することは利用制限の対象となる場合があり、アカウントや利用に関するいかなる結果もユーザー自身の責任となります。

「Claude」/「Claude Code」（Anthropic）、「GPT」/「ChatGPT」/「Codex」（OpenAI）、「Gemini」/「Antigravity」（Google）は、それぞれの所有者の商標です。本プロジェクトは独立したプロジェクトであり、Anthropic、OpenAI、Google と **提携・承認・後援関係にはありません**。

デフォルトのモデル ID（例: `gemini-3.5-flash`、`claude-opus-4-8`、`gpt-5.5`）は 2026 年 6 月時点の最新モデルを反映しており、時間の経過とともに変化します。各スキルごとに上書きしてください。マルチモデルのオーケストレーションは設計上の選択であり、**より良い結果を保証するものではありません**。モデルの出力は信頼できないものとして扱い、必ず確認してください。また、サードパーティのコンテンツを入力する際にはプロンプトインジェクションに注意してください。

## License

MIT © 2026 buddypia. [LICENSE](./LICENSE) を参照してください。各スキルにも独自の LICENSE と、そのスキルが着想を得た研究をクレジットするスキルごとの **References & Attribution** セクションが同梱されています。
