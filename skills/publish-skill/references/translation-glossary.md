# Translation glossary & rules (en / ja / ko / zh)

The four root READMEs (`README.md`, `README.ja.md`, `README.ko.md`, `README.zh.md`) are kept
**line-number isomorphic**: the same structural element sits at the same line number in every
file. When you add or translate content, preserve that.

## Translate / don't-translate rules

**DON'T translate (keep byte-identical across all four files):**
- All `## H2` headers (`## Skills`, `## Use cases`, `## Why these skills exist`,
  `## When to use it (and when not)`, `## Install`, `## Requirements`, `## Disclaimer`,
  `## License`) — they stay in **English** in every language.
- Skill ids and the first table column: `` | [`<id>`](./skills/<id>) | ``
- Capitalized pipeline stage names: `Generator → Critic → Refiner`,
  `Decompose → Solve → Verify → Integrate → Reflect` (arrow is ` → `, U+2192, surrounded by spaces)
- Brand/CLI names: `agy` / Antigravity, `claude` / Claude Code, `codex` / Codex
- Model ids: `gemini-3.5-flash`, `claude-opus-4-8`, `gpt-5.5`
- Paths/filenames/links: `~/.claude/skills/<name>/`, `~/.agents/skills/<name>/`, `SKILL.md`,
  `run.sh`, `README.md`, `https://agentskills.io`, `https://skills.sh`, `./LICENSE`, `./NOTICE`
- `References & Attribution`
- The Install bash block (lines ~37–40), English comment included

**DO translate:** intro prose, Why/Use cases/When-to-use/Install/Requirements/Disclaimer body
text, table **column headers**, and the Pattern column's **generic role nouns**.

## Term table

| Concept | en | ja | ko | zh |
|---|---|---|---|---|
| H1 title | `# agent-skills` | `# agent-skills` | `# agent-skills` | `# agent-skills` |
| All H2 headers | (English) | (English) | (English) | (English) |
| Skills col 1 | `Skill` | `Skill` | `Skill` | `Skill` |
| Skills col 2 | `Pattern` | `パターン` | `패턴` | `模式` |
| Skills col 3 | `Problem it addresses` | `解決する課題` | `해결하는 문제` | `解决的问题` |
| Use-cases bullet dash | ` — ` (single em) | ` — ` (single em) | ` — ` (single em) | ` —— ` (**double em**) |
| Use-cases skill id | `**<id>**` (bold) | `**<id>**` | `**<id>**` | `**<id>**` |
| pipeline arrow | ` → ` | ` → ` | ` → ` | ` → ` |
| debate roles (translate) | `Proponent / Opponent / Moderator → verdict` | `賛成者 / 反対者 / 進行役 → 結論` | `찬성 측 / 반대 측 / 중재자 → 결론` | `正方 / 反方 / 主持人 → 结论` |
| fixed stage names (keep en) | `Generator → Critic → Refiner` | (English) | (English) | (English) |
| fixed stage names (keep en) | `Decompose → Solve → Verify → Integrate → Reflect` | (English) | (English) | (English) |
| language switcher (self = bold) | `**English**` · `[English](./README.md)` | `**日本語**` · `[日本語](./README.ja.md)` | `**한국어**` · `[한국어](./README.ko.md)` | `**中文**` · `[中文](./README.zh.md)` |
| switcher separator | ` · ` (middle dot) | ` · ` | ` · ` | ` · ` |
| different-vendor | `**different-vendor**` | `**異なるベンダー**` | `**서로 다른 벤더**` | `**不同厂商**` |
| sycophancy gloss | `sycophancy` | `（追従性, sycophancy）` | `(아첨, sycophancy)` | `（即谄媚, sycophancy）` |
| prompt injection | `prompt-injection` | `プロンプトインジェクション` | `프롬프트 인젝션(prompt-injection)` | `提示注入（prompt-injection）` |
| build vs buy | `build-vs-buy` | `build vs buy` | `build vs buy` | `build vs buy` |
| LLMs-per-skill count | `two or three` | `2〜3 個` | `2~3개` | `2~3 个` |
| quote style | ASCII `"…"` | `「…」` | ASCII `"…"` | full-width `"…"` |

## Insertion shapes (adding one skill = +2 lines per file)

**Site A — Skills table** (insert after the last data row):
```
| [`<id>`](./skills/<id>) | <PATTERN translated per rules> | <PROBLEM translated> |
```

**Site B — Use cases** (insert after the last bullet):
```
en/ja/ko:  - **<id>** — <use case translated>
zh:        - **<id>** —— <use case translated>     # double em dash
```

## Caveats (verified)
- The intro's "two or three" is a count of **LLMs per skill**, not a count of skills — adding
  a skill does NOT normally touch it (unless you generalize the positioning prose).
- For a non-multi-LLM skill, the intro/Requirements/Install summary prose may need
  generalizing (see SKILL.md Step 3) — that is a deliberate, separate, all-four-languages edit.
