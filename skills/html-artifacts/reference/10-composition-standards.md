# 10 - Composition Standards & Document Blueprints (組成基準と文書設計図)

> **Canonical source.** This document owns three things: (a) the **genre → blueprint** selection table (経営資料 / プロジェクト報告 / SaaS分析 / 技術仕様書 / 提案書 …), (b) the **composition rules** every generated document follows, and (c) the **typography & fine-tuning rules** - the axes where "adjust the font a little" requests are resolved by rule, not by ad-hoc overrides. Individual module contracts live in `04-module-catalog.md`; shape-level (single-purpose artifact) decisions live in `02-decision-criteria.md`; token/theme values live in `03-themes-and-palettes.md`. When a request names a document *genre*, start HERE; when it names a single visual (one diagram, one dashboard), start at 02.

---

## 1. Blueprints - ready-to-build document templates

A **blueprint** is one file `templates/blueprints/<id>.spec.json`: a complete, working
`tools/build.mjs` spec with realistic Japanese sample data, PLUS a `_recipe` block
(ignored by the builder) that documents intent - genre, audience, trigger phrases,
axis rationale, per-section roles/guides/volumes, and sensible swaps. So each blueprint
is simultaneously **runnable proof** and **adaptation manual**:

```
node tools/build.mjs templates/blueprints/<id>.spec.json out.html   # build as-is (demo; sample data is allowed only in the blueprint itself)
node tools/validate.mjs out.html                                    # PASS gate
# adapt: copy the spec, replace data per _recipe.outline guides, drop optional sections.
# The spec check fails while another blueprint's sample title / company / footer is still
# in your copy - every sample value must be replaced with the user's real content.
```

Hand-pasted modules (v3–v6, `section: (manual)`) are embedded through `html` sections
holding only the module's **markup** (all `{{VARS}}` filled) plus `"cssModules": ["<id>"]`;
the builder inlines the canonical CSS from `templates/modules/<id>.html`. Builder sections
cover everything else.

> **No CSS in specs.** Never paste a module's `<style data-module>` block into a spec. Copies
> went stale, and extracting one by searching for `<style data-module=` once started inside the
> module's header comment, silently dropping the first rule and collapsing grids (retro
> 2026-07-09). The builder now replaces any embedded copy with the canonical CSS (and says so),
> module headers no longer quote that tag, and `tools/index.mjs --check` fails if a module file
> contains it more than once. Hand-assembled pages (no builder) still copy the block - take it
> from the opening `<style data-module="…">` tag through `</style>`.

### 1.1 Genre → blueprint selection table

Match the request against triggers (any language); first match wins. If nothing
matches, fall back to §1.2.

| blueprint id | genre | pick when the request sounds like | axes (theme · layout · header · density) |
| --- | --- | --- | --- |
| `exec-briefing` | 経営資料 | 役員会資料 / 経営会議レポート / executive briefing / 経営サマリー / 이사회 보고 | slate · bento · split · comfortable |
| `project-report` | プロジェクト報告 | 進捗報告 / 週次報告 / project status report / プロジェクトレビュー / 프로젝트 현황 | slate · stack · split · comfortable |
| `meeting-pack` | 会議資料 | 会議アジェンダ / 意思決定会議の資料 / meeting pack / 論点整理 / 회의 자료 | birchline · stack · split · comfortable |
| `saas-analytics` | SaaS分析 | SaaS KPIレポート / MRR分析 / チャーン分析 / SaaS metrics report / 코호트 분석 | midnight · bento · split · compact |
| `research-summary` | 調査報告 | 市場調査レポート / ユーザー調査結果 / survey results / アンケート集計 / 리서치 요약 | birchline · stack · banner · comfortable |
| `product-launch` | リリース資料 | 新機能発表 / リリースノートページ / product launch / アップデート案内 / 출시 안내 | sunset · stack · none · comfortable |
| `tech-spec` | 技術仕様書 | 設計書 / API仕様 / technical spec / 内部仕様書 / 기술 명세 | dark-focus · stack · split · comfortable |
| `system-architecture` | アーキテクチャ仕様書 | システム構成図 / アーキテクチャ解説 / 分散システム設計 / OSSアーキテクチャ / 시스템 아키텍처 | dark-focus · stack · split · comfortable |
| `incident-report` | 障害報告書 | ポストモーテム / 障害報告 / incident postmortem / 振り返り(障害) / 장애 보고서 | slate · stack · split · comfortable |
| `onboarding-guide` | 導入ガイド | セットアップ手順 / 利用ガイド / getting started / チュートリアル / 온보딩 가이드 | forest · stack · standard · comfortable |
| `proposal` | 提案書 | 企画提案 / 営業提案 / proposal deck / 見積り提案 / 제안서 | rose · stack · banner · comfortable |

(The axes column is informative - each blueprint declares its axes explicitly in the
spec; the `_recipe.axes.rationale` line states why.)

### 1.2 Fallback order when no blueprint matches

1. **Nearest blueprint, adapted** - same audience/purpose, different topic: copy the
   closest blueprint and swap sections per its `_recipe.swaps`.
