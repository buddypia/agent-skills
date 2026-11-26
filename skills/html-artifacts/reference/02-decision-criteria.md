# 02 - Decision Criteria

> **Role**: this document is the owner of two decisions - **whether the output should be HTML at all** and **which shape to choose** once HTML is decided.
> Other documents defer to the criteria here; theme palettes, module details, and interaction contracts live in their own owner documents (03 / 04 / 05).

This document covers the 2 decisions you make when using the unified HTML system.

1. **Whether to output HTML or Markdown** (the principles of `html-over-markdown`)
2. **If you decide to output HTML, which "shape" to choose and which modules to combine** (the CATALOG that unifies the shape lineage of the legacy `html-artifacts` and the type lineage of the legacy `html-visual` with duplication removed)

The underlying architecture has 5 layers. Foundation (`reset.css` / `tokens.css` / `themes.css`) → Primitives (`elements.css`) → Modules (`templates/modules/*`) → Behaviors (`interactions.js`) → Shapes (`base.template.html` + module composition). This chapter is the map for deciding "when and with what" to assemble the topmost Shapes layer.

---

## 1. Whether to use HTML or Markdown

### 1.1 The default is Markdown; HTML is an "escalation"

This is not an either/or; decide on 2 axes: **consumer (who reads it)** and **content (whether the substance meets the escalation conditions)**.

| consumer | Default | Exception |
| --- | --- | --- |
| Intermediate output the agent itself uses for its next processing step | **Always Markdown** | None. Do not make it HTML |
| Final deliverable that a human reads | Markdown | **HTML** if it meets one or more of the escalation signals in the table below |

Do not make output that the agent re-reads / parses itself into HTML. HTML has value only for "deliverables that a human actually wants to read (report / plan / explainer, etc.)."

### 1.2 Escalation signals to HTML

Choose HTML if any of the following apply.

| Signal | Description | Representative shape |
| --- | --- | --- |
| **Volume** | Roughly exceeds 100 lines and requires navigation via heading hierarchy | report, spec |
| **Multi-dimensional comparison** | Lays out 2 or more options × multiple evaluation axes side by side | comparison, code-review |
| **Spatial / structural information** | Nodes/edges, regions, coordinates, etc.-where the planar placement itself carries meaning | diagram, chart |
| **Interactivity** | The reader operates it via reordering, filtering, dragging, tabs, sliders, etc. | dashboard, editor, kanban |
| **Shareability** | Value increases if it is distributed as a single file that opens directly in a browser | all shapes |

### 1.3 Conversely, cases that should remain Markdown

- Pure text correspondence, short answers, commit messages, standalone code snippets.
- Hand-offs between agents, input to tools, logs.
- Anything that one table conveys sufficiently, with no need for visual hierarchy or interactivity.

### 1.4 Invariants when outputting HTML (design contract)

Before any choice of shape or module, the output must always satisfy the following.

- **Dependency-free**: never use a CDN / external library / `<link href=URL>` / `<script src=URL>`. Plain HTML/CSS/JS only. A single file that opens offline.
- **Colors via semantic tokens only**: do not hardcode raw hex. Use `--bg-*` / `--text-*` / `--border-*` / `--accent` / `--color-*` (status) / `--cat-1..--cat-5` (series).
- **Diagrams / charts as inline SVG**: do not use ASCII art. Add `role="img"`+`aria-label` or `<title>`. Stroke width 1.5–2px, `rx` around 10, mono 11px labels, colors from the CSS variables above.
- **Reuse Primitives and data attributes**: prefer `elements.css` classes and `interactions.js` behaviors. When the request needs an unsupported layout or behavior, add scoped inline CSS/JS, keep the output dependency-free, and verify the resulting controls and states.

---

## 2. The unified SHAPE CATALOG

### 2.1 The unification concept (legacy shapes + types → de-duplication)

The legacy `html-artifacts` classified output into **shapes** (spec / code-review / prototype / report / editor / data-viz / diagram, among others), and the legacy `html-visual` classified it into **types** (mockup / wireframe / ERD / flowchart / chart / architecture / dashboard / timeline / mindmap / kanban / table, among others). The two overlap heavily (e.g., diagram ⊇ flowchart/ERD/architecture, data-viz ⊇ chart/dashboard).

In the unified system, these 2 lineages are folded into a shape set with the overlap between **"human-readable document family" and "visual deliverable family"** removed, and each shape is defined as a combination (composition) of real modules. Types are absorbed into the module variants chosen within a shape.

> Terminology note: "shape" here refers to a reusable pattern that uses `base.template.html` as a skeleton and pours a specific set of modules into `{{CONTENT}}`. Module names are exactly the real file names under `templates/modules/`.

Each recipe row below also carries a **Recommended layout · header · density** column - the page-level axes to choose alongside the theme (layouts `stack`/`bento`/`sidebar`/`split`, header variants `standard`/`compact`/`banner`/`split`/`none`, densities `comfortable`/`compact`/`spacious`). These are starting points: choose them **explicitly** from the request and project evidence, and record them in the spec. Reuse a fitting composition for the same conditions; previous deliveries and randomness do not influence selection. When a spec omits an axis, the builder derives it deterministically from the section mix and logs the derivation - the derivation table is owned by `07-build-spec.md` §1.1; the density tokens and theme structural personalities by `03-themes-and-palettes.md`.

### 2.1b Module discovery via the index (do this first)

> **Multi-part document or AI review?** When the request matches a document *genre* or core AI workflow (AI変更レビュー / データ分析 / 仕組み・コード解説 / インフォグラフィック / 経営資料 / 進捗報告 / SaaS分析 / 技術仕様書 / アーキテクチャ / 提案書 / 障害報告 / 会議資料 / リリース資料 / 調査報告 / 導入ガイド), start from one of the **15 blueprints** in `reference/10-composition-standards.md` §1.1 (`templates/blueprints/<id>.spec.json`). The shapes below are for single-purpose artifacts.

The shape recipes below are **starting compositions**, not the full palette. There are **112 modules** across 5 families; pick them by scanning **`index/COMPONENTS.md`** (generated from `index/components.json`) - match the request against each module's *use when / keywords / intent (EN·KO·JA) / input*, then open `04-module-catalog.md` only for the chosen ones. Do not read every module file.

The v2–v8 typed/manual modules slot into existing shapes (prefer deterministic typed section types in `tools/build.mjs` wherever available):

- **review & explanation**: `review-signoff` (`review` — OK/Fix/Hold verdicts + copyable Markdown feedback), `verification-run` (`verification` — PASS/FAIL/WARN test logs), `annotated-walkthrough` (`walkthrough` — synced step + target highlights).
- **report / dashboard**: `stat-trend`, `gauge`, `progress`, `chart-bullet`, `funnel`, `heatmap`, `cal-heatmap`, `chart-stacked` (supports stacked area via `areastacked`), `chart-scatter` (`scatter`), `chart-waterfall` (`waterfall`), `treemap`, `spectrum`, `slope-chart`, `dot-plot`, `waffle`, `boxplot`, `bump-chart`, `histogram`, `chart-combo`, `sparkline`, `pareto` (`pareto`), `chart-bubble`, `leaderboard` (`leaderboard`), `composition-bar`, `diverging-bar` (`diverging`), `cohort-grid` (`cohort`), `tag-cloud`, `pictogram`.
- **spec / code-review / comparison**: `diff-block` (`diff`), `code-snippet` (`code`), `before-after` (`beforeafter`), `file-tree` (`filetree`), `api-endpoint` (`apiendpoint`), `changelog` (`changelog`), `key-takeaways` (`takeaways`), `stat-list` (`statlist`), `tree`, `activity-feed`, `empty-state`, `feature-grid`, `radar`, `quadrant`, `risk-matrix`, `swot`, `pros-cons`, `rating-scale`, `glossary`, `raci-matrix`, `agenda`, `project-status`, `calendar-month`.
- **diagram**: `arch-explorer`, `pipeline-flow`, `request-trace`, `deployment-topology`, `service-catalog`, `event-catalog`, `failure-modes`, `sequence-diagram` (`sequence`), `state-diagram` (`statediagram`), `erd`, `sankey`, `fishbone`, `kpi-tree` (`kpitree`), `swimlane`, `gantt`, `cycle-loop`, `org-chart`, `journey-map`, `decision-tree`, `hub-spoke`, `concentric`, `force-field`, `roadmap`, `process-chevron`, `layer-stack`, `story-map`, `capability-map`, `okr-board`, `business-model-canvas`, `gap-analysis`, `maturity-ladder`.
- **interactive Q&A / pricing**: use `collapsible` for expandable FAQs and `comparison` / `table` for structured plans and partner lists.