2. **Shape recipe** (`02-decision-criteria.md` §2) - the request is a single-purpose
   artifact (one dashboard, one diagram, one comparison), not a multi-part document.
3. **Module-level composition** - assemble from scratch: discover modules with
   `node tools/index.mjs --find "<keywords>"`, then follow §3–§5 rules here.

---

## 2. Selection flow (requirement → document)

```
request
  │  names a document GENRE? ──yes──▶ §1.1 table → blueprint → adapt data
  │                                     (drop optional sections, apply _recipe.swaps)
  no│
  ▼
  single-purpose visual? ──yes──▶ 02 §2 shape recipe
  no│
  ▼
  compose from modules: index.mjs --find → 04 contracts → §3 composition rules
```

Always end with the verification gate (§6) regardless of the path taken.

---

## 3. Composition rules (C-rules)

- **C1 · Conclusion first.** Sections 1–2 deliver the takeaway - a `key-takeaways`
  block, a KPI row, or a verdict callout - before any supporting detail. A reader who
  stops after one screen must still leave with the message.
- **C2 · One message per section; size the document to the job.** A section that argues
  two things becomes two sections. A 1-question request is 1–3 sections; a report 6–10. A
  document that genuinely needs 12+ sections stays one document only if it is navigable:
  `layout: "stack"`, `chapter` on the first section of each part (numbered chapter headings),
  short `navTitle`s, and the builder's contents rail (`nav: "auto"` turns it on at ≥ 8 titled
  sections or ≥ 2 chapters; inline contents box below 1100px). Past ~40 sections, split into
  linked documents. Narrative goes in `prose` sections, not `html` paragraphs.
- **C3 · Provenance meta.** Every business/tech document carries `meta` in the header
  (Version / Owner / Status / 期間 / 対象など). No anonymous artifacts.
- **C4 · Hand-pasted modules: 2–4 per document.** They are the highest-signal blocks
  (project-status, okr-board, api-endpoint, cohort-grid…); more than 4 dilutes the
  document and bloats the page. Builder sections carry the routine content.
- **C5 · Numbers carry context.** Any metric shown states its unit and period
  (万円 / %, 対象月, 前期比). Deltas state direction AND meaning: the arrow is `dir`, the
  colour is `tone` - a falling churn / latency / cost is `dir:"down", tone:"good"` (green ▼).
  Chart titles name the measure, unit and period; numeric table columns are right-aligned
  (the builder detects them).
- **C6 · No dead interactions.** No `href="#"`, no inert buttons (validate warns).
  CTA-bearing modules (hero-cta, pricing-table) link to real in-page anchors or are
  converted to non-interactive chips.
- **C7 · Density is an axis, not an override.** If the page feels loose/tight, switch
  `density` (`compact` / `comfortable` / `spacious`) - never hand-shrink individual
  sections. Per-table `density: "compact"` is the single sanctioned local exception.
- **C8 · Series colors are stable.** Within one document, one entity = one `--cat-N`
  everywhere it appears (same business line in chart, table, and diagram gets the
  same cat token). Max 5 concurrent series; aggregate the tail into "その他".

---

## 4. Typography rules (T-rules) - the fine-tuning axes, ruled

The type system is **7 fixed roles** (tokens.css); documents never invent sizes.
"フォントを少し大きく/小さく" requests are resolved by *changing the role or the axis*,
never by overriding a size.

### 4.1 Role map

| token | resolved (default density) | role - use for | per-document budget |
| --- | --- | --- | --- |
| `--type-display` | `650 clamp(2.25rem, 1.8rem + 1.8vw, 3.125rem)/1.08` | hero/banner headline only (`hero-cta`, `header: banner`) | 0–1 uses |
| `--type-h1` | `650 clamp(1.625rem, 1.4rem + 0.9vw, 2.125rem)/1.18` | the document title (header) | exactly 1 |
| `--type-h2` | `620 clamp(1.25rem, 1.15rem + 0.45vw, 1.5rem)/1.28` | section headings (builder emits these) | 1 per section |
| `--type-h3` | `600 1.0625rem/1.38` | module titles (figcaption), card titles | 1 per module/card |
| `--type-body` | `400 0.9375rem/1.65` | running prose | unlimited |
| `--type-small` | `400 0.84375rem/1.55` | table cells, legends, secondary prose | unlimited |
| `--type-caption` | `550 0.75rem/1.4` | axis labels, badges, kickers, chips | unlimited |

- **T1 · Families.** Only the four family tokens: `--font-sans` (UI+prose),
  `--font-serif` (via `--font-display`, essay/poster feeling - themes re-point it),
  `--font-mono` (numbers, code, timestamps, IDs, kickers). Raw `font-family` strings
  are forbidden.
- **T2 · Sizes.** Only the 7 `--type-*` tokens; raw `font-size` values are forbidden
  in modules, specs, and html sections. Headings never skip levels (h1 → h2 → h3).
- **T3 · Tracking.** Only `--tracking-display` / `--tracking-tight` (headlines) and
  `--tracking-eyebrow` (uppercase kickers, paired with `--type-caption`). No raw
  `letter-spacing`.