### 2.2 Document-family shapes (human-read reports / specs / comparisons)

| shape | Primary trigger signal | Constituent modules (real file names) | Default theme | Recommended layout · header · density |
| --- | --- | --- | --- | --- |
| **report** | A human-facing summary over 100 lines, metrics + commentary + diagrams | `kpi-grid` + `chart-bar`/`chart-line`/`chart-donut` + `callout-box` + `timeline` | `birchline` | `stack` · `standard` · `comfortable` (data-heavy report: `bento` · `compact` header) |
| **spec** | Design spec, requirements, API definitions, organizing options | `tabs` + `comparison-grid` + `collapsible` + `data-table` + `callout-box` (+ `stepper` for numbered staged procedures / enforcement levels) | `birchline` | `sidebar` (a callout or small `kpi variant:"inline"` as `area:"side"`) · `split` header + `meta` (Version/Owner/Status) · `comfortable` |
| **comparison** | 2 or more options × multiple evaluation axes side by side | `comparison-grid` (recommended option with `.card-accent`+`.badge-accent`) + `data-table` | `birchline` | `stack` · `banner` · `comfortable` |
| **decision** | "Which should we pick?" - content whose purpose is a *decision*, not just a comparison ("의사결정", "뭘 선택해야", "어떤 게 나을까", "どれを選ぶべき", "判断材料") | `decision-matrix` (weighted criteria × options, score bars + per-cell rationale + verdict callout) + `callout-box` for assumptions/risks (+ `comparison-grid` for the qualitative pros/cons view) | `birchline` | `stack` · `split` header + `meta` · `comfortable` |
| **code-review** | PR review, diff annotations, severity-tagged findings | `diff-block` (`.sev-high`/`-med`/`-low` + `.diff-add`/`.diff-remove`) + `callout-box` | `birchline` | `sidebar` (side: summary callout + `kpi variant:"inline"`; main: diffs/tables) · `compact` · `comfortable` |
| **essay / long-form** | Long-form explanations / reading material, body-focused with restrained ornamentation | `callout-box` + `collapsible` + any chart | `minimal` | `stack` · `standard` · `comfortable` (or `spacious` for an airier read) |

Supplementary notes:
- Within a `report`, when you **want to add dashboard-like interactivity**, either add `data-table` (`[data-sortable]`+`[data-filter]`) or switch the theme to `dark-focus` (see 2.4).
- `comparison` was made an independent shape, but in practice it often completes with a single `comparison-grid`, the core module of `spec`.
- `essay` is best for long form because the `minimal` theme gives serif headings and a calm reading tone; keep any intentionally narrow measure as an explicit layout/artifact choice, not a theme side effect.

### 2.3 Visual / diagram-family shapes (showing space / structure)

Among the types of the legacy `html-visual`, all those belonging to "diagrams" are organized as module variants of a single **diagram** shape.