- **T4 · Numeric typesetting.** Comparable numbers get `font-variant-numeric:
  tabular-nums` and usually `--font-mono`; units/periods ride along in
  `--type-small` + `--text-muted`. Right-align numeric table columns.
- **T5 · One emphasis per statement.** Escalate in order - weight (built into the
  tokens) → accent color → badge/chip - and use exactly one level per statement.
  Bold + colored + badged text is a rule violation, not emphasis.
- **T6 · Size dissatisfaction protocol.** When type "feels wrong", change (in order):
  (1) the `density` axis - it legally rescales body/small and every gap;
  (2) the *role* - a cramped card title is `--type-h3` misused where `--type-caption`
  belongs, or vice versa;
  (3) the *theme* - personality blocks may re-point `--font-display` etc.
  Only if all three fail, redefine the token itself in a theme's personality block -
  NEVER per-element overrides.
- **T7 · Measure.** Body prose ≤ 76ch (essay/minimal themes enforce a reading
  measure); one-line labels stay one line (`text-overflow: ellipsis` over wrapping).

### 4.2 Japanese text specifics

- Line height is already tuned per role (body 1.6); do not tighten below 1.5 for
  Japanese body text.
- Mixed JA/EN labels: keep Latin metric names (MRR, NRR, SLA) in `--font-mono` or
  as-is - do not translate established metric names.
- Dates/times in `--font-mono` (agenda, changelog, timeline follow this already).

---

## 5. Spacing & color rules (S-rules)

- **S1 · Spacing tokens only.** All gaps/padding via `--sp-*` (derived from
  `--sp-unit`); raw px margins are forbidden. Whole-page rhythm changes go through
  the `density` axis (C7).
- **S2 · Semantic colors only.** `--accent`, `--cat-1..5`, `--bg-*`, `--text-*`,
  `--border-*`, `--color-success/warning/danger`, and `color-mix()` thereof. Raw
  hex/rgb/hsl fails `validate.mjs`. Status semantics are fixed: success=良好/達成,
  warning=注意/遅延リスク, danger=問題/削除 - never decorative.
- **S3 · Surface tokens.** Corners `--radius-*`, elevation `--shadow-*`, rules
  `--border-default/subtle`. Motion only via `--dur-*`/`--ease` and always
  reduced-motion guarded (modules already comply).

---

## 6. Verification gate (every document, every path)

```
node tools/build.mjs <spec> <out.html>     # for spec-built docs; hand-built docs skip.
                                           #   MUST: spec check clean, requirement ledger all ✓ / waived
node tools/render-check.mjs <out.html> --shots=<dir>
                                           # MUST: PASS at 1280 + 390px (overflow, dead anchors,
                                           #   console errors); fix or justify every WARN
node tools/validate.mjs <out.html>         # MUST: PASS - self-contained, token colors,
                                           #   SVG a11y, WCAG AA contrast
node tools/index.mjs --check               # after any module/index change only
```

Review greps (fast T/C/S-rule audit on any artifact):

```
grep -nE 'font-size:\s*[0-9]' out.html | grep -v -- '--type'   # raw sizes → T2 violation
grep -nE 'font-family:\s*[^v]' out.html | grep -v -- '--font'  # raw families → T1
grep -c 'href="#"' out.html                                    # dead CTAs → C6 (0 expected)
grep -cE '\{\{[A-Z0-9_]+\}\}' out.html                         # unfilled placeholders (0)
```

Visual pass - open the render-check screenshots at both widths (MUST, not optional):
conclusion visible in the first screen (C1), one emphasis per statement (T5), stable series
colors (C8), every number labelled (C5), nothing cramped, truncated or louder than its
importance. If no browser driver exists, say the page was not visually checked.

---

## 7. Blueprint catalog (summary)

The per-blueprint truth is each spec's `_recipe` (outline with roles/guides/volumes,
swaps, modules). This table is the quick index:

| id | 節数 | embedded manual modules | builder sections (main) |
| --- | --- | --- | --- |
| `exec-briefing` | 7 | key-takeaways, okr-board, roadmap | callout, chart, kpi |
| `project-report` | 8 | project-status, raci-matrix | callout, chart, checklist, kpi, table, timeline |
| `meeting-pack` | 6 | agenda, key-takeaways | callout, checklist, comparison, decision |
| `saas-analytics` | 8 | cohort-grid, composition-bar | callout, chart, funnel, kpi, table |
| `research-summary` | 7 | key-takeaways, diverging-bar, persona-card | callout, chart, comparison, statlist |
| `product-launch` | 6 | hero-cta, changelog, faq | callout, features, stepper |
| `tech-spec` | 8 | toc, api-endpoint, file-tree | callout, checklist, collapsible, diagram, table |
| `incident-report` | 7 | key-takeaways, fishbone, gap-analysis | callout, checklist, kpi, timeline |
| `onboarding-guide` | 7 | code-snippet, file-tree, faq | callout, checklist, collapsible, stepper |
| `proposal` | 9 | key-takeaways, gap-analysis, pricing-table, logo-wall (+ CTA anchor html section) | callout, comparison, features, timeline |

(If a row and a spec's `_recipe` ever disagree, the spec wins - regenerate this table.)