| shape | type variant | Trigger signal | Constituent module | Default theme | Recommended layout · header · density |
| --- | --- | --- | --- | --- | --- |
| **diagram** | flowchart | Process, branching, pipeline | `flow-diagram` (ellipse/rounded-rect/diamond, L-shaped connectors) | `dark-focus` | `stack` · `compact` · `comfortable` |
| | **architecture (default)** | A real system: services, zones, inter-service flows - 시스템 아키텍처 / システム構成 / architecture | `arch-explorer` (zone bands + routed edges + scenario tabs + component inspector; builder computes the geometry) | `dark-focus` | `stack` · `compact` · `comfortable` |
| | architecture (simple) | A small system you can take in at a glance, no flows to trace | `arch-diagram` (static zones `.z-1..z-4`, protocols HTTP/gRPC/pub-sub) | `dark-focus` | `stack` · `compact` · `comfortable` |
| | request latency | "where does the time go" across one request - 지연 시간 분석 / レイテンシ内訳 | `request-trace` (hops on a shared time axis, coloured by kind, slowest hop called out) | `slate` | `stack` · `compact` · `comfortable` |
| | deployment / infra | Where it physically runs, failover posture - 배포 토폴로지 / デプロイ構成 | `deployment-topology` (region → zone → unit, replica counts, region-less edge strip) | `dark-focus` | `stack` · `compact` · `comfortable` |
| | data pipeline | Stage-by-stage transformation of data/events - 데이터 파이프라인 / パイプライン | `pipeline-flow` (stage cards + per-stage in/out + branch chips) | `dark-focus` | `stack` · `compact` · `comfortable` |
| | ERD | Entities, relations, cardinality | `erd` (entity card + `.chip` PK/FK + 1:1/1:N/N:M connectors) | `dark-focus` | `stack` · `compact` · `comfortable` |
| | mindmap | Idea organization radiating from a central node | `mindmap` (root + branches `.b1..b5` + child nodes) | `dark-focus` | `stack` · `compact` · `comfortable` |
| | node graph | A node-edge network the reader explores interactively (dependencies, relations) | `node-graph` (`[data-zoompan]` stage + `[data-draggable]` nodes with auto-tracking edges + `[data-crossfilter]` group legend) | `dark-focus` | `stack` · `compact` (or `banner` to present it) · `comfortable` |
| | sequence | Message order between services/actors over time ("시퀀스", "シーケンス図", API call flow, handshake) | `sequence-diagram` (lifelines + activation bars + sync/return arrows + note) | `dark-focus` | `stack` · `compact` · `comfortable` |
| | state machine | States and guarded transitions ("状態遷移", "상태 전이", lifecycle) | `state-diagram` (initial dot, rounded states, double-circle final, labeled transitions) | `dark-focus` | `stack` · `compact` · `comfortable` |
| | swimlane | A process split by owner/department lanes ("스윔레인", "誰が何をやるか") | `swimlane` (actor lanes + process boxes + cross-lane arrows) | `dark-focus` | `stack` · `compact` · `comfortable` |
| | gantt / roadmap | Tasks on a time axis with progress + milestones ("ガント", "간트", "로드맵") | `gantt` (period axis + progress-filled bars + milestone diamonds + today line) | `slate` | `stack` · `compact` · `comfortable` |
| | cycle | A closed loop of recurring steps (PDCA, feedback loop, "循環", "사이클") | `cycle-loop` (3–6 nodes on a ring + arc arrows + center hub) | `forest` | `stack` · `compact` · `comfortable` |
| | org / hierarchy | Reporting lines or containment hierarchy ("組織図", "조직도") | `org-chart` (top-down boxes + orthogonal connectors) | `slate` | `stack` · `compact` · `comfortable` |
| | KPI / driver tree | Decomposing a metric into drivers ("KPIツリー", "로직 트리", 売上 = 訪問×CVR×単価) | `kpi-tree` (root KPI → branches with × + ÷ operator chips) | `slate` | `stack` · `compact` · `comfortable` |
| | user journey | Stages × emotion curve × touchpoints/pains ("ジャーニーマップ", "여정 지도") | `journey-map` (stage columns + SVG emotion polyline + touchpoint/pain rows) | `birchline` | `stack` · `banner` · `comfortable` |
| | fishbone / cause-effect | Attributing causes to one effect ("特性要因図", "피쉬본", root-cause analysis) | `fishbone` (spine → problem head + angled category bones + cause ribs) | `dark-focus` | `stack` · `compact` · `comfortable` |
| | sankey / quantity flow | Quantities splitting/merging across branches ("サンキー図", "생키", traffic/budget flows) | `sankey` (node bars + bezier ribbons, width = quantity) | `dark-focus` | `stack` · `compact` · `comfortable` |
| | decision tree | Branching conditions leading to outcomes ("決定木", "의사결정 트리", if/then routing) | `decision-tree` (question nodes + labeled condition edges + tinted outcome leaves) | `dark-focus` | `stack` · `compact` · `comfortable` |
| | hub & spoke | One center with direct satellites ("ハブ&スポーク", ecosystem, integrations ring) | `hub-spoke` (central hub + peripheral nodes + labeled spokes) | `dark-focus` | `stack` · `compact` · `comfortable` |
| | concentric / onion | Nested containment scopes ("同心円", "オニオン図", core → context layers) | `concentric` (labeled nested rings + core) | `forest` | `stack` · `compact` · `comfortable` |
| | force field | Driving vs restraining forces around a change ("フォースフィールド", "추진 요인 vs 저항 요인") | `force-field` (center goal bar + opposing arrow bars scaled by strength) | `slate` | `stack` · `compact` · `comfortable` |
| | roadmap | Coarse period × theme planning ("ロードマップ", "로드맵", quarterly plan - task-level dates → use gantt) | `roadmap` (period header + theme lanes + cat-tinted initiative bars spanning periods) | `slate` | `stack` · `compact` · `comfortable` |
| | process / value chain | A flat linear pipeline of stages ("プロセス", "工程", "밸류체인", stage arrows - branching → use flowchart) | `process-chevron` (chevron arrow band + captions) | `birchline` | `stack` · `compact` · `comfortable` |
| | layer stack | Named horizontal layers ("技術スタック", "레이어", OSI/tech stack - topology → use architecture) | `layer-stack` (full-width stacked layers + items + side label) | `dark-focus` | `stack` · `compact` · `comfortable` |
| | story map | Backbone user activities + release slices ("ストーリーマップ", "스토리맵", MVP scoping) | `story-map` (backbone row + story-card columns grouped by release) | `birchline` | `stack` · `compact` · `comfortable` |
| | capability map | Nested competence inventory ("ケイパビリティマップ", "역량 지도", business capabilities with heat) | `capability-map` (domain blocks + capability tiles + data-level tints) | `slate` | `stack` · `compact` · `comfortable` |
| | OKR | Objectives + measurable key results with progress ("OKR", "目標と成果指標", quarterly goals) | `okr-board` (objective cards + KR progress rows + status chips) | `slate` | `stack` · `compact` · `comfortable` |
| | business model | Business-model-on-one-page ("ビジネスモデルキャンバス", "비즈니스 모델 캔버스", BMC) | `business-model-canvas` (canonical 9-block grid) | `birchline` | `stack` · `compact` · `comfortable` |
| | gap analysis | Current vs target with explicit gaps + actions ("ギャップ分析", "현황과 목표", as-is/to-be) | `gap-analysis` (3 columns: 現状 / ギャップ+施策 / あるべき姿) | `birchline` | `stack` · `compact` · `comfortable` |
| | maturity model | Assessment levels you climb ("成熟度モデル", "성숙도", Lv1→Lv5, CMMI-style) | `maturity-ladder` (staircase steps + current-level highlight) | `slate` | `stack` · `compact` · `comfortable` |
| **chart** | bar / line / donut | Visualizing quantity, trend, composition | `chart-bar` / `chart-line` / `chart-donut` (series colors `--cat-1..5`) | `dark-focus` | `bento` (charts `span:6`) · `compact` · `comfortable` |
| | scatter / waterfall / treemap / spectrum | Correlation (XY / bubble), start→delta→total bridges, part-to-whole area tiles, positions on a 1-D scale | `chart-scatter` / `chart-waterfall` / `treemap` / `spectrum` | `dark-focus` | `bento` (`span:6`, treemap `span:12`) · `compact` · `comfortable` |
| | slope / dot-plot / waffle / boxplot / stacked-area / bump | Two-point comparisons, per-category range+gap, part-of-100 grids, distributions, stacked composition over time, rank trajectories | `slope-chart` / `dot-plot` / `waffle` / `boxplot` / `chart-stacked` (`areastacked`) / `bump-chart` | `dark-focus` | `bento` (`span:6`) · `compact` · `comfortable` |
| | histogram / combo / sparkline / pareto / gauge / bubble | Distribution bins, bar+line dual axis, inline metric rows, 80/20 cumulative, radial gauges, x/y+size | `histogram` / `chart-combo` / `sparkline` / `pareto` (`pareto`) / `gauge` / `chart-bubble` | `dark-focus` | `bento` (`span:6`, sparkline `span:4`) · `compact` · `comfortable` |
| | leaderboard / composition / diverging / cohort / tags / pictogram | Standings+movement, one-strip 100%, mirrored opposing series, retention staircase, weighted topics, icon-unit counts | `leaderboard` / `composition-bar` / `diverging-bar` / `cohort-grid` / `tag-cloud` / `pictogram` (all v6, hand-pasted, pure CSS) | `dark-focus` | `bento` (`span:6`, composition-bar `span:12`) · `compact` · `comfortable` |
| **dashboard** | dashboard / table | Metrics + a reorderable/filterable table | `kpi-grid` + `chart-*` + `data-table` (`[data-sortable]`+`[data-filter]`) | `dark-focus` | `bento` (kpi `variant:"hero"` or full-width, charts `span:6`, table `span:12`) · `compact` · `comfortable` (`compact` density for dense ops views) |
| **timeline** | timeline | Chronological events, roadmap, history | `timeline` (`.is-done`/`.is-active`/`.is-todo` states) | `birchline` | `stack` · `banner` · `comfortable` |
| **infographic** | poster / visual summary | A one-page visual summary for a broad (often non-expert) audience - numbers + icons + short flow at poster density ("인포그래픽", "한 장으로 요약", "インフォグラフィック", "1枚で伝わる", "visual summary") | `kpi-grid` (`variant:"hero"`) + `stat-trend`/`gauge`/`chart-donut` + `feature-grid` + `stepper` or `timeline` + `callout-box` | `sunset` | `bento` (hero `span:12`, blocks `span:4`–`6`) · `banner` · `spacious` |

Supplementary note for `infographic`: it is a *composition*, not a new module - big
hero numbers first, then at most 4–6 visual blocks, each with a one-line takeaway.
Prefer one message per block over completeness; long prose belongs in `report`.
`sunset`/`rose` give it a poster feel; `spacious` density is what separates it
visually from a `dashboard`. When writing a builder spec, translate module names to
section `type` names via `07-build-spec.md` §3a (`feature-grid`→`features`,
`callout-box`→`callout`, `stat-trend`→`stattrend`, …) - an unknown `type` stops the
build with a "did you mean" hint.

All diagrams are **inline SVG** (`timeline`, `decision-tree`, `force-field`, the five v5 planning diagrams `roadmap`/`process-chevron`/`layer-stack`/`story-map`/`capability-map`, and all four v6 planning diagrams `okr-board`/`business-model-canvas`/`gap-analysis`/`maturity-ladder` are pure CSS; among v4–v6 charts, `dot-plot`, `waffle`, `histogram`, and all six v6 data units are pure CSS too). Each SVG of `flow-diagram` / `arch-diagram` / `mindmap` / `erd` / `node-graph` carries `role="img"`+`aria-label` or `<title>`. `chart-*` pairs its CSS hover with a floating tooltip - `[data-chart-tip]` on the figure plus `data-tip` per bar/point/slice - wired by `interactions.js`.

### 2.4 Interactive / prototyping-family shapes (operable throwaway tools / mockups)

| shape | type variant | Trigger signal | Constituent module | Default theme | Recommended layout · header · density |
| --- | --- | --- | --- | --- | --- |
| **prototype** | mockup | A hi-fi image of a mobile screen | `mockup-frame` (CSS phone frame + tab bar, optionally `[data-tabs]`) | `interactive-warm` | `stack` · `compact` · `comfortable` |
| | wireframe | A lo-fi page skeleton (grayscale) | `wireframe-block` (dashed/sketch, no color, no lorem) | `interactive-warm` | `stack` · `compact` · `comfortable` |
| **app-flow** | screen flow (static) | The **whole app flow** as phone screens ("앱 전체 흐름", "화면 흐름", "유저 플로우", "画面遷移", "アプリの流れ", "user flow") - every screen's wireframe + transition conditions + per-screen explanation | `screen-flow` (N phone-framed lo-fi screens + labeled arrows + captions; builder section `screenflow`) + `callout-box` for reading notes | `birchline` | `stack` · `compact` (or `banner` for a presentation lead-in) · `comfortable` |
| | screen flow (editable) | Same, but the reader should rearrange/edit screens | `wireframe-block` (drag-editable pages + auto-routed arrows) | `interactive-warm` | `stack` · `compact` · `comfortable` |
| **editor** | feature-flag / triage / prompt tuner | A throwaway tool where you tweak values and see results immediately | `slider-control` (`[data-slider="--var"]`+`[data-out]`+`[data-copy-text]`) + `data-table` | `interactive-warm` | `stack` · `compact` · `comfortable` |
| **kanban** | kanban | A drag-and-drop triage board | `kanban-board` (`[data-kanban]`+`[data-col]`+`.kanban-card`, states `.dragging`/`.drop-target`) | `interactive-warm` | `stack` · `compact` · `comfortable` |

Supplementary notes:
- `prototype`'s `mockup` (hi-fi) and `wireframe` (lo-fi) are the same shape at different fidelities. Use `mockup-frame` to show the screen with colors applied, and `wireframe-block` to show structure only.
- `app-flow` vs `prototype`: prototype shows **one screen** (or tab-switched screens in one frame); app-flow shows **every screen at once** with the transitions between them. A "show me the whole flow / 전체 흐름" request is app-flow, not prototype. With `target=mobile-app` the phone chrome is mandatory - a generic-rectangle flowchart does not satisfy the request.
- `app-flow` default is the static `screen-flow` (deliverable to read/print); switch to `wireframe-block` only when the user wants to *edit* the flow.
- `editor` / `kanban` are essentially "throwaway editors." State is not saved, and all operations complete via the `interactions.js` data attributes.

### 2.5 module ⇆ behavior (Behaviors) mapping

Shapes that include interactivity must always be wired with data attributes that `interactions.js` recognizes (custom JS forbidden).

| Behavior | data attribute (markup contract) | Module used |
| --- | --- | --- |
| Dark theme toggle | `[data-theme-toggle]` (placed by default in the header of `base.template`) | Common to all shapes |
| Table reorder | `table[data-sortable]` | `data-table` |
| Row/card filtering | `[data-filter]` + `[data-filter-in]` | `data-table` (dashboard) |
| Kanban D&D | `[data-kanban]` + `[data-col]` + `.kanban-cards` + `.kanban-card` | `kanban-board` |
| Clipboard copy | `[data-copy]` / `[data-copy-text]` | `slider-control`, code-related |
| Slider → CSS variable | `[data-slider="--var"]` + `[data-out]` (+ `data-unit`) | `slider-control` |
| Tab switching | `[data-tabs]` + `.tab.active[data-tab=x]` + `[data-panel=x]` | `tabs`, `mockup-frame` |
| Expand/collapse (FAQ/details) | Native `<details><summary>` (no JS) | `collapsible` |

---

## 3. How to choose the default theme

There are 10 themes. They are scoped to `[data-theme="…"]` within `themes.css` and switched via `<html data-theme="…">`. Each theme swaps the semantic aliases (`--bg-*`/`--text-*`/`--border-*`/`--accent`/`--on-accent`) and shadows, **plus a structural personality** - its own `--radius-*` and letter-spacing overrides across three silhouettes: warm-editorial (`birchline`/`rose`/`forest`/`minimal`), bold-sans (`sunset`/`nord`/`interactive-warm`), and technical-compact (`slate`/`midnight`/`dark-focus`). Spacing and page width are never theme-owned: the `--sp-*` scale lives in `tokens.css` and is rescaled only by the `density` axis (`data-density`), while `--container-max` stays layout/artifact-owned so theme switches do not resize the page. The personality table and density tokens are owned by `03-themes-and-palettes.md`.

The first 4 rows are the shipped per-shape defaults (matching the shape tables in §2.2–2.4); the remaining 6 are opt-in alternatives. Palette details and WCAG contrast values are owned by `03-themes-and-palettes.md` - this table only maps each theme's character to the shapes it suits.

| theme | Character | Suited shapes |
| --- | --- | --- |
| **birchline** (default) | Warm stone paper, terracotta accent | report, spec, comparison, decision, app-flow, code-review, timeline |
| **dark-focus** | Deep carbon-slate dark, sky-blue accent | diagram, chart, dashboard |
| **interactive-warm** | Neutral white base, cobalt accent | prototype, editor, kanban |
| **minimal** | High-contrast monochrome, tight radii | essay / long-form |
| **midnight** | Dark violet base, soft purple glow | diagram, dashboard (dark alternative to `dark-focus`) |
| **slate** | Light blue-gray, corporate/professional | report, spec, dashboard (light, data-heavy documents) |
| **forest** | Light green-earth, calm natural tone | report, timeline (status/progress-heavy content) |
| **rose** | Light warm magenta, editorial feel | prototype, comparison, infographic (marketing/editorial flavor) |
| **nord** | Dark arctic blue-gray (Nord palette) | code-review, diagram (cooler dark alternative) |
| **sunset** | Dark warm amber | chart, dashboard, infographic (warm dark alternative; infographic default) |

Switching guidance:
- The "default theme" above is just the initial value. `[data-theme-toggle]` can, at runtime, toggle between `dark-focus` and the original theme from any theme (included by default in the header of `base.template.html`).
- If you need a custom accent, just add `style="--accent:#HEX;--on-accent:#fff"` to `<html>` (do not scatter raw hex through the body).
- Because `--cat-1..--cat-5` are derived from `--accent` and the status colors, changing the theme makes the chart series colors follow automatically.

---

## 4. Quick decision flow

1. **Is this output for the agent or for a human?** → If for the agent, finish with Markdown.
2. If for a human, **does it meet even one of the escalation signals in 1.2?** → If not, Markdown.
3. If it does, HTML. **Determine the target surface** (`00-target-surface.md`): mobile-app → `viewport=phone`, device frame required; Korean/Japanese prompt phrases are first-class detection signals.
4. Choose the shape by **what you want to convey**:
   - Summarize in prose → §2.2 (report / spec / comparison / code-review / essay)
   - **Help the reader decide between options** → §2.2 `decision` (`decision-matrix`: weights + score bars + per-cell rationale + verdict)
   - Show space / structure → §2.3 (diagram / chart / dashboard / timeline)
   - **One-page visual summary for a broad audience (numbers + icons, poster density)** → §2.3 `infographic` (`kpi-grid` hero + a few visual blocks, `bento` · `banner` · `spacious`)
   - **Show the whole app flow as screens** → §2.4 `app-flow` (`screen-flow`: phone-framed wireframes + transition arrows + captions)
   - Let the user operate it / show a mockup → §2.4 (prototype / editor / kanban)
5. Choose the **page axes explicitly** - theme + layout + header + density - from the shape row's "Recommended layout · header · density" column (§2.2–2.4). Don't let them default silently; if a spec omits an axis the builder derives it from the section mix and logs the choice (`07-build-spec.md` §1.1). Choose from the current requirements and evidence; do not rotate the combination based on delivery history.
6. Assemble the shape table's **constituent modules** into `{{CONTENT}}` of `base.template.html`, put the theme in `{{THEME}}`, and the layout/density in `{{LAYOUT}}` / `{{DENSITY}}`.
7. If there is interactivity, wire it with **data attributes only** per §2.5. Colors are semantic tokens only per §1.4. Diagrams are inline SVG + a11y attributes.
