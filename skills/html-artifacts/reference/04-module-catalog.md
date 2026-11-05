# 04 - Module Catalog

> **Canonical source.** This document is the canonical catalog of **all 117 modules** in `templates/modules/` (23 original + 16 added in v2 + 17 added in v3 + 18 added in v4 + 18 added in v5 + 18 added in v6 + 7 added in v7 - see §"v2 modules" / §"v3 modules" / §"v4 modules" / §"v5 modules" / §"v6 modules"). The complete module list, family grouping, and each module's contract (PURPOSE / VARIABLES / CSS classes / tokens / INTERACTION / lineage) are maintained here only; other references cite this file instead of duplicating module lists or counts.
>
> **Discovery (search, don't read everything):** `node tools/index.mjs --find "<keywords>"` ranks modules by tag/keyword/intent(EN·KO·JA)/use-when; `node tools/index.mjs --details <id>` prints the chosen module's contract. Fallback layers: `index/INDEX.md` (~9KB summary) → `index/COMPONENTS.md` (full prose) → this file (full CSS/markup). All generated from `index/components.json` (the single source of truth) by `tools/index.mjs`.

Reference for all **117 modules** contained in `templates/modules/`. Each module is a self-contained (dependency-free) snippet following "one feature = one file," used by pasting it into the `{{CONTENT}}` slot of `base.template.html`. There are no CDNs, external libraries, or build steps whatsoever - it opens directly in an offline browser.

This catalog covers **Layer 2 (Modules)** of the 5-layer architecture. Each module depends on the Foundation / Primitives below it, and interactive ones connect to Layer 3's `interactions.js` (global `HA.*`) via data attributes.

```
Foundation (reset / tokens / themes)
  -> Primitives (elements.css)
    -> Modules (modules/*)          <- this document
      -> Behaviors (interactions.js)
        -> Shapes (base.template + compositions)
```

---

## How to Read This (conventions shared by every module)

Every module file begins with a header comment in the same format.

| Header item | Meaning |
|---|---|
| `MODULE:` | Module name (= the file name with `.html` removed) |
| `lineage:` | The originating source-skill (the lineage of the 5 skills) |
| `PURPOSE:` | What it renders / provides |
| `VARIABLES:` | `{{...}}` placeholders (substituted at use time) |
| `REQUIRES:` | The core files it depends on (tokens / elements / interactions) |
| `MODULE CSS:` | Whether there is a `<style data-module="...">` block to inline exactly once |
| `INTERACTION:` | The behavior hook it connects to (`none` if there is none) |
| `USAGE:` | The repeating unit and how to paste it |

**The CSS convention**: module-specific CSS is always wrapped in `<style data-module="module-name">`, and even when the same module is used multiple times, **this block is inlined only once**. Colors must always reference a semantic token (`--accent`, `--cat-1..5`, `--text-*`, `--border-*`, `--bg-*`, `--color-*`); raw hex is never used.

**The SVG convention**: diagrams and charts are all inline SVG (not ASCII art). Each must have either `role="img"` + `aria-label` or a `<title>`.

---

## Summary by Family

| Family | Modules | Interactive |
|---|---|---|
| **charts** (35) | `kpi-grid`, `stat-trend`, `chart-bar`, `chart-line`, `chart-donut`, `chart-stacked`, `gauge`, `radar`, `funnel`, `progress`, `chart-bullet`, `heatmap`, `cal-heatmap`, `chart-scatter`, `chart-waterfall`, `treemap`, `spectrum`, `slope-chart`, `dot-plot`, `waffle`, `boxplot`, `chart-area`, `bump-chart`, `histogram`, `chart-combo`, `sparkline`, `pareto`, `progress-ring`, `chart-bubble`, `leaderboard`, `composition-bar`, `diverging-bar`, `cohort-grid`, `tag-cloud`, `pictogram` | `chart-bar`/`-line`/`-donut`/`chart-stacked` (bars) + v3 `chart-scatter`/`chart-waterfall` carry `[data-chart-tip]` + per-shape `data-tip` (`HA.tooltip`). `kpi-grid`/`stat-trend` count up via `[data-counter]` (`HA.counter`). `gauge`/`radar`/`funnel`/`progress`/`chart-bullet`/`heatmap`/`cal-heatmap`/`treemap`/`spectrum` and all v4/v5/v6 charts (`slope-chart`…`bump-chart`, `histogram`…`chart-bubble`, `leaderboard`…`pictogram`) are static |
| **diagrams** (37) | `arch-explorer`, `pipeline-flow`, `request-trace`, `deployment-topology`, `flow-diagram`, `arch-diagram`, `erd`, `node-graph`, `mindmap`, `timeline`, `stepper`, `wireframe-block`, `mockup-frame`, `screen-flow`, `sequence-diagram`, `state-diagram`, `swimlane`, `gantt`, `cycle-loop`, `org-chart`, `kpi-tree`, `journey-map`, `fishbone`, `sankey`, `decision-tree`, `hub-spoke`, `concentric`, `force-field`, `roadmap`, `process-chevron`, `layer-stack`, `story-map`, `capability-map`, `okr-board`, `business-model-canvas`, `gap-analysis`, `maturity-ladder` | `timeline`, `pipeline-flow`, `request-trace`, `deployment-topology` are static. `arch-explorer` uses `HA.archExplorer` + `HA.zoompan`. `flow-diagram` has draggable nodes via `dragNode`; `mindmap`/`arch-diagram`/`erd`/`node-graph` use `dragNode`+`zoompan` (`node-graph` adds `crossfilter`). `mockup-frame` swaps screens via `tabs`. `wireframe-block` is static by default with opt-in `reorder`/`wfedit`/`wfflow`/`designpick`. `stepper` is static with optional `reveal`. `screen-flow` and all v3/v4/v5/v6 diagrams are static (with automatic SVG text fitting via `HA.fitSvgText`) |
| **interactive** (7) | `data-table`, `tabs`, `collapsible`, `tree`, `slider-control`, `kanban-board`, `form-fields` | `interactions.js` or native `<details>`. `tree` collapses subtrees via `HA.tree`. `form-fields` is a themed prototype form whose submit is wired by `HA.formMock` (`[data-form-mock]`) |
| **document** (30) | `service-catalog`, `event-catalog`, `failure-modes`, `callout-box`, `comparison-grid`, `decision-matrix`, `diff-block`, `stat-list`, `activity-feed`, `empty-state`, `checklist`, `quadrant`, `pyramid`, `venn`, `before-after`, `risk-matrix`, `swot`, `pros-cons`, `rating-scale`, `glossary`, `raci-matrix`, `toc`, `code-snippet`, `agenda`, `project-status`, `calendar-month`, `changelog`, `key-takeaways`, `file-tree`, `api-endpoint` | Static reading blocks (`activity-feed` accepts optional `[data-reveal]`). `checklist` carries real native checkbox/radio/switch controls (no JS - native toggling). v3/v4/v5/v6/v7 blocks are static |
| **content** (8) | `feature-grid`, `persona-card`, `quote-block`, `faq`, `pricing-table`, `hero-cta`, `team-grid`, `logo-wall` | None (static) |

> `wireframe-block` is static by default, but it becomes an **opt-in** module that supports reorder via `HA.reorder` with `[data-reorder]` (page/region insertion, card swapping, element insertion), an **element editor** via `HA.wfedit` with `[data-wf-palette]`/`[data-wf-board]` (16 types, click-to-add/drag-to-place, delete, label editing), and a **screen flow** via `HA.wfflow` with `[data-wf-flow]` (multiple pages + automatic arrow linking, page add/delete). Without these attributes it stays static as before.

## Module variants (builder spec keys)

Five modules expose **variants** selectable per section in the build spec (`07-build-spec.md` §1–3). Variants only change geometry/markup - colors stay semantic-token-only, and the default value of every variant is the historic rendering, so old specs are unaffected.

| section type | spec key | values | effect |
|---|---|---|---|
| `kpi` | `variant` | `"cards"` (default) / `"inline"` / `"hero"` | card grid / one bordered `.kpi-strip` of `.metric-inline` cells / first metric featured large in `.kpi-hero` |
| `chart` (bar/line) | `size` | `"sm"` / `"md"` (default) / `"lg"` | plot heights 160 / 240 / 330 px (donut has no size variants) |
| `table` | `density` | `"compact"` | adds `dt-compact` to the `<table>` - tighter padding, 13px cells |
| `comparison` | - (automatic) | - | columns auto-fit the option count via `--cmp-cols` = min(options, 4) |
| `decision` | `variant` | `"detailed"` (default) / `"compact"` | compact omits `.dm-note` paragraphs; the rationale moves into a `title="…"` tooltip on each `td.dm-cell` |

Per-module details live under each module's **BUILDER VARIANTS** entry below.

> The interactive connection point `interactions.js` (global `HA`) auto-starts on `DOMContentLoaded` and wires `themeToggle / sortable / filter / kanban / copy / slider / tabs / zoompan / fitSvgText / dragNode / tree / crossfilter / paginate / tooltip / counter / reveal / reorder / wfedit / wfflow / designpick / formMock / archExplorer / tocSpy` via data attributes. Each behavior is isolated with `try/catch` and is a no-op if its target attribute is absent (`reorder` injects nothing without `[data-reorder]`, `wfedit` without `[data-wf-palette]`/`[data-wf-board]`, `wfflow` without `[data-wf-flow]`, and `designpick` without `[data-theme-pick]`/`[data-wf-skin-pick]`). `wfedit`/`wfflow` reuse `reorder`'s `wireItem`/`flip`/`roveTo`/`hitBefore` and wire added elements, pages, and **nested containers** through the same code path. `reorder`'s drag is document-driven so it does not float away even if capture is lost, and `data-reorder-cross` boards can **move an element across to another page or another column**. Only `collapsible` uses native `<details>` and needs no JS.

---

# charts Family

Quantitative representation of data, no external library. Bar / line / stacked charts use the **HTML-hybrid `.hc` frame** (HTML text, %-positioned bars, stretched SVG lines) so labels never shrink below readable size; donut, radar and the v3+ charts are inline SVG. Every `chart-*` figure carries `[data-chart-tip]` with a `data-tip` per bar / point / slice, so `HA.tooltip` (interactions.js) shows a floating hover tooltip; CSS-only hover styling sits on top of that. `kpi-grid` animates its values with `[data-counter]` (`HA.counter`).

## `chart-bar.html`

- **PURPOSE**: Bar chart on the **HTML-hybrid plot frame** (`.hc`): bars are `div`s sized in % of a fixed-height plot; ticks, values and category labels are HTML text, so they stay legible at any card width (the former 720-unit SVG printed 8px labels in a half-width card and 4px labels on a phone).
- **VARIABLES**: `{{TITLE}}` · per tick `{{TICK_PCT}}` `{{TICK_LABEL}}` · per bar `{{BOTTOM_PCT}}` `{{HEIGHT_PCT}}` `{{VALUE}}` `{{LABEL}}` · `{{YW}}` (y-label column width, px).
  - **SCALING**: pick a "nice" top T ≥ max (max 92 → T 100, ticks 0/25/50/75/100); `HEIGHT_PCT = value / T × 100`, `BOTTOM_PCT = 0`; `TICK_PCT = tick / T × 100`.
- **CSS classes** (shared frame in `elements.css`): `.hc`, `.hc-body`, `.hc-y`, `.hc-plot`, `.hc-grid`, `.hc-x`, `.hc-bars`, `.hc-slot`, `.hc-bar` (+`.hc-neg` / `.hc-hl` highlight), `.hc-val`, `.hc-target`, `.cat-1..5`. primitive: `.card-outlined`, `.chart-title`.
- **token**: `--cat-*`, `--accent`, `--text-*`, `--border-subtle`.
- **INTERACTION**: `[data-chart-tip]` on the `<figure>` + `data-tip` on each `.hc-bar` → `HA.tooltip`. `.hc-body` carries `role="img"` + an aria-label listing every value. With `filter: true` the builder adds chips (`[data-filter-key]`) and `data-series` per bar → `HA.crossfilter`.
- **BUILDER** (`chart`, variant `bar`): nice ticks with the unit inferred from `display` (or `yPrefix` / `ySuffix`), negative values around a zero line, `highlight`, `target` goal line, values printed up to 14 bars, x labels thinned on narrow cards above 6 bars, `size` = plot height `sm` 160 / `md` 240 / `lg` 330 px.
- **lineage**: `html-visual` (chart/dashboard).


## `chart-line.html`

- **PURPOSE**: Line chart on the same HTML-hybrid frame: the line (and, for one series on a zero-based axis, a soft area) is a `preserveAspectRatio="none"` SVG in 0–100 coordinates with a non-scaling stroke; dots, values, ticks and x labels are HTML.
- **VARIABLES**: `{{TITLE}}` · ticks as in chart-bar · `{{POINTS}}` (`"x,y …"` in 0–100 space, `x = (i + 0.5) / N × 100`, `y = 100 − pct`) · `{{AREA}}` (`M x0,100 L … L xn,100 Z`) · per point `{{X_PCT}}` `{{Y_PCT}}` `{{VALUE}}` `{{LABEL}}`.
  - **SCALING**: the y domain need not start at 0 for a line - but then draw no area (a fill measures from zero and would exaggerate the change).
- **CSS classes**: the `.hc` frame + `.hc-lines`, `.hc-svg`, `.hc-line`, `.hc-area`, `.hc-dot`, `.hc-pt`, `.hc-legend`.
- **INTERACTION**: `[data-chart-tip]` + `data-tip` per `.hc-dot` → `HA.tooltip`; dots grow on hover.
- **BUILDER** (`chart`, variant `line`): one series from `points[]`, or several from `labels[]` + `series[{label, values[], cat?}]` (legend + end labels); automatic zero / non-zero domain (`zero`, `yMin`, `yMax` override), `target`, `size` as chart-bar.
- **lineage**: `html-visual` (chart/dashboard).


## `chart-donut.html`

- **PURPOSE**: SVG donut: stacked `<circle>` rings drawn with `stroke-dasharray`, a centre total, and a legend (label + optional value + %). Ring and legend sit side by side, stacked in a card narrower than 420px.
- **VARIABLES**: `{{TOTAL}}` (and `{{TITLE}}`) + per segment `{{DASH}}` `{{OFFSET}}` `{{CAT}}` `{{LABEL}}` `{{PCT}}`.
  - **DASHARRAY MATH**: `r=80` → `C = 502.65`; `seg = pct/100 · C`, `{{DASH}} = "seg (C−seg)"`; `offset[0]=0`, `offset[i] = offset[i-1] − seg[i-1]`; the `<g>` is rotated −90°.
- **CSS classes**: `.donut`, `.donut-body`, `.track`, `.seg`(+`.cat-1..5`), `.total`, `.total-label`, `.donut-title`, `.donut-legend`, `.legend-row`, `.dot`, `.legend-val`, `.legend-pct`. The ring is drawn ≤ 280px wide so its SVG text stays ≥ 10px.
- **INTERACTION**: `[data-chart-tip]` + `data-tip` per `.seg` → `HA.tooltip`. With `filter: true` the legend rows become `[data-filter-key]` toggles → `HA.crossfilter`.
- **BUILDER** (`chart`, variant `donut`): percentages from the value sum; the centre total shrinks to fit the hole and its caption is sized to the hole; no `size` variants.
- **lineage**: `html-visual` (chart/dashboard).


## `kpi-grid.html`

- **PURPOSE**: A row of headline metrics (KPI cards) with value, label, delta and an optional note.
- **VARIABLES**: per card `{{VALUE}}` (display string, also the fallback text) `{{VALUE_NUMBER}}` (bare number for the count-up) `{{LABEL}}` `{{DELTA}}` + optional `{{VALUE_PREFIX}}` / `{{VALUE_SUFFIX}}` + delta classes.
- **CSS classes**: **No module CSS (pure primitives in `elements.css`)**. `.kpi-sec` (container) > `.grid.kpi-cards` (`--kpi-cols` / `--kpi-cols-md`), `.card-outlined`, `.metric`, `.metric-label`, `.metric-value`, `.metric-note`, delta `.metric-delta-{up|down|flat}` (arrow) + `.metric-delta-{good|bad|neutral}` (colour).
- **Delta meaning**: the arrow states direction, the colour states meaning - a falling churn is `metric-delta-down metric-delta-good` (green ▼). Never let "down" mean "bad" by default for lower-is-better metrics.
- **Columns**: balanced, never an orphan - 5 cards → 5 across, 6 → 3 + 3, 7–8 → 4 + 4 (`--kpi-cols`), fewer as the container narrows (860 / 520 / 340px container queries).
- **INTERACTION**: count-up - `.metric-value[data-counter][data-to]` (+ `data-prefix` / `data-suffix`) → `HA.counter`.
- **BUILDER VARIANTS** (`kpi` section key `variant`): `"cards"` (default), `"inline"` (one bordered `.kpi-strip` of `.metric-inline` cells), `"hero"` (first item large in `.kpi-hero`, the rest stacked beside it). Item keys: `label`, `value`, `valueNum`, `prefix`, `suffix`, `delta`, `dir`, `tone`, `note`.
- **lineage**: `html-visual` (dashboard) + `html-artifacts` (report).

---

# diagrams Family

Visualization of structure, relationships, and processes. 5 SVG-based (`flow-diagram`, `arch-diagram`, `erd`, `node-graph`, `mindmap`) + 5 CSS-based (`timeline`, `stepper`, `wireframe-block`, `mockup-frame`, `screen-flow`). `timeline` is static (INTERACTION = none); `flow-diagram` has draggable nodes via `dragNode`; `mindmap` / `arch-diagram` / `erd` / `node-graph` are draggable + zoom/pannable via `dragNode` + `zoompan` (`node-graph` adds `crossfilter`); `mockup-frame` swaps screens via `tabs`; `wireframe-block` is static by default with opt-in behaviors; `stepper` is static with optional `reveal`.

## `flow-diagram.html`

- **PURPOSE**: Self-contained SVG flowchart (no Mermaid/D3). Shapes: Start/End = ellipse, Process = rounded rectangle, Decision = diamond. Orthogonal connectors + shared arrowhead marker + Yes/No labels.
- **VARIABLES**: per node `{{LABEL}}` `{{X}}` `{{Y}}` (X,Y are the box top-left. node W=160 H=64 -> center = X+80,Y+32. Diamond is W=176 H=88). Per edge `{{FROM}}` `{{TO}}` node ids + optional `{{EDGE_LABEL}}` (Yes/No). `{{TITLE}}`.
  - **GEOMETRY**: Each node is a `<g data-node="ID" transform="translate(X,Y)">` with its shapes local to that origin. Edges are `<line data-edge data-from data-to>` - `interactions.js` re-routes them to the live node borders on load and on every drag, so no manual waypoints are needed (in-file coords are just initial hints). Arrowheads use `marker-end="url(#flow-arrow)"`.
- **CSS classes**: `.flow`, `.node-start`, `.node-proc`, `.node-dec`, `.node-shape`, `.node-label`, `.edge`, `.edge-arrow`, `.edge-label`, `.flow-title`, `.flow-reset`. primitive: `.card-outlined`, `.btn`, `.btn-ghost`, `.btn-sm`, `.no-print`.
- **token**: `--bg-card`, `--accent`, `--color-warning`, `--border-default`, `--text-*`, `--radius-md`.
- **INTERACTION**: **Drag** - `svg[data-draggable]` -> `HA.dragNode`: drag any `g[data-node]` (mouse + keyboard arrows, nodes are focusable); edges `line[data-edge][data-from][data-to]` re-route to the node borders; `text[data-edge-label="FROM-TO"]` Yes/No labels follow the edge midpoint; `[data-drag-reset]` restores the layout. `role="img"` + `<title>`.
- **lineage**: `html-visual` (diagram) + `html-flowchart-anthropic`.

## `arch-diagram.html`

- **PURPOSE**: Self-contained SVG layered architecture diagram (no external libs). Horizontal zones (Frontend / Backend / Data / External) are semi-transparent, dashed grouping rects (static background); service nodes = rounded rects **you can drag**; connectors auto-track the nodes and carry a protocol label + arrow marker. Theme-tinted.
- **VARIABLES**: `{{TITLE}}`, per zone `{{ZONE}}` `{{ZX}}` `{{ZY}}` `{{ZW}}` `{{ZH}}` (+ `.z-1..z-4`), per node `{{ID}}` `{{SERVICE}}` `{{X}}` `{{Y}}` (node 150x52; `{{X}},{{Y}}` = `<g>` translate), per edge `{{FROM}}` `{{TO}}` `{{PROTO}}` (`data-from`/`data-to` must match node ids; endpoints are auto-routed). viewBox `0 0 760 460`.
  - **PROTOCOLS**: `HTTP` -> solid + `#arrow-http`, `gRPC` -> solid + `#arrow-grpc`, `pub-sub` -> dashed (`stroke-dasharray "7 5"`) + `#arrow-pubsub`.
- **CSS classes**: `.arch`, `.arch-title`, `.stage`(+`.panning`), `.zoom-controls`, `.zoom-readout`, `.zone`(+`.z-1..z-4`), `.zone-label`, `.node`(+`.n-1..n-4`), `.node-box`, `.node-label`, `.edge-line`, `.edge-async`, `.proto-label`. primitive: `.card-outlined`, `.btn`, `.btn-ghost`, `.btn-sm`, `.no-print`.
- **token**: `--accent`, `--cat-*`, `--text-*`, `--border-*`, `--bg-*`.
- **INTERACTION**: **Drag** - `svg[data-draggable]` -> `HA.dragNode`: drag any `g[data-node]` (mouse + keyboard arrows); connectors `line[data-edge][data-from][data-to]` re-route to the node-box borders; edge labels `text[data-edge-label="FROM-TO"]` follow the midpoint; `[data-drag-reset]` restores the layout (zones do **not** move). **Zoom** - `.stage[data-zoompan]` (wheel / `+`,`−`,`0` / buttons) -> `HA.zoompan`; panning skips `[data-node]`. Edges are drawn before nodes so connectors sit behind the boxes. `role="img"` + `aria-label`.
- **lineage**: `html-visual` (diagram/architecture) + `demo2` (interactive).

## `erd.html`

- **PURPOSE**: Entity relationship diagram. Each entity is a card (a header bar on an accent tint + column rows with types and PK/FK `.chip`) rendered inside a **draggable SVG node** (`<foreignObject>`). Relationship connectors (1:1 / 1:N / N:M) auto-track the node centres and carry a cardinality label + legend. No external libs.
- **VARIABLES**: per entity `{{ID}}` `{{NAME}}` + per column row `{{COL}}` `{{TYPE}}` `{{KEY}}` + per relation `{{FROM}}` `{{TO}}` `{{CARD}}` (`1:1`/`1:N`/`N:M`). Node placement `{{X}}` `{{Y}}` = the SVG translate of each entity group; `{{ID}}` is the stable node id used by `data-node` / `data-from` / `data-to`. viewBox `0 0 720 360`.
  - **SIZING**: set each `<foreignObject>` (and its `<rect class="erd-hit">`) height ≈ `46 + rows×38`. `interactions.js` auto-fits the foreignObject to the card's real height at load (so rows never clip), then re-routes edges - but give a sane initial height so the pre-JS layout is close. Space entities ≥ 48px apart (both axes) and enlarge the viewBox so nothing overlaps; for 4+ tables use a viewBox like `0 0 800 520`.
- **CSS classes**: `.erd`, `.erd-stage`, `.erd-entity`, `.erd-head`, `.erd-rows`, `.erd-row`, `.erd-col`, `.erd-type`, `.chip.pk` / `.chip.fk`, `.erd-node`(+`.dragging`), `.erd-hit` (transparent drag handle), `.erd-link`(+`.nm` dashed), `.erd-link-label`, `.erd-legend`. primitive: `.card-outlined`, `.chip`, `.cluster`, `.stack`, `.badge*`, `.btn`, `.btn-ghost`, `.btn-sm`, `.no-print`.
- **token**: `--accent`, `--on-accent`, `--bg-*`, `--text-*`, `--border-*`, `--cat-*`, `--color-info`.
- **INTERACTION**: draggable nodes - `svg[data-draggable]` + `g[data-node]` -> `HA.dragNode`, with edges `line[data-edge][data-from][data-to]` auto-tracking node centres (+ `text[data-edge-label="FROM-TO"]` cardinality). Wrapped in `[data-zoompan]` `g[data-viewport]` for wheel-zoom + drag-pan -> `HA.zoompan`; focus a node + arrow keys to nudge; `[data-drag-reset]` restores the layout. Edges are drawn before nodes. `role="img"` + `aria-label` on the SVG.
- **lineage**: `html-visual` (diagram) + `html-artifacts` (spec).

## `node-graph.html`

- **PURPOSE**: General reusable **interactive** node–edge graph (no external libs). A zoom/pan stage wraps a draggable SVG: edges auto-track node centres, nodes are rounded rects tinted by group via `--cat-*`, a cross-filter legend dims nodes by group, and a reset button restores the layout. Pan + zoom the canvas, drag nodes (edges follow), filter by group.
- **VARIABLES**: per node `{{ID}}` `{{LABEL}}` `{{X}}` `{{Y}}` `{{GROUP}}` (`GROUP` = `g-1`|`g-2`|`g-3`) + per edge `{{FROM}}` `{{TO}}` `{{REL}}` (`FROM`/`TO` = node IDs) + `{{TITLE}}` (aria-label for the canvas).
  - **LAYOUT**: viewBox `0 0 1000 600`. `(X,Y)` = the `<g>` translate (its top-left corner). Node box is 160x60 -> centre = `(X+80, Y+30)` - that is where `interactions.js` routes edge endpoints automatically. Edges are drawn before nodes so connectors sit behind the boxes. Tint a node by giving its `<g>` a group class `.g-1|.g-2|.g-3` **and** the matching `data-series`.
- **CSS classes**: `.node-graph`, `.ng-edge`, `.ng-edge-label`, `.ng-node`(+`.dragging`), `.ng-box`, `.ng-label`, group tints `.g-1..g-3`, `.ng-legend`, `.ng-dot`. primitive: `.stage`, `.zoom-controls`, `.zoom-readout`, `.chip`, `.cluster`, `.btn`, `.btn-ghost`, `.btn-sm`, `[data-series].dimmed`, `.no-print`.
- **token**: `--cat-*`, `--accent`, `--bg-*`, `--text-*`, `--border-*`, `--font-*`, `--dur-fast`, `--ease`, `--sp-*`.
- **INTERACTION**: **Zoom/pan** - `.stage[data-zoompan]` (wheel-zoom, drag-pan) + `.zoom-controls` -> `HA.zoompan`. **Drag** - `svg[data-draggable]` -> `HA.dragNode`; each `g[data-node="ID"]` is draggable (mouse + keyboard arrows); `line[data-edge][data-from][data-to]` re-routes to node centres; `[data-drag-reset]` restores the layout. **Filter** - `[data-crossfilter]` legend chips `[data-filter-key="g-N"]` dim every node `g[data-series="g-N"]` that is not selected (multi-select) -> `HA.crossfilter`. Keep every control `.no-print`.
- **lineage**: `html-visual` (diagram/graph) + `demo2` (arch/erd interactive).

## `mindmap.html`

- **PURPOSE**: Self-contained radial mindmap. Branches spread out from the central root node via `<path data-edge>` connectors, each branch colored with `--cat-1..5`, and the ends are child nodes as rounded rects.
- **VARIABLES**: `{{ROOT}}` + per branch `{{BRANCH}}` + per child `{{CHILD}}`.
  - **LAYOUT**: viewBox `0 0 800 500`, root at `400,250`. Branch hubs are at the four corners (~210px from center), children further out. Each node is a `<g data-node transform="translate(X,Y)">` centered on its origin; connectors are `<path data-edge data-from data-to>` that `interactions.js` auto-routes to the node centres (no manual `d`).
- **CSS classes**: `.mindmap`, `.link`, `.node`, `.root`, `.root-label`, `.branch-label`, `.child-label`, branch palette `.b1..b5`, `.stage`, `.zoom-controls`, `.zoom-readout`. primitive: `.card-outlined`, `.btn`, `.btn-ghost`, `.btn-sm`, `.no-print`.
- **token**: `--cat-*`, `--accent`, `--on-accent`, `--text-*`, `--border-*`, `--bg-surface`, `--font-mono`.
- **INTERACTION**: **Zoom/pan** - `.stage[data-zoompan]` (wheel / `+`,`−`,`0` / buttons; `data-zoom-min="0.5"` `data-zoom-max="3"`) -> `HA.zoompan`. **Drag** - `svg[data-draggable]` + `g[data-node]` -> `HA.dragNode` (mouse + keyboard arrows, nodes focusable); `path[data-edge][data-from][data-to]` connectors re-route live; `[data-drag-reset]` restores the layout. `role="img"` + `aria-label` / `<title>`.
- **lineage**: `html-visual` (diagram/mindmap) + `mindmap-product` (demo2).

## `timeline.html`

- **PURPOSE**: Vertical timeline (**pure CSS, no SVG**). Status dots on a left rail (`::before` line), each event a `.card-outlined` with date + title + body.
- **VARIABLES**: per event `{{DATE}}` `{{TITLE}}` `{{BODY}}` + status dot class.
  - **STATUS**: `.is-done` (`--color-success`) / `.is-active` (`--accent`) / `.is-todo` (`--text-muted`). No class defaults to todo.
- **CSS classes**: `.timeline`, `.tl-event`(+`.is-done`/`.is-active`/`.is-todo`), `.tl-date`, `.tl-title`, `.tl-body`. primitive: `.stack`, `.card-outlined`, `.eyebrow`.
- **token**: `--color-success`, `--accent`, `--text-muted`, `--sp-*`, `--border-*`, `--radius-pill`, `--bg-surface`.
- **INTERACTION**: none (pure CSS).
- **lineage**: `html-visual` (diagram) + `html-artifacts` (report).

## `stepper.html`

- **PURPOSE**: Numbered **vertical stepper / timeline** (pure CSS - no SVG, no JS). Each step = a rounded number badge (colored by its level), a title + event pill, a one-line mechanism (with inline `<code>`), and a row of outcome "branch chips" (pass / block / advisory). Theme-aware: every color is a semantic token, so it follows `data-theme` + custom `--accent`. The badge is fully rounded and the spine is a thin rail.
- **VARIABLES**: `{{STEPPER_TITLE}}` `{{STEPPER_DESC}}` + per step `{{N}}` `{{STEP_TITLE}}` `{{EVENT_TAG}}` `{{MECHANISM_FN}}` `{{MECHANISM_DESC}}` + per branch `{{BRANCH_LABEL}}` `{{BRANCH_DESC}}`.
  - **LEVELS** (set on `.step` -> badge color): `.lvl-critical` = hard block / forced (`--color-danger`) / `.lvl-block` = exit / post block (`--color-warning`) / `.lvl-soft` = soft / advisory (`--accent`) / `.lvl-info` = context / info (`--color-info`) / `.lvl-neutral` = neutral / auto (`--text-muted`). Branch chips (set on `.br`): `.go` = pass (success), `.stop` = blocked (danger), `.warn` = advisory (warning).
- **CSS classes**: `.stepper`, `.step`(+`.lvl-critical`/`.lvl-block`/`.lvl-soft`/`.lvl-info`/`.lvl-neutral`), `.step .ev`, `.step .mech`, `.branchrow`, `.br`(+`.go`/`.stop`/`.warn`). One step = one `<div class="step lvl-LEVEL" data-n="N">`; `data-n` is the badge number (manual, sequential), and the spine line is drawn by `.step::after` and hidden on the last step automatically. primitive: `.stack`, `.lede`, `code`.
- **token**: `--color-danger`, `--color-warning`, `--color-info`, `--color-success`, `--accent`, `--text-*`, `--bg-*`, `--border-*`, `--sp-*`, `--radius-*`, `--font-mono`, `--type-*`.
- **INTERACTION**: static. Optional: add `[data-reveal]` (+ `[data-reveal-delay]`) to each `.step` for a staggered scroll-in; behavior from `interactions.js`.
- **lineage**: `staged-enforcement-stepper.template.html` (tokenised) - a standalone template, not one of the 5 source skills.

## `wireframe-block.html`

- **PURPOSE**: Low-fidelity (low-fi) hand-drawn **screen flow** wireframe. Multiple **pages** are laid out in dashed frames, and **adjacent pages are automatically linked with arrows**. **Grayscale only**, no lorem. Image boxes are SVG X-crosses, and text is gray bars. The default **sketch skin faithfully reproduces `demo2/html-visual/wireframe-dashboard.html`**: it layers a sketch font (`--wf-content-font`) + paper grain (the radial-gradient on `.wf-flow-track`) + line wobble from `feTurbulence`/`feDisplacementMap` (applying `#wf-roughpaper` as the `filter` on `.wf-page`, **drawing only**, leaving hit-testing and layout unchanged) over dashed, uneven borders + a slight rotation. The flat skins (clean/blueprint/mono) turn off these three for clean rendering.
- **CONTENT**: Structural placeholders only (insert labels, do not insert body copy). The demo writes literal page names (login/list/detail) and element labels inline, so `{{ }}` substitution is unnecessary (build-demo just slices the module).
- **CSS classes**: `.wf-sketch`, `.wf-label`, `.wf-imgbox`, `.wf-line`(+`.-w90`/`-w75`/`-w60`/`-w45`/`-head`). **16 primitives**: `.wf-btn`/`.wf-link`/`.wf-badge`/`.wf-input`/`.wf-textarea`/`.wf-select`(+`-label`/`-caret`)/`.wf-optrow`/`.wf-check`/`.wf-radio`/`.wf-toggle`/`.wf-opt-label`/`.wf-avatar`(+`-meta`)/`.wf-search`(+`-ic`/`-ph`)/`.wf-listrow`/`.wf-bullet`/`.wf-list-label`/`.wf-divider`. **reorder**: `.wf-handle`, `.is-grabbed`, `body.is-wf-dragging`, `.wf-placeholder`(+`.-slim`), `.is-swap-target`, `.just-dropped`, `.wf-controls`, `.wf-tool`(+`.is-copied`), `.wf-sink`, `.wf-hint`. **element-editor**: `.wf-palette`(+`.wf-pal-group`/`.wf-pal-sep`), `.wf-add-btn`, `.wf-card-body`(+`.wf-active`/`.wf-drop-hot`), `.wf-card-el`, `.wf-el-head`, `.wf-el-del`, `.wf-drag-ghost`. **flow**: `.wf-flow`, `.wf-flow-track`, `.wf-arrows`/`.wf-arrow`/`.wf-arrowhead`, `.wf-page`(+`-head`/`-title`/`-body`/`-del`), `.wf-dots`. primitive: `.btn`, `.small`, `.muted`.
- **data-***: reorder `data-reorder` `data-reorder-scope=pages|regions|cards|elements` `data-reorder-mode=insert|swap` `data-reorder-cross=<group>`(cross-board move) `data-reorder-item` `data-rid` `data-reorder-handle` `data-reorder-reset|-export|-sink|-live` / **editor** `data-wf-palette` `data-wf-add=<type>`(16 primitives + `cols2|cols3|card` containers + composite `dashboard`. All support click/drag placement) `data-wf-board` `data-wf-el` `data-el-type` `data-wf-target-readout` `data-wf-editable` / **flow** `data-wf-flow` `data-wf-flow-track` `data-wf-page` `data-wf-add-page` `data-wf-page-template`(19 types: blank/login/signup/dashboard/analytics/form/detail/settings/profile/pricing/checkout/table/chat/feed/kanban/onboarding/search/empty/error) `data-wf-del-page` `data-wf-width`(template width tier md/lg/xl. Complex layouts make the page stretch horizontally) `data-rest-rot` / **design** `data-theme-pick` `data-wf-skin-pick` (→ `data-wf-skin` `data-wf-flat`).
- **Additional CSS (container/skin)**: `.wf-cols`/`.wf-subboard`/`.wf-panel`/`.wf-panel-title`(nested layout), `.wf-pick`/`.wf-pick-label`/`.wf-select-ctl`(design selection), `[data-wf-skin=clean|blueprint|mono]`/`[data-wf-flat]`(skin), `.wf-page[data-wf-width=md|lg|xl]`(=420/560/700px. width per template complexity). **sketch hand-drawn**: `--wf-content-font`(sketch font for in-page content), the paper-grain radial-gradient on `.wf-flow-track`, `svg.wf-filter-defs > filter#wf-roughpaper`(=`feTurbulence`+`feDisplacementMap`) applied to `.wf-page{filter}`. Cancellation: `.wf-flow[data-wf-flat]{--wf-content-font:mono}` / `[data-wf-flat] .wf-page{filter:none}` / `[data-wf-flat] .wf-flow-track{background-image:none}`, while editing `.wf-page:has([data-wf-editable]:focus){filter:none}`, and reduced-motion `.wf-page{filter:none}`.
- **token**: `--text-muted`, `--border-default`, `--border-subtle`, `--bg-muted`, `--bg-surface`, `--sp-*`, `--radius-*`, `--font-*`. interactive additions: `--accent`(only the transient display of focus/active/swap/drop/hot), `--color-success`(copy confirmation), `--shadow-lg`, `--ease`, `--dur-fast`/`--dur-mid`. `prefers-reduced-motion` disables rotation, FLIP, and drop effects (matching `restRot()=0`).
- **INTERACTION**: opt-in `HA.reorder` + `HA.wfedit`(**element editor**) + `HA.wfflow`(**screen flow**) + `HA.designpick`(**design switching**).
  - **PAGES + ARROWS + TEMPLATE** - Lay out `[data-wf-page]` within the `[data-wf-flow-track]`(=`[data-reorder][data-reorder-scope=pages][data-reorder-mode=insert]`) inside `[data-wf-flow]`, and `HA.wfflow` draws SVG arrows between adjacent pages and re-routes them via rAF dirty-check. `[data-wf-add-page]` **generates a complex screen** from a `[data-wf-page-template]`(19 declarative templates: login/signup/dashboard/analytics/form/settings/profile/pricing/checkout/data list/chat/feed/kanban/…), and a ✕ per page deletes it (the last one cannot be deleted).
  - **MOVE (cross-board)** - Reorder pages (insert), elements (insert), and cards (swap) by drag/keyboard. **Drag is document-driven** (independent of `setPointerCapture`) so the item does not float. `data-reorder-cross="el"` boards can **move an element across to another page or another column** (re-roving both the destination and source boards).
  - **ADD (16 primitives + containers + composite)** - `[data-wf-add=type]` can be **added to the active board by clicking** or **placed at any position on any board by dragging** (containers and composite elements can be drag-placed too). `cols2`/`cols3`/`card` enclose a **nested drop board**, and `dashboard` is a **composite block** with 3 columns of KPIs (each column pre-populated with heading+text). `add()` wires the internal board + pre-placed child elements via `HA.reorder(el)` → building complex 2D layouts. For heading-type labels, `headLabel(type)` returns an appropriate name for containers/composites ("2 Columns", "Dashboard", etc.) and uppercase English for primitives. Element DOM is created via `createElement` (no innerHTML).
  - **DESIGN** - `[data-theme-pick]` switches the overall theme (10 types) and `[data-wf-skin-pick]` switches the skin (sketch/clean/blueprint/mono) at runtime. The default sketch reproduces the hand-drawn expression of the demo2 reference (font/paper grain/`feTurbulence` wobble, drawing only so D&D calculations are unchanged), and the flat skins turn all of it off for a clean look.
  - **DELETE** - Delete the focused `[data-wf-el]` with ✕ or Delete/Backspace. Focus moves next→prev→board.
  - **LABEL EDIT** - `[data-wf-editable]`(button names/options/page names) becomes `contenteditable`; click to edit, confirm with Enter/Esc (`textContent` only = paste is plain-texted). It does not steal reorder/drag keys or pointers.
  - **State is a single instance** - The `el-N` running counter and the active board are shared on `HA.wfedit`, preventing rid collisions, misplaced add targets, and additions to a detached board after deletion even across re-`HA.init()`.
  - `[data-reorder-reset]` is a **factory reset** (discards runtime-added elements, pages, and containers via `_seed`. Elements moved across boards return to their respective seed boards). The JSON from `[data-reorder-export]` includes `scopes`(pages) + **`pages`(each page's title + nested element tree. Containers recurse as `cols:[[…]]`)** + **`flow`(arrow links)**. Without the attributes it is static.
- **lineage**: `html-visual` (wireframe) + `demo2/wireframe-dashboard.html`.

## `mockup-frame.html`

- **PURPOSE**: High-fidelity (hi-fi) mobile device mockup. A pure-CSS phone frame (~320px, 40px radius, thick bezel via border + box-shadow) with a notch, status bar, app header, scrollable `.card` row list, and bottom tab bar, plus a **live screen switcher** (`.mock-switcher` tab bar above the phone) that swaps the phone's screen. Multi-screen, no images or libraries, theme-aware.
- **VARIABLES**: per screen `{{SCREEN_ID}}` `{{SCREEN_LABEL}}` `{{APP_TITLE}}` (`{{SCREEN_ID}}` is the shared key linking `.tab[data-tab=ID]` ↔ `[data-panel=ID]`) + per row `{{ROW_INITIAL}}` `{{ROW_TITLE}}` `{{ROW_META}}` `{{ROW_TAG}}` + the tab bar's `{{TAB_LABEL}}` (repeated 4 times, the first being `.active`). The `.mock-list` block can be swapped for any primitive markup (CONTENT SLOT).
- **CSS classes**: `.mock-device`, `.mock-switcher` (+ its `.tab(.active)`), `.mock-phone`, `.mock-notch`, `.mock-status`, `.mock-icons`, `.mock-appbar`, `.mock-app-title`, `.mock-app-btn`, `.mock-screen`, `.mock-list`, `.mock-row`, `.mock-avatar`, `.mock-row-body`, `.mock-row-title`, `.mock-row-meta`, `.mock-tabbar`, `.mock-tab`(+`.active`). primitive: `.stack`, `.card`, `.badge*`, `.small`, `.muted`, `.hidden`, `.no-print`.
- **token**: `--bg-surface`, `--bg-page`, `--bg-muted`, `--text-primary`, `--accent`, `--on-accent`, `--border-default`, `--shadow-lg`, `--radius-*`.
- **INTERACTION**: screen switching - `[data-tabs]` wraps the device (`.mock-device`); the `.mock-switcher`'s `.tab(.active)[data-tab=ID][role=tab]` buttons swap the `[data-panel=ID]` screens inside the phone -> `HA.tabs` toggles `.active` / `.hidden` + `aria-selected` (keep exactly one `.tab.active` + one visible screen; `.hidden` on every other screen).
- **lineage**: `html-visual` (mockup) + `demo2 mockup-mobile-app`.

## `screen-flow.html`

- **PURPOSE**: **Static app screen-flow map** - the answer to "show me the whole app flow." N phone-shaped lo-fi wireframe screens (CSS bezel + notch + status bar + app bar + optional bottom tab bar) laid side by side in a horizontally scrollable track; each adjacent pair is connected by a dashed arrow whose **label states the transition condition**; each phone carries a numbered caption (screen name + human-readable description of its role). Grayscale lo-fi with **real UI labels, never lorem**. Fully static - safe to print, screenshot, and share. Distinction: `mockup-frame` = one hi-fi screen (tab-switched), `wireframe-block` = *editable* flow, `screen-flow` = *readable deliverable* of the whole flow.
- **VARIABLES**: `{{FLOW_TITLE}}` `{{FLOW_DESC}}` + per screen `{{SCREEN_NAME}}` `{{SCREEN_CAPTION}}` `{{APPBAR_TITLE}}` + per transition `{{FLOW_LABEL}}` + per element `{{EL_LABEL}}` + tab bar `{{TAB_LABEL}}`.
- **CSS classes**: layout `.sf-flow`(+`[data-device="tablet"]`), `.sf-track`, `.sf-step`, `.sf-arrow`(+`.sf-arrow-label`); phone chrome `.sf-phone`, `.sf-notch`, `.sf-status`(+`.sf-status-ic`), `.sf-appbar`, `.sf-body`, `.sf-tabbar`, `.sf-tab`(+`.active`); caption `.sf-caption`, `.sf-name`, `.sf-desc`; lo-fi elements `.sf-heading`, `.sf-bar`(+`.-w90`/`.-w75`/`.-w60`), `.sf-note`, `.sf-img`(+`.sf-img-label`), `.sf-input`, `.sf-btn`(+`.-primary`), `.sf-search`(+`-ic`), `.sf-list`/`.sf-listrow`/`.sf-avatar`/`.sf-listbody`/`.sf-listlabel`, `.sf-chips`/`.sf-chip`, `.sf-divider`, `.sf-card`(+`.sf-card-title`). primitive: `h2`, `.lede`.
- **token**: `--text-primary/-secondary/-muted`, `--bg-page/-surface/-muted`, `--border-default/-subtle`, `--sp-*`, `--radius-sm/-md/-pill`, `--type-small/-caption`, `--font-mono`, `--shadow-md`. Grayscale only (no `--accent` in the module).
- **INTERACTION**: none (fully static). `@media print` wraps the track instead of scrolling.
- **builder**: rendered from data by the `screenflow` section type of `tools/build.mjs` (screens / elements / flows / tabbar - see `07-build-spec.md`). The section root carries `data-device-frame`, satisfying the `mobile-app` validator contract.
- **lineage**: `mockup-frame` (device chrome) + `wireframe-block` (lo-fi idiom).

---

# interactive Family

Driven by the data attributes of `interactions.js` (global `HA`) or by native `<details>`. Each hook has no separate per-component JS; everything is centralized in the shared library.

## `data-table.html`

- **PURPOSE**: A sortable + live-filterable + paginated table (no external library). The search box filters rows by text, clicking a `<th>` does asc/desc sort with `▲`/`▼` indicators, rows paginate (8/page) into a pager, and clicking a row toggles its selected state.
- **VARIABLES**: `{{PLACEHOLDER}}` + column headers `{{COL_NAME}}` `{{COL_EMAIL}}` `{{COL_ROLE}}` `{{COL_STATUS}}` + row cells `{{NAME}}` `{{EMAIL}}` `{{ROLE}}` `{{STATUS}}` `{{STATUS_CLASS}}` (`badge-success`/`badge-warning`/`badge-danger`/`badge-info`).
- **CSS classes**: `.data-table`, `.dt-search`, `.dt-row`, `.data-table th[data-sort="asc"/"desc"]`. primitive: `table`, `.badge*`, `.hidden`, `.selected`, `.no-print` (on the pager).
- **token**: `--accent`, `--bg-surface`, `--text-primary`, `--border-default`, `--radius-sm`.
- **INTERACTION**: `input[data-filter][data-filter-in=".dt-row"]` -> `HA.filter` live-filters (toggling `.hidden`). `table[data-sortable]` -> `HA.sortable` sorts on `<th>` click. `table[data-paginate][data-page-size="8"]` -> `HA.paginate` pages rows into the sibling `[data-pager]` (with ≤8 rows the pager stays empty); `data-row-select` toggles `.selected` on row click. All wired by `interactions.js`.
- **NUMERIC COLUMNS**: `class="num"` on a column's `<th>`/`<td>`s right-aligns it with tabular figures; the builder detects columns whose every cell is a number (with optional currency/unit) and groups JS numbers ≥ 1000 with commas. The table sits in a `.dt-scroll` wrapper (horizontal scroll on narrow screens); the pager and search are scoped to their own `.data-table`.
- **BUILDER VARIANTS** (`table` section key `density: "compact"`): the builder adds the class `dt-compact` to the `<table>`. Its CSS lives in this module's `<style data-module="data-table">` block: `.dt-compact thead th { padding: var(--sp-2); }` and `.dt-compact tbody td { padding: var(--sp-2) var(--sp-3); font-size: 13px; }`. This is a table-local tightening, independent of the page-level `density` axis (`03-themes-and-palettes.md` §1).
- **lineage**: `html-visual` (table) + `demo2` (table-users).

## `kanban-board.html`

- **PURPOSE**: Drag-and-drop kanban. A horizontal flex of columns, each with a header (title + count `.badge`) and a drop zone of `.kanban-card`. Cards have a title + `.chip` tags + assignee. No external library.
- **VARIABLES**: per column `{{COL_TITLE}}` `{{COUNT}}` + per card `{{CARD_TITLE}}` `{{TAG}}` `{{ASSIGNEE}}`.
- **CSS classes**: `.kanban`, `.kanban-col`(+`.drop-target`), `.kanban-col-head`, `.kanban-col-title`, `.kanban-cards`, `.kanban-card`(+`.dragging`), `.kanban-card-title`, `.kanban-card-foot`. primitive: `.badge`, `.chip`, `.card-outlined`, `.cluster`, `.small`, `.muted`.
- **token**: `--accent`, `--bg-*`, `--text-*`, `--sp-*`, `--radius-*`, `--shadow-*`, `--border-subtle`.
- **INTERACTION**: `[data-kanban]` + `[data-col]` > `.kanban-cards` > `.kanban-card` -> `HA.kanban`. The picked-up card gets `.dragging`, the column under the cursor gets `.drop-target`, and on drop it is appended to `.kanban-cards`.
- **lineage**: `html-visual` (kanban) + `demo2` (kanban-sprint HTML5 DnD).

## `tabs.html`

- **PURPOSE**: A tab panel. Buttons in a tab bar (tablist) show one `[data-panel]` at a time. Inactive panels are `.hidden`, the active tab is `.active`.
- **VARIABLES**: per tab `{{TAB_ID}}` `{{TAB_LABEL}}` + `{{PANEL_CONTENT}}` (`{{TAB_ID}}` is the shared key linking `button[data-tab=ID]` ↔ `[data-panel=ID]`). `{{TABS_LABEL}}`.
- **CSS classes**: `.tabs`, `.tab-bar`, `.tab`(+`.active`). primitive: `.stack`, `.hidden`.
- **token**: `--accent`, `--text-*`, `--border-default`, `--sp-*`, `--type-small`, `--dur-fast`, `--ease`.
- **INTERACTION**: `[data-tabs]` wrapper + `.tab(.active)[data-tab=x][role=tab]` + `[data-panel=x][role=tabpanel]` -> `HA.tabs`. Toggles `.active` / `.hidden` and `aria-selected` on click.
- **lineage**: `html-over-markdown` (spec) + `html-artifacts` (report).

## `slider-control.html`

- **PURPOSE**: A prototype tuner. A range input live-binds a CSS var (`var(--demo-x)`), a readout echoes the value + unit, a preview box reads that var, and a "Copy as CSS" button copies the rule. Theme-aware track.
- **VARIABLES**: `{{LABEL}}` (control name) `{{MIN}}` `{{MAX}}` `{{VALUE}}` `{{STEP}}` `{{VAR}}` (CSS var, e.g. `--demo-x`) `{{UNIT}}` (e.g. `px`) `{{PROP}}` (the CSS property the preview drives, e.g. `border-radius`).
- **CSS classes**: `.slider-control`, `.slider-row`, `.slider-out`, `.preview-stage`, `.preview-box` (+ the range's `::-webkit-slider-*` / `::-moz-range-*` pseudo-elements). primitive: `.card-outlined`, `.btn`, `.btn-ghost`, `.btn-sm`, `.eyebrow`, `.cluster`.
- **token**: `--accent`, `--bg-muted`, `--bg-surface`, `--border-*`, `--radius-pill`, `--radius-md`, `--shadow-sm`, `--text-*`, `--font-mono`, `--dur-fast`, `--ease`.
- **INTERACTION**: `input[type=range][data-slider="{{VAR}}"][data-out="#xval"][data-unit]` -> `HA.slider` (writes `{{VAR}}` to `:root`, updates `[data-out]`). `button[data-copy-text]` -> `HA.copy` (Clipboard API, switches the label to "Copied ✓").
- **lineage**: `html-visual` (prototype) + `html-artifacts` (editor).

## `collapsible.html`

- **PURPOSE**: A collapsible / FAQ list. Built with native `<details><summary>` - **zero JS** to open/close, keyboard-accessible by default, with an animated chevron.
- **VARIABLES**: per item `{{SUMMARY}}` (question / heading) `{{BODY}}` (answer / content).
- **CSS classes**: `.collapsible-list`, `.collapsible`, `.collapsible > summary`, `.chevron`, `.collapsible-body`. Adding `open` to `<details>` renders it expanded.
- **token**: `--border-subtle`, `--bg-surface`, `--bg-muted`, `--text-*`, `--accent`, `--radius-md`, `--sp-*`, `--type-*`, `--dur-fast`, `--ease`.
- **INTERACTION**: native `<details>` toggle - **no JavaScript needed**. `[open]` rotates the chevron. Not a wiring target of `interactions.js` (not in `HA.init`'s list).
- **lineage**: `html-artifacts` (report/spec) + `html-visual` (document).

---

# document Family

Structural blocks used in long-form documents / reviews / comparisons. All static (INTERACTION = none).

## `callout-box.html`

- **PURPOSE**: An admonition box built on the `.callout` primitive. A small inline SVG glyph + `.callout-title` + body. 4 variants: TL;DR (`--accent`), Note (`--color-info`), Warning (`--color-warning`), Success (`--color-success`).
- **VARIABLES**: per box `{{TITLE}}` `{{BODY}}`.
- **CSS classes**: `.callout-box`, `.callout-glyph`, `.callout-body`, variants `.callout-tldr` / `.callout-note` / `.callout-warning` / `.callout-success`. primitive: `.callout`, `.callout-title`.
- **token**: `--accent`, `--color-info`, `--color-warning`, `--color-success`, `--bg-surface`, `--sp-*`, `--radius-*`, `--text-secondary`, `--type-small`. Variants re-color the left border color + a faint surface tint via `color-mix` (theme-independent).
- **INTERACTION**: none.
- **lineage**: `html-artifacts` (report) + `html-over-markdown` (document).

## `comparison-grid.html`

- **PURPOSE**: Side-by-side comparison of options. A `.grid` of option cards. Each card has a title, pro list, con list, key-metric `<dl>`, and a `.btn` CTA. The recommended option is marked with `.card-accent` + a `.badge-accent` "Recommended".
- **VARIABLES**: per option `{{OPTION}}` `{{PRO}}` `{{CON}}` `{{METRIC_LABEL}}` `{{METRIC_VALUE}}` `{{CTA}}`.
- **CSS classes**: `.cmp-grid`, `.option`, `.option-head`. primitive: `.grid`, `.grid-3`, `.card-outlined`, `.card-accent`, `.badge`, `.badge-accent`, `.pro`, `.con`, `.btn`, `.small`, `.muted`.
- **token**: `--sp-*`, `--text-*`, `--border-subtle`, `--font-mono`, `--type-*`.
- **INTERACTION**: none.
- **BUILDER VARIANTS** (automatic column count): the builder emits `<div class="grid cmp-grid" style="--cmp-cols:N">` where `N = min(options.length, 4)` - it no longer hardcodes `grid-3` (the class itself remains valid for manual assembly). The module's style block defines `.cmp-grid { grid-template-columns: repeat(var(--cmp-cols, 3), 1fr); }` with a single-column fallback below 900px, so 2 options get 2 even columns, 4 options get 4.
- **lineage**: `html-artifacts` (spec) + `html-over-markdown` (comparison).

## `decision-matrix.html`

- **PURPOSE**: **Weighted decision matrix** for "help me decide" content. Criteria rows (each with an explicit `×weight`) score every option with a **visual bar + number + one-line rationale per cell**; a weighted-total footer compares each option against the maximum possible; the recommended option's column is accent-tinted and badged; a closing **verdict callout states the pick and WHY in plain language**. The reader can audit the decision (weights, scores, notes) instead of trusting a bare conclusion. Distinction: `comparison-grid` = qualitative pros/cons cards; `decision-matrix` = quantitative, weighted, with an explicit verdict. They compose well together (matrix first, cards as detail).
- **VARIABLES**: `{{MATRIX_TITLE}}` `{{MATRIX_DESC}}` + per option `{{OPTION}}` + per criterion `{{CRITERION}}` `{{WEIGHT}}` + per cell `{{SCORE}}` `{{SCORE_PCT}}` `{{CELL_NOTE}}` + footer `{{TOTAL}}` `{{TOTAL_MAX}}` `{{TOTAL_PCT}}` + verdict `{{PICK}}` `{{RATIONALE}}`.
- **CSS classes**: `.decision-matrix`, `.dm-scroll`, `.dm-table`, `.dm-crit`, `.dm-weight`, `.dm-opt`, option tints `.dm-c1..dm-c5` (set `--dm-c` from `--cat-1..5`), winner wash `.-winner`, `.dm-cell`, `.dm-score`, `.dm-bar`(+`.-total`), `.dm-fill`, `.dm-num`(+`.dm-max`), `.dm-note`, `.dm-total`, `.dm-verdict`. primitive: `.badge`, `.badge-accent`, `.callout`, `.callout-title`, `h2`, `.lede`. **Requires `callout-box` module CSS too** (the verdict box uses `.callout-box .callout-success`).
- **token**: `--cat-1..5`, `--accent` (winner wash via `color-mix`), `--bg-muted`, `--text-*`, `--border-default/-subtle`, `--sp-*`, `--radius-pill`, `--type-small/-caption`, `--font-mono`.
- **INTERACTION**: none (fully static). Bar widths are inline `style="width:N%"` computed from `score/scale`.
- **BUILDER VARIANTS** (`decision` section key `variant`):
  - `"detailed"` (default) - the current rendering, with a visible `<p class="dm-note">` rationale per cell.
  - `"compact"` - omits the `<p class="dm-note">` paragraphs; the note text moves into a `title="…"` attribute on each `<td class="dm-cell …">` (hover tooltip), shrinking the matrix to score bars + numbers.
- **builder**: rendered from data by the `decision` section type of `tools/build.mjs` - weighted totals and the winner are **computed**, never hand-summed (see `07-build-spec.md`).
- **lineage**: `comparison-grid` (options) + `html-over-markdown` (comparison).

## `diff-block.html`

- **PURPOSE**: An annotated code-review diff hunk. A file header (mono path + add/remove stat badges), a `<pre>` with a line-number gutter and per-line `.diff-add` / `.diff-remove` / context lines, and a margin `.callout` note with severity classes.
- **VARIABLES**: `{{FILE}}` `{{ADDED}}` `{{REMOVED}}` + per line `{{N}}` (gutter line number) `{{CODE}}` + `{{NOTE}}`. Mark each line as `.diff-add` / `.diff-remove` / (no mark for context), and align the code's `+`/`-` symbols with the line class.
- **CSS classes**: `.diff-block`, `.diff-head`, `.diff-file`, `.diff-stats`, `.dl`(+`.diff-add`/`.diff-remove`), `.dl .ln`, `.dl .code`, `.diff-note`. primitive: `pre`, `code`, `.badge*` (`.badge-success`/`.badge-danger`), `.callout*`, `.sev-high`/`.sev-med`/`.sev-low`, `.diff-add`/`.diff-remove`.
- **token**: `--font-mono`, `--color-success`, `--color-danger`, `--text-*`, `--border-*`, `--bg-muted`, `--sp-*`, `--radius-md`.
- **INTERACTION**: none.
- **lineage**: `html-artifacts` (code-review) + `html-over-markdown` (PR writeup).

---

# v2 modules (16 added)

Added in v2 to broaden coverage (data-viz, spec/document, and content/marketing blocks). All follow the same conventions - token-only colors, inline-SVG with `role`/`aria`, one `<style data-module="…">` block inlined once - and each (except the manual-only ones) has a `tools/build.mjs` section renderer with computed geometry. Full routing metadata (use-when / avoid-when / keywords / EN·KO·JA intent) lives in `index/components.json`.

## charts family (v2)

### `stat-trend.html`
- **PURPOSE**: KPI card (value + delta) **with an inline sparkline** of the recent trajectory - answers "what is it now?" and "where is it heading?" in one tile. Extends the `kpi-grid` metric primitives.
- **VARIABLES / builder (`stattrend`)**: `items[].{label, value, valueNum?, delta?, dir?, suffix?, series[], trend?}`, `columns?` (1–4). Sparkline `viewBox 0 0 120 36`, computed `x=pad+i/(n−1)·112`, `y=(32)−(v−min)/span·28`. `trend:"up"/"down"` toggles `.spark.-up`/`.-down` (success/danger tint).
- **CSS classes**: `.st-sec`, `.st-grid`, `.stat-trend`, `.spark`(+`.-up`/`.-down`), `.spark-line`/`-area`/`-dot`. primitive: `.card-outlined`, `.metric*`.
- **token**: `--accent`, `--color-success/-danger`, `--sp-*`. **INTERACTION**: `HA.counter` on the value. **lineage**: unified-system original (extends `kpi-grid`).

### `chart-stacked.html`  (sections `barstacked` + `areastacked`)
- **PURPOSE**: Multi-series **part-to-whole** charts. `barstacked` = stacked / grouped / 100%-stacked bars; `areastacked` = stacked / single / 100% filled-area time series. Series colored `--cat-1..5`, shared x-axis, colored-chip legend.
- **VARIABLES / builder**: bar - `categories[]`, `series[].{label,cat?,values[]}`, `mode:stacked|grouped|percent`, `size?`. area - `xLabels[]`, `series[].{label,cat?,values[]}`, `mode:stacked|single|percent`, `size?`. Geometry, nice ticks and totals computed by the builder.
- **CSS classes**: the HTML-hybrid `.hc` frame (`.hc-bar.hc-seg` / `.hc-sub` segments, `.hc-sum` totals, `.hc-area` / `.hc-line` paths, `.hc-hit` hover points, `.hc-legend`) + `.cat-1..5`.
- **token**: `--cat-1..5`, `--border-*`, `--text-*`, `--bg-*`. **INTERACTION**: `[data-chart-tip]`+`data-tip` (bars) → `HA.tooltip`. `role="img"`. **lineage**: extends `chart-bar`/`chart-line`.

### `gauge.html`
- **PURPOSE**: Grid of **radial gauge rings** - one value vs target/max with a center readout. Donut-style `stroke-dasharray` arcs; tonable to status colors.
- **VARIABLES / builder (`gauge`)**: `items[].{label, value, max?, display?, tone?}`. `C=2π·52=326.73`; `SEG=frac·C`; arc rotated −90°.
- **CSS classes**: `.gauge-sec`, `.gauge-grid`, `.gauge`(+tone `.g-success/-warning/-danger/-info`), `.gauge-track`, `.gauge-arc`, `.gauge-val`, `.gauge-label`.
- **token**: `--accent`, `--color-*`, `--bg-muted`, `--border-subtle`. **INTERACTION**: none. `role="img"`+aria-label. **lineage**: unified-system original.

### `radar.html`
- **PURPOSE**: Multi-axis **radar / spider** chart - N axes, concentric grid rings + spokes + labels, one translucent `--cat-n` polygon per series, dot legend. For capability/criteria profiles.
- **VARIABLES / builder (`radar`)**: `axes[]`, `series[].{label, cat?, values[]}`, `max?`. centre (160,160), R=110; `angle_i=(−90+i·360/N)°`; point `= (cx+cos·R·frac, cy+sin·R·frac)`. Axis labels (17 user units, > 10 chars wrapped at a space) sit at frac 1.14; the viewBox is fitted to rings + labels and the SVG drawn at ≤ 0.8 scale, so labels stay ≥ 10px down to a phone-width card.
- **CSS classes**: `.radar`, `.radar-body` (chart + legend; stacked below a 560px container), `.radar-title`, `.radar-ring`, `.radar-spoke`, `.radar-axis`, `.radar-area`(+`.cat-1..5`), `.radar-legend`/`.legend-row`/`.dot`.
- **token**: `--cat-1..5`, `--border-default`, `--text-*`. **INTERACTION**: none. `role="img"`. **lineage**: unified-system original.

### `funnel.html`
- **PURPOSE**: Vertical **conversion funnel** - bars share one left edge on a faint track (width ∝ value / first stage, so even a 1% stage stays comparable), each with its value, the share of the first stage and the step conversion from the previous stage. CSS bars (no SVG).
- **VARIABLES / builder (`funnel`)**: `stages[].{label, value, display?}`. Stages cycle `--cat-1..5`; numbers are grouped (24,800).
- **CSS classes**: `.funnel`, `.fn-row`, `.fn-head`, `.fn-label`, `.fn-val`, `.fn-pct`, `.fn-barwrap`, `.fn-bar`(+`.cat-1..5`), `.fn-step`. **token**: `--cat-1..5`, `--accent`, `--text-*`. **INTERACTION**: none. **lineage**: unified-system original.

### `progress.html`
- **PURPOSE**: Stack of labeled **linear progress / meter bars** - completion, budget, quota, capacity, score-to-target. Pure CSS.
- **VARIABLES / builder (`progress`)**: `items[].{label, value, max?, display?, suffix?, tone?}`. fill width = `value/max·100%`; `tone` recolors via `--color-*`.
- **CSS classes**: `.progress-list`, `.pr-row`, `.pr-head`, `.pr-label`, `.pr-val`, `.pr-track`, `.pr-fill`(+`.pr-success/-warning/-danger/-info`). **token**: `--accent`, `--color-*`, `--bg-muted`, `--radius-pill`. **INTERACTION**: `role="progressbar"` per track (static). **lineage**: unified-system original.

### `chart-bullet.html`
- **PURPOSE**: **Goal-vs-actual bullet bars** (Stephen Few) - a value bar over a track with a target tick and optional qualitative range bands. Dense KPI rows.
- **VARIABLES / builder (`bullet`)**: `rows[].{label, value, target, max?, bands?:[a,b], valueText?}`. value/target as `%` of max; `bands` shade poor/ok/good via a token gradient.
- **CSS classes**: `.bullet-list`, `.bl-row`, `.bl-label`, `.bl-track`, `.bl-fill`, `.bl-target`, `.bl-val`. **token**: `--accent`, `--bg-muted`, `--text-*`. **INTERACTION**: `role="img"` per track (static). **lineage**: unified-system original.

### `heatmap.html`
- **PURPOSE**: **Value-shaded matrix heatmap** - a real labeled `<table>` whose cell background intensity encodes magnitude (cohort, day×hour activity, correlation, risk). Theme-following via `color-mix(--accent …)`.
- **VARIABLES / builder (`heatmap`)**: `xLabels[]`, `yLabels[]`, `rows[][]`, `min?`, `max?`. intensity `= 8 + frac·62` % of `--accent` over `--bg-muted`.
- **CSS classes**: `.heatmap`, `.hm-scroll`, `.hm-title`(caption), `.hm-table`, `.hm-x`/`.hm-y`/`.hm-corner`, `.hm-cell`, `.hm-v`. **token**: `--accent`, `--bg-muted`, `--text-*`. **INTERACTION**: none; per-cell `title`. **lineage**: unified-system original.

### `cal-heatmap.html`
- **PURPOSE**: **GitHub-style contribution calendar** - week columns × 7 weekday rows, day cells tinted by a 0–4 intensity bucket, with a Less→More legend. (Distinct from `heatmap`, which is an arbitrary labeled matrix.)
- **VARIABLES / builder (`calendar`)**: `weeks[][]{value, bucket?, date?}`, `legend?`. bucket 0 = `--bg-muted`; 1–4 = `color-mix(--accent {22,40,58,78}% …)`.
- **CSS classes**: `.cal-heatmap`, `.cal-title`, `.cal-scroll`, `.cal-grid`, `.cal-week`, `.cal-cell`(+`.cal-empty`), `.cal-legend`/`.cal-legend-label`. **token**: `--accent`, `--bg-muted`, `--text-muted`. **INTERACTION**: none; `role="img"`+per-cell `title`. **lineage**: unified-system original.

## interactive family (v2)

### `tree.html`
- **PURPOSE**: **Collapsible hierarchy** - file tree, sitemap, org chart, nested taxonomy/requirements. Indented nested lists; rotating caret on branches, dot on leaves, optional mono meta + status badge. Reuses the shipped `HA.tree` behavior.
- **VARIABLES / builder (`tree`)**: `nodes[].{label, meta?, badge?, badgeTone?, children[]}` (recursive).
- **CSS classes**: `.tree`/`.tw-children`, `.tw-node`(+`.tw-leaf`), `.tw-row`, `.tw-caret`, `.tw-bullet`, `.tw-label`, `.tw-meta`, `.tw-badge`. data: `[data-tree]`/`[data-tree-node]`/`[data-tree-toggle]`/`[data-children]`.
- **token**: `--border-*`, `--bg-muted`, `--text-*`. **INTERACTION**: `HA.tree` (click/Enter/Space collapse, aria-expanded). **lineage**: unified-system original (wires the existing `tree` behavior, previously module-less).

### `form-fields.html`
- **PURPOSE**: **Themed prototype form** - request-access / settings / signup / contact. Text · email · number · select · textarea · checkbox fields built on the **elements.css form-control primitives** (themed input/select/textarea/checkbox, `.field` label+control stack, `.field-hint`, `.field-req`), so a raw `<input>` is no longer the bare OS widget. The submit is wired by `HA.formMock` (`[data-form-mock]`): it intercepts, reveals `.form-status`, and never navigates - a real, non-dead interactive prototype.
- **VARIABLES / builder (`form`)**: `{title?, desc?, columns?:1|2, submit?:{label}|false, fields[].{label, kind?:text|email|password|number|tel|url|date|select|textarea|checkbox, placeholder?, options?(select), help?, required?, optional?, checked?(checkbox), full?}}`. Every field gets an explicit `<label for>` (+ `aria-describedby` for hints); required fields mark `aria-required`.
- **CSS classes**: `.form-fields`(+`.is-submitted`), `.form-grid`(`--form-cols`), `.field-full`, `.field-opt`, `.form-actions`, `.form-status`. primitive: `.field`, `.field-label`, `.field-hint`, `.field-req`, `.option-row`, `.card-outlined`, `.btn`, and the bare input/select/textarea/checkbox primitives. data: `[data-form-mock]`.
- **token**: `--bg-surface`, `--border-*`, `--accent`, `--on-accent`, `--text-*`, `--color-success`(confirmation), `--radius-*`, `--sp-*`. **INTERACTION**: `HA.formMock` (submit → confirm in place). **lineage**: unified-system original (form-controls tier).

## document family (v2)

### `stat-list.html`
- **PURPOSE**: **Definition / spec sheet** - a bordered key→value list for metadata, config, API params, "at a glance" facts. The structural counterpart of `comparison-grid` (one subject, many facts).
- **VARIABLES / builder (`statlist`)**: `items[].{k, v, note?, badge?}`, `columns?` (1–3). `badge` (success/warning/danger/info/accent) renders the value as a status badge.
- **CSS classes**: `.stat-list`(`--sl-cols`), `.sl-item`, `.sl-k`, `.sl-v`, `.sl-note`. primitive: `.badge*`. **token**: `--border-*`, `--bg-surface`, `--font-mono`. **INTERACTION**: none (native `<dl>`). **lineage**: unified-system original.

### `activity-feed.html`
- **PURPOSE**: **Chronological activity stream** - commits, comments, deploys, status changes, audit log. A connector line threads icon markers; each row has actor + action + timestamp. Denser than `timeline` (which is for milestones).
- **VARIABLES / builder (`feed`)**: `items[].{icon?, actor?, text, time, tone?}`. `icon` from the built-in line-icon set; `tone` (success/warning/danger/info) colors the marker.
- **CSS classes**: `.activity-feed`, `.af-item`(+tone), `.af-mark`, `.af-ic`, `.af-body`, `.af-text`, `.af-actor`, `.af-time`. **token**: `--border-subtle`, `--bg-muted`, `--color-*`, `--text-*`. **INTERACTION**: none (optional `[data-reveal]`). **lineage**: unified-system original.

### `empty-state.html`
- **PURPOSE**: **Centered zero-state** placeholder - no-data, zero-results, all-clear, error - for prototypes and result panels. Glyph disc + title + body + optional action button.
- **VARIABLES / builder (`empty`)**: `{icon?, title, body?, action?:{label}, tone?}`. `tone` neutral/success/danger.
- **CSS classes**: `.empty-state`(+`.-success`/`.-danger`), `.es-ic`, `.es-title`, `.es-body`. primitive: `.btn`. **token**: `--bg-surface`, `--bg-muted`, `--border-default`, `--color-*`. **INTERACTION**: none. **lineage**: unified-system original.

### `checklist.html`
- **PURPOSE**: **Themed list of real controls** - checkbox / radio / switch rows for settings, acceptance criteria, requirements, launch readiness, or a filter panel. Unlike `wireframe-block`'s lo-fi faux placeholders, these are **genuine native controls** styled by the elements.css form-control primitives (accent fill, theme radius, dark/light surface). Optional per-row status badge (done/pending/blocked) and a checked/total count in the header.
- **VARIABLES / builder (`checklist`)**: `{title?, control?:checkbox|radio|switch, name?, variant?:boxed(default)|plain, count?:false, items[].{label, desc?, checked?, disabled?, state?:done|pending|blocked|todo}}`. `state:"done"` pre-checks and badges success; `pending`→warning, `blocked`→danger. `control:"radio"` groups by a shared `name`; `control:"switch"` renders the pill toggle.
- **CSS classes**: `.checklist-sec`, `.ck-head`, `.ck-count`, `.checklist`(+`.is-boxed`), `.ck-text`, `.ck-state`. primitive: `.option-row`, `.option-label`, `.option-desc`, the bare checkbox/radio/`.switch` controls, `.badge*`. Every control has an explicit `<label for>`.
- **token**: `--bg-surface`, `--border-subtle`, `--accent`, `--on-accent`, `--text-*`, `--radius-*`. **INTERACTION**: none (native checkbox/radio/switch toggling). **lineage**: unified-system original (form-controls tier).

## content family (v2 - new family)

### `feature-grid.html`
- **PURPOSE**: Grid of **icon feature/benefit cards** - capabilities, "what's included", release highlights. Tinted line-icon tile + title + body + optional tag.
- **VARIABLES / builder (`features`)**: `items[].{icon?, title, body, tag?}`, `columns?` (1–4). `icon` keyed from the built-in inline-SVG set (bolt/shield/chart/lock/gear/globe/check/rocket/layers/clock/users/code/star/…).
- **CSS classes**: `.feat-sec`, `.feat-grid`(`--feat-cols`), `.feat`, `.feat-ic`, `.feat-title`, `.feat-body`, `.feat-tag`. primitive: `.card-outlined`, `.badge-accent`. **token**: `--accent`, `--bg-surface`, `--text-*`. **INTERACTION**: none. **lineage**: unified-system original.

> **Removed (generality pass)**: `pricing`, `quote`, `rating` - marketing/landing-page blocks judged out-of-scope for the core report/spec/dashboard/diagram/decision system and removed (along with the orphan `annotation-memo`). Their builder section renderers (`pricing` / `quote` / `rating`) were dropped from `tools/build.mjs` too.

---

## source-skill Lineage Matrix

Which source-skill each module was integrated from (its origin before de-duplication).

| Module | html-artifacts | html-visual | html-over-markdown | html-artifact2 / demo2 | html-flowchart-anthropic | interactive |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `chart-bar` | | chart | | | | |
| `chart-line` | | chart | | | | |
| `chart-donut` | | chart | | | | |
| `kpi-grid` | report | dashboard | | | | |
| `flow-diagram` | | diagram | | | flow style | |
| `arch-diagram` | | architecture | | interactive | | |
| `erd` | spec | diagram | | | | |
| `node-graph` | | diagram/graph | | arch/erd interactive | | |
| `mindmap` | | mindmap | | mindmap-product | | |
| `timeline` | report | diagram | | | | |
| `stepper` * | | | | | | |
| `wireframe-block` | | wireframe | | wireframe-dashboard | | |
| `mockup-frame` | | mockup | | mockup-mobile-app | | |
| `screen-flow` ** | | | | | | |
| `data-table` | | table | | table-users | | |
| `kanban-board` | | kanban | | kanban-sprint (DnD) | | |
| `tabs` | report | | spec | | | |
| `slider-control` | editor | prototype | | | | |
| `collapsible` | report/spec | document | | | | |
| `callout-box` | report | | document | | | |
| `comparison-grid` | spec | | comparison | | | |
| `decision-matrix` ** | spec | | comparison | | | |
| `diff-block` | code-review | | PR writeup | | | |

> \* `stepper` was tokenised from the standalone `staged-enforcement-stepper.template.html`, so it sits outside the 5 source-skill columns.
> \** `screen-flow` and `decision-matrix` are unified-system originals (added for the `app-flow` and `decision` shapes): `screen-flow` derives from `mockup-frame`'s device chrome + `wireframe-block`'s lo-fi idiom, and `decision-matrix` extends `comparison-grid` with weighted scoring and a verdict.

> Note: As the header of `interactions.js` records, integrating the **9 individual JS files from 5 skills into 1 library (`HA.*`)** means the modules that need JS (`data-table` / `kanban-board` / `tabs` / `slider-control` / `erd` / `arch-diagram` / `node-graph` / `flow-diagram` / `mindmap` / `mockup-frame` / `chart-bar` / `chart-line` / `chart-donut` / `kpi-grid`, plus the opt-in `wireframe-block` behaviors and `stepper`'s optional `reveal`) have no per-component script at all and connect to behaviors via data attributes only. `collapsible` avoids JS entirely with native `<details>`; the document family (`callout-box` / `comparison-grid` / `decision-matrix` / `diff-block`) plus `timeline` and `screen-flow` are the fully static modules.

# v3 modules (17 added - expressiveness pass)

Seventeen modules added to close the biggest gaps in diagram/visual vocabulary:
engineering diagrams (sequence / state / swimlane / gantt / org / KPI-tree),
UX (journey map), business frameworks (2x2 quadrant / pyramid / venn /
before-after / risk matrix / cycle), and data viz (scatter / waterfall /
treemap / spectrum). All are static (INTERACTION: none), colors are semantic
tokens only, every SVG carries role="img" + <title>, and all defs ids are
namespaced per module. Builder: paste manually (`section: (manual)`).

### sequence-diagram - UML-style message sequence (SVG)

Participants across the top, dashed lifelines, activation bars, solid sync
messages (`.seq-msg` + `#seq-arrow`), dashed returns (`.seq-msg-return` +
`#seq-arrow-open`), and an optional warning-tinted note (`.seq-note`).

**Variables:** `{{TITLE}}`, per participant `{{ACTOR}}`, per message `{{MESSAGE}}`, note `{{NOTE}}`.

**Geometry:** participant centers evenly spaced (example 120/380/640; head rect
W=150 H=40 at y=8 → rect x = center−75). Lifeline y=48→bottom. Activation bar =
8px rect at x=center−4. Message at time t: horizontal line y=t from source edge
(center±4) to target edge, label at (midpoint, t−8). Stack messages ~52–60px
apart; extend viewBox height +56 per extra message. Self-message: path
`M(cx+4,t) h36 v24 h-36` with the same marker.

**Classes:** `.seq` (figure) · `.seq-title` · `.actor-box` / `.actor-label` ·
`.lifeline` · `.activation` · `.seq-msg` / `.seq-msg-return` / `.msg-label` ·
`.seq-note` / `.note-label`. Markers namespaced `#seq-arrow` / `#seq-arrow-open`.

**Use when** the message *order in time* between parties is the point (API
flows, handshakes). Branching logic → `flow-diagram`; static structure →
`arch-diagram`; per-owner process lanes → `swimlane`.

## `state-diagram.html`

- **PURPOSE**: Self-contained SVG **UML state machine / statechart** (no Mermaid/D3). Vocabulary: initial pseudo-state (filled dot), states (rounded rects), final state (double circle), and **guarded transition arrows** whose label is the `[guard]` condition/event. For lifecycle / status modeling - order, subscription, ticket, or job 状態遷移 (e.g. Draft → Pending → Confirmed with a Cancelled branch).
- **VARIABLES**: `{{TITLE}}` + per state `{{STATE_NAME}}` + per transition `{{GUARD}}` (rendered as `[guard]`).
  - **GEOMETRY**: states sit on a baseline row at `midY=70`; a state box is `W=140 H=48`, so a state centered at `cx` has box `x=cx-70, y=46`. Row centers are spaced **210px** (145, 355, 565 …) - add a state at `prev+210` and widen the viewBox `+210`. Initial dot: `r=8` at `(36,70)`, edge exits at `x=44`. Final: outer circle `r=16` + inner filled `r=7`, left edge `= cx-16`. A transition is a line from the source right edge (`cx+70`) to the target left edge (`cx-70`) at `y=70`, its `[guard]` centered above at `y=62`. Branch to a lower row (cancelled at `midY=204`): drop vertically (`M cx,94 V 180`) or route orthogonally (`M x,94 V y H tx`). Tint terminal-ish states with `.is-success` / `.is-danger`.
- **CSS classes**: `.sd`, `.sd-title`, `.sd-initial`, `.sd-final-outer`, `.sd-final-inner`, `.sd-state`(+`.is-success`/`.is-danger`), `.sd-label`, `.sd-edge`, `.sd-arrow`, `.sd-guard`. primitive: `.card-outlined`.
- **token**: `--accent`, `--bg-card`, `--color-success`, `--color-danger`, `--border-default`, `--text-primary/-secondary`, `--font-mono`, `--dur-fast`, `--ease`.
- **INTERACTION**: `HA.fitSvgText` clamps state labels inside `.sd-state` rects. Hover warms a state's hairline toward the accent (paint-only transition; disabled under `prefers-reduced-motion`). `role="img"` + `<title>`. Marker id namespaced `state-diagram-arrow`.
- **when to use**: modeling the valid states of one entity and the guarded events that move it between them (including cycles and terminal states). Use `flow-diagram` for abstract decision logic without persistent states, `stepper` for a forward-only numbered procedure, `timeline` for dated chronological milestones.
- **lineage**: v3 diagrams expansion (UML) - sibling of `sequence-diagram`.

## `swimlane.html`

- **PURPOSE**: Self-contained SVG **swimlane process map** (no external libs). Horizontal lanes - one per actor / department, the lane name riding a `--cat-n` band on the left edge - hold process boxes placed across step columns, and arrows **hand the flow off between lanes**. For cross-functional approval / request / fulfillment workflows where responsibility passes between teams.
- **VARIABLES**: `{{TITLE}}` + per lane `{{LANE_NAME}}` + per step `{{PROCESS}}` (box label).
  - **GEOMETRY**: lanes are stacked horizontal bands of `H=84`: lane `i` top `= 8 + i*84`, midline `= top+42` (50, 134, 218 …). The left name-band is `x=4 W=40`; lane bodies span `x=44 → 812`. Step columns are centered at 110, 260, 410, 560, 710 (spacing **150**); faint dashed separators sit on the boundaries (185, 335, 485, 635). A process box is `W=110 H=44` centered on `(colCenter, laneMid)`: `x=colCenter-55, y=laneMid-22`. A hand-off arrow is a straight line from the source box right edge (`cx+55`) to the target box left edge (`cx-55`). Add a lane by extending every band + the viewBox height `+84`; add a step column at `prevCenter+150`.
- **CSS classes**: `.sw`, `.sw-title`, `.sw-lane`(+`.-alt` zebra), `.sw-band`(+`.cat-1..3`), `.sw-lane-label` (rotated), `.sw-col` (dashed separators), `.sw-node`, `.sw-box`, `.sw-box-label`, `.sw-flow`, `.sw-arrow`. primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-1..5`, `--bg-card`, `--bg-muted`, `--border-default/-subtle`, `--text-primary/-secondary`, `--dur-fast`, `--ease`.
- **INTERACTION**: none (static). Hover warms the box edge/fill toward the accent (paint-only; disabled under `prefers-reduced-motion`). `role="img"` + `<title>`. Marker id namespaced `swimlane-arrow`.
- **when to use**: a process whose steps must be attributed to actor lanes with visible hand-offs between them. Use `flow-diagram` for unattributed decision logic, `stepper` for a single-owner linear procedure, `timeline` for chronological dated milestones with no actor attribution.
- **lineage**: v3 diagrams expansion.

## `gantt.html`

- **PURPOSE**: Self-contained SVG **Gantt chart / roadmap** (no external libs). A period axis across the top (month / week labels), one task row per bar with an **inner progress rect** (% complete painted over a `--cat-n`-tinted track), **milestone diamonds**, and a dashed **"today" marker** line. For project plans, delivery schedules, and product roadmaps.
- **VARIABLES**: `{{TITLE}}` + per task `{{TASK_LABEL}}` `{{PCT}}` (e.g. `"70%"`) + per period `{{PERIOD}}` + milestone `{{MS_LABEL}}` + `{{TODAY_LABEL}}`.
  - **GEOMETRY**: label column `x=0→140`; the plot is `x=140→770` split into equal periods of `W=105` (period `k` spans `140+k*105 → 140+(k+1)*105`; label centered at `140+k*105+52.5`, `y=22`). Header band `= y 0→34`. Rows are `H=40`: row `i` top `= 34+i*40`, midline `= top+20`. A bar covering periods `[a,b)` is `x=140+a*105+4, width=(b-a)*105-8, y=midline-9, H=18, rx=4`; the **progress fill** shares `x/y/H` with `width = barWidth*pct/100`. A milestone diamond of half-size 9 at `(cx,cy)`: `"cx,cy-9 cx+9,cy cx,cy+9 cx-9,cy"`. The today line is a full-height dashed rule at `x=140+t*105`. Add a task `+40` to viewBox height; add a period by widening.
- **CSS classes**: `.gt`, `.gt-title`, `.gt-grid`, `.gt-axis`, `.gt-task-label`, `.gt-row`, `.gt-bar`(+`.cat-1..5`), `.gt-bar-fill`(+`.cat-1..5`), `.gt-pct`, `.gt-milestone`, `.gt-ms-label`, `.gt-today`, `.gt-today-label`. primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-1..5`, `--bg-card`, `--color-danger` (today marker), `--border-default/-subtle`, `--text-primary/-secondary`, `--font-mono`, `--dur-fast`, `--ease`.
- **INTERACTION**: none (static). Hovering a `.gt-row` lifts its track + fill brightness (paint-only `filter`; disabled under `prefers-reduced-motion`). `role="img"` + `<title>`. No marker ids (bars/diamonds only).
- **when to use**: work scheduled across a time axis with durations, % completion, milestones, and a today line. Use `timeline` for dated milestones with no duration bars, `progress` for each metric vs its own target (not time-scheduled), `stepper` for an ordered logic procedure.
- **lineage**: v3 diagrams expansion.

## `cycle-loop.html`

- **PURPOSE**: Self-contained **SVG cycle diagram** (no external libs). N steps (3–6) placed around a ring, joined by curved arc arrows into a closed loop; each node is a `--cat-N`-tinted circle + label, and the cycle's name sits in a hub at the center. For PDCA, build-measure-learn, dev/release cycles, feedback loops. Distinction: `stepper` is a linear start-to-end sequence, `flow-diagram` branches on decisions; `cycle-loop` is a single closed ring where the last→first arrow is the point.
- **VARIABLES**: `{{TITLE}}` + `{{CYCLE_NAME}}` (center hub) + per step `{{STEP_LABEL}}` (and optional `{{STEP_N}}` order index).
- **GEOMETRY**: `cx=200,cy=200`, `R=130` (node-center ring), node radius `nr=44`. Step `i` angle `θ_i = −90 + i·360/N` (degrees, `i=0` at top, clockwise); node center = `(cx + R·cos θ_i, cy + R·sin θ_i)`. Connector `i→i+1` is an arc on radius `R` from `A=(cx+R·cos(θ_i+g), cy+R·sin(θ_i+g))` to `B=(cx+R·cos(θ_{i+1}−g), cy+R·sin(θ_{i+1}−g))` with gap `g≈32°`: path `"M Ax,Ay A R,R 0 0 1 Bx,By"` (sweep=1 clockwise) + `marker-end`. The in-file example is `N=4`.
- **CSS classes**: `.cyc`, `.cyc-title`, `.cyc-arc`, `.cyc-arrow` (marker fill), `.cyc-hub`, `.cyc-hub-label`, `.cyc-node`(+`.cat-1..5`), `.cyc-disc`, `.cyc-num`, `.cyc-label`. primitive: `.card-outlined`.
- **token**: `--cat-1..5`, `--accent`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-primary/-secondary/-muted`, `--font-mono`, `--sp-*`.
- **INTERACTION**: none (static). `role="img"` + `<title>`; the marker id is `cyc-`-prefixed (`#cyc-arrow`). Node hover firms the disc fill + ring (paint only, reduced-motion guarded).
- **lineage**: unified-system original (process/loop).

## `org-chart.html`

- **PURPOSE**: Self-contained SVG **top-down organization / hierarchy chart** (no external libs). A box tree (1 → 2 → 4) joined by **orthogonal (elbow) connectors**; each box carries two lines - a name and a role. Depth is encoded as a subtle `color-mix` density step of `--accent` (deeper level = lighter tint). For org structures, reporting lines, and taxonomy hierarchies.
- **VARIABLES**: `{{TITLE}}` + per node `{{NAME}}` (line 1) `{{ROLE}}` (line 2).
  - **GEOMETRY**: box `W=150 H=54`; a node centered at `cx` has box `x=cx-75`, its name at `y=top+22` and role at `y=top+38`. Levels sit at row tops 24 / 150 / 270 (midlines 51 / 177 / 297). A **parent's `cx` is the mean of its children's `cx`**. Connectors are one elbow path per parent: drop from the parent bottom `(cx, top+54)` to a horizontal bus at the mid-gap `y`, run the bus across the children's `cx` span, then drop into each child top - `"M px,pBot V busY  M leftCx,busY H rightCx  M cx_i,busY V childTop"`. Bus `y` used: 114 (L0→L1), 237 (L1→L2). Add a level ~120px below, set each parent `cx = mean(children)`, extend the viewBox. Tint by depth with `.lvl-1` / `.lvl-2` / `.lvl-3`.
- **CSS classes**: `.oc`, `.oc-title`, `.oc-conn`, `.oc-box`(+`.lvl-1`/`.lvl-2`/`.lvl-3`), `.oc-name`, `.oc-role`. primitive: `.card-outlined`.
- **token**: `--accent`, `--bg-card`, `--border-default`, `--text-primary/-secondary`, `--font-mono`, `--dur-fast`, `--ease`.
- **INTERACTION**: none (static). Hover warms a box's hairline toward the accent (paint-only; disabled under `prefers-reduced-motion`). `role="img"` + `<title>`. Connectors are plain hierarchy lines - **no arrowheads / no marker ids**.
- **when to use**: a people/units reporting hierarchy read top-down, with name + role per box and clean elbow connectors. Use `tree` when the hierarchy must collapse/expand as an indented outline, `mindmap` when ideas radiate from a center, `kpi-tree` when decomposing a metric into drivers with operators.
- **lineage**: v3 diagrams expansion.

## `kpi-tree.html`

- **PURPOSE**: Self-contained SVG **KPI / driver / logic tree** (no external libs). A root metric on the **left** decomposes rightward through two levels of driver nodes; **operator chips** (`×` `+` `÷`) sit on the branch junctions to state HOW children combine into the parent. Each node shows a name + a value. For driver trees, unit-economics breakdowns, and issue/logic trees (e.g. Revenue = Visits × CVR × AOV).
- **VARIABLES**: `{{TITLE}}` + per node `{{NODE_NAME}}` (line 1) `{{NODE_VALUE}}` (line 2, mono) + per junction `{{OP}}` (one of `×` `+` `÷`).
  - **GEOMETRY**: left-to-right. A node box `W×H` centered on `(cx, cy)` puts the name at `cy-4` and value at `cy+13`. Columns: root `x=20 W=150 H=52`; level-1 `x=240 W=150 H=46`; level-2 `x=480 W=140 H=44`. A parent fans to its children through a junction bus: `"M pRight,pMid H busX"` then the vertical bus `"M busX,topChildMid V botChildMid"` then `"M busX,cMid_i H childLeft"` per child. Bus `x` used: 215 (root→L1), 455 (L1→L2). The operator chip is a circle `r=14` centered on the junction `(busX, parentMid)`, drawn **on top** of the bus. Add a driver by stacking it in its level column and extending the vertical bus; deepen a branch with an `x=720` column. Tint by depth with `.lvl-1` / `.lvl-2` / `.lvl-3`.
- **CSS classes**: `.kt`, `.kt-title`, `.kt-conn`, `.kt-box`(+`.lvl-1`/`.lvl-2`/`.lvl-3`), `.kt-name`, `.kt-val`, `.kt-op` (chip), `.kt-op-sym` (operator glyph). primitive: `.card-outlined`.
- **token**: `--accent`, `--bg-card`, `--border-default`, `--text-primary/-secondary`, `--font-mono`, `--dur-fast`, `--ease`.
- **INTERACTION**: none (static). Hover warms a node's hairline toward the accent (paint-only; disabled under `prefers-reduced-motion`). `role="img"` + `<title>`. Connectors are plain lines - **no arrowheads / no marker ids**.
- **when to use**: decomposing a top metric into the drivers that mathematically produce it, with operator chips showing the combination. Use `org-chart` for a people/units reporting hierarchy, `tree` for a collapsible label outline, `mindmap` for radial brainstorming without operators.
- **lineage**: v3 diagrams expansion.

## `journey-map.html`

- **PURPOSE**: User journey map. A row of stage columns, an emotion curve (SVG polyline with a dot per stage, `y` = sentiment score), then aligned touchpoint and pain-point rows - so "what the user does" and "where it hurts" read against the same stages. The emotion line is `--accent`; pain chips read in the `--color-danger` register. For onboarding, purchase, support, or service-blueprint flows.
- **VARIABLES**: `{{TITLE}}` + `{{N}}` (stage count, sets `--jm-cols`) + per stage `{{STAGE}}` + emotion `{{POINTS}}` (polyline `"x,y …"` in a 0–100 box) and per dot `{{X_PCT}}` `{{Y_PCT}}` `{{EMO_LABEL}}` (tone `jm-emo-pos` | `-neu` | `-neg`) + per stage `{{TOUCHPOINT}}` and `{{PAINPOINT}}`.
  - **GEOMETRY**: the emotion box is a 0–100 square stretched to the band (`preserveAspectRatio="none"`; the stroke stays crisp via `vector-effect="non-scaling-stroke"`). For stage `i` of `N`: `X_PCT = (i + 0.5)/N·100`; `Y_PCT = 85 − (score − 1)/(SCORE_MAX − 1)·70` (higher sentiment sits higher / smaller `y`). Dots are CSS, positioned `left:X_PCT% top:Y_PCT%`, so they land on the polyline vertices.
- **CSS classes**: `.journey`, `.journey-title`, `.jm-band-title`, `.jm-grid`(+`.jm-stages`), `.jm-stage`, `.jm-stage-n`, `.jm-stage-name`, `.jm-emotion`, `.jm-line`, `.jm-dot`, `.jm-dot-face`(+`.jm-emo-pos`/`-neu`/`-neg`), `.jm-cell`(+`.jm-touch`/`.jm-pain`(+`.is-empty`)). primitive: `.card-outlined`.
- **token**: `--accent`, `--color-success`, `--color-danger`, `--bg-muted`, `--bg-surface`, `--text-*`, `--border-subtle`, `--radius-*`, `--sp-*`.
- **INTERACTION**: none (static). The emotion SVG has `role="img"` + `<title>`; stage / touchpoint / pain cells are real text; the figure carries `aria-label`. Keep the stage header, emotion band, and both grids at `--jm-cols` so their columns line up (3–5 stages).
- **variants**: none.
- **lineage**: unified-system original (diagram/report).

## `chart-scatter.html`

- **PURPOSE**: Self-contained SVG scatter / bubble chart (no external library). Points (fixed radius) or bubbles (radius ∝ a third value) plotted on X and Y axes with ticks + axis titles, series colored `--cat-1..5`, plus optional dashed median lines that split the field into quadrants. For correlation, distribution, effort-vs-impact, and risk maps.
- **VARIABLES**: `{{TITLE}}` `{{X_AXIS}}` `{{Y_AXIS}}` (axis titles) + axis ticks `{{X_MIN}}` `{{X_MID}}` `{{X_MAX}}` `{{Y_MIN}}` `{{Y_MID}}` `{{Y_MAX}}` + per point `{{CX}}` `{{CY}}` `{{R}}` `{{CAT}}` (`cat-1..5`) `{{LABEL}}` `{{VALUE}}` + optional split px `{{MEDIAN_X}}` `{{MEDIAN_Y}}` + legend `{{SERIES}}`.
  - **SCALING**: plot box is `x∈[56,700]` (width 644) and `y∈[40,300]` (height 260, baseline 300). `CX = 56 + (vx − X_MIN)/(X_MAX − X_MIN)·644`; `CY = 300 − (vy − Y_MIN)/(Y_MAX − Y_MIN)·260`. Point `R = 5` fixed; **bubble** (variant) `R = 5 + (vz / Z_MAX)·21` → 5–26px. Median split px reuse the same CX/CY formula on the median value.
- **CSS classes**: `.scatter`, `.scatter-title`, `.grid-line`, `.axis`, `.tick`, `.axis-label`, `.median`, `.pt`(+`.cat-1..5`), `.scatter-legend`, `.lg`, `.lg-dot`(+`.cat-1..5`). primitive: `.card-outlined`.
- **token**: `--cat-*`, `--accent`, `--text-*`, `--border-subtle`, `--border-default`, `--bg-surface`, `--radius-pill`.
- **INTERACTION**: `[data-chart-tip]` on the `<figure>` + `data-tip="{{LABEL}}: {{VALUE}}"` on each point → `HA.tooltip` floating tooltip (interactions.js, no per-module script). CSS hover brightens the point and fades the rest; transitions are paint-only (never `r`). `role="img"` + per-point `<title>` keep values accessible.
- **variants**: `point` (default, fixed `R=5`) / `bubble` (`R` ∝ a third value) - geometry only; colors stay token-only.
- **lineage**: `html-visual` (chart/dashboard).

## `chart-waterfall.html`

- **PURPOSE**: Self-contained SVG waterfall chart (no external library). A start bar, a run of floating increment (`+`, `--color-success`) / decrement (`−`, `--color-danger`) bars each rising from the running total, a final total bar (`--accent`), thin dashed connectors bridging the bars, and a value label per bar. For P&L bridges, budget variance, headcount deltas, and cohort build-ups.
- **VARIABLES**: `{{TITLE}}` + start bar `{{X0}}` `{{Y0}}` `{{H0}}` `{{START_LABEL}}` `{{START_VALUE}}` + per delta bar `{{X}}` `{{Y}}` `{{H}}` `{{VALUE}}` `{{LABEL}}` and its connector `{{X_END}}` `{{Y_CONN}}` `{{NEXT_X}}` (tone class `is-up` | `is-down`) + total bar `{{XN}}` `{{YN}}` `{{HN}}` `{{TOTAL_LABEL}}` `{{TOTAL_VALUE}}`.
  - **GEOMETRY**: baseline `y=280`, plot top `y=40` (240px range). `MAX` = peak running total; `yOf(v) = 280 − v/MAX·240`. Start / total bar (absolute `v`): `Y = yOf(v)`, `H = v/MAX·240`. Delta bar over the running total `Cprev→Cnew`: `top = max(Cprev,Cnew)`, `Y = yOf(top)`, `H = |Cnew − Cprev|/MAX·240`. Connector: dashed line at `Y_CONN = yOf(Cnew)` from this bar's right edge (`X_END`) to the next bar's left edge (`NEXT_X`); bars are 64px wide.
- **CSS classes**: `.waterfall`, `.waterfall-title`, `.grid-line`, `.axis`, `.bar`(+`.is-start`/`.is-up`/`.is-down`/`.is-total`), `.connector`, `.val`, `.cat`. primitive: `.card-outlined`.
- **token**: `--accent`, `--color-success`, `--color-danger`, `--text-*`, `--border-subtle`, `--border-default`, `--bg-muted`.
- **INTERACTION**: `[data-chart-tip]` on the `<figure>` + `data-tip="{{LABEL}}: {{VALUE}}"` on each bar → `HA.tooltip` floating tooltip. CSS hover brightens the bar (paint-only). `role="img"` + per-bar `<title>` keep values accessible.
- **variants**: none.
- **lineage**: `html-visual` (chart/dashboard).

## `treemap.html`

- **PURPOSE**: Area-proportional treemap (**pure CSS, no SVG**). Big categories become columns whose width ∝ the category's share of the whole; inside each, tiles stack with height ∝ the tile's share of its category - so a tile's area ≈ its share of the grand total. Each tile carries a label + value and a `--cat-N` wash; text on tiles too small to hold it is hidden. For budget mix, portfolio weight, storage / traffic breakdowns, and market share.
- **VARIABLES**: `{{TITLE}}` + per category `{{COL_PCT}}` (column width %) + per tile `{{TILE_PCT}}` (tile height %), `{{CAT}}` (`cat-1..5`), `{{LABEL}}`, `{{VALUE}}`.
  - **USAGE / SCALING**: `COL_PCT = round(categoryTotal / grandTotal · 100)`; `TILE_PCT = round(value / categoryTotal · 100)` → tile area ≈ `COL_PCT% × TILE_PCT%` ≈ `value / grandTotal`. All `%` are computed from **value / total**. Add `.is-tiny` to any tile too small for its value line (hides the value, keeps the clipped label).
- **CSS classes**: `.treemap`, `.treemap-title`, `.tm-canvas`, `.tm-col`, `.tm-tile`(+`.cat-1..5`, +`.is-tiny`), `.tm-label`, `.tm-value`. primitive: `.card-outlined`.
- **token**: `--cat-1..5`, `--bg-card`, `--text-*`, `--border-subtle`, `--radius-sm`, `--sp-*`. Tiles mix the `--cat-N` fill over `--bg-card` (`color-mix`) so `--text-primary` stays legible in any theme.
- **INTERACTION**: none (static). `@media (hover: hover)` brightens a tile on hover. Section carries `aria-label`; labels and values are real text (no SVG).
- **variants**: none.
- **lineage**: unified-system original (dashboard/report).

## `spectrum.html`

- **PURPOSE**: One-dimensional spectrum / scale (**pure CSS, no SVG**). A horizontal diverging track labeled at each end (e.g. Conservative ↔ Aggressive) with one or more position markers (`▼` caret + name) placed at `left:PCT%`. For putting several things on **one** axis: maturity, risk tolerance, sentiment, temperature, build-vs-buy stance.
- **VARIABLES**: `{{TITLE}}` + end captions `{{LEFT_LABEL}}` `{{RIGHT_LABEL}}` + per marker `{{PCT}}` (0 = left end … 100 = right end), `{{NAME}}`.
  - **SCALING**: `PCT = round((position − MIN)/(MAX − MIN)·100)`. `left:PCT%` is the caret's center (`translateX(−50%)`). Add `.is-lifted` to a marker whose label would collide with a neighbour to raise it a row (a longer drop line reconnects it to the track).
- **CSS classes**: `.spectrum`, `.spectrum-title`, `.sp-scale`, `.sp-track`, `.sp-ends`, `.sp-marker`(+`.is-lifted`), `.sp-name`, `.sp-caret`. primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-5`, `--bg-muted`, `--bg-surface`, `--text-*`, `--border-subtle`, `--radius-pill`, `--sp-*`. The track is a `--cat-5` → neutral → `--accent` gradient (`color-mix`), so it follows the theme.
- **INTERACTION**: none (static). `@media (hover: hover)` brightens a marker on hover. Section carries `aria-label`; end labels and names are real text; carets are `aria-hidden`.
- **variants**: none.
- **lineage**: unified-system original (report/decision).

## `quadrant.html`

- **PURPOSE**: A **2×2 positioning matrix / map** (pure CSS - no SVG). A square canvas is split by a dashed accent center cross into four quadrants, each faintly named; items are plotted as pills at an X/Y percent position and color-coded by `--cat-N`. Both axes carry a dimension name plus a low/high end label. For priority matrices (importance × urgency / Eisenhower), effort × impact, competitive/product positioning. Distinction: `heatmap` shades a labeled grid by one value per cell; `risk-matrix` is the probability × impact severity specialization; `quadrant` is the generic continuous two-axis field with plotted points.
- **VARIABLES**: `{{TITLE}}` + axes `{{X_AXIS}}` `{{X_LOW}}` `{{X_HIGH}}` `{{Y_AXIS}}` `{{Y_LOW}}` `{{Y_HIGH}}` + quadrant names `{{QUADRANT_TL}}` `{{QUADRANT_TR}}` `{{QUADRANT_BL}}` `{{QUADRANT_BR}}` + per item `{{ITEM}}` with inline `left:X%` / `top:Y%` and a `.cat-N` class.
  - **PLACEMENT**: `left%` = the X-axis value (0→100 = `X_LOW`→`X_HIGH`); `top%` = `100 −` the Y-axis value, so a higher Y sits nearer the top. `translate(-50%,-50%)` centers each chip on its point.
- **CSS classes**: `.qd`, `.qd-title`, `.qd-frame`, `.qd-ax-y`, `.qd-ax-x`, `.qd-dim`, `.qd-end`, `.qd-canvas`, `.qd-quad`(+`.qd-tl`/`-tr`/`-bl`/`-br`), `.qd-item`(+`.cat-1..5`). primitive: `.card-outlined`.
- **token**: `--cat-1..5`, `--accent`, `--bg-surface`, `--border-default`, `--text-primary/-secondary/-muted`, `--radius-*`, `--sp-*`, `--shadow-*`, `--font-mono`.
- **INTERACTION**: none (static). `aria-label` on the figure; axis / quadrant / item labels are real text. Chip hover deepens its tint + lifts the shadow (paint only, reduced-motion guarded).
- **lineage**: unified-system original (decision/strategy).

## `pyramid.html`

- **PURPOSE**: Self-contained **SVG layered pyramid** (no external libs). 3–5 stacked trapezoid bands (the apex band is a triangle) narrowing to the top, each with a centered label and an optional right-side supplement drawn on a dashed leader line. Each band's `--accent` color-mix density steps per layer so the hierarchy also reads as tone. For Maslow-style hierarchies, strategy→tactics→execution, the test pyramid. Distinction: `funnel` tapers by a measured value with conversion %; `pyramid` tapers to encode a qualitative level hierarchy.
- **VARIABLES**: `{{TITLE}}` + per layer `{{LAYER_LABEL}}` `{{LAYER_NOTE}}` and its inline `--d` density.
- **GEOMETRY**: `cx=210`, `apexY=24`, `baseY=312`, `halfBase=180` → base spans `x=30…390`. At height `y` the half-width `hw(y)=halfBase·(y−apexY)/(baseY−apexY)`. A band from `yTop→yBot` is the polygon `"cx−hw(yTop),yTop  cx+hw(yTop),yTop  cx+hw(yBot),yBot  cx−hw(yBot),yBot"`; the top band collapses `hw(apexY)=0` to a triangle. For N equal layers, step `y` by `(baseY−apexY)/N`. Leader: from `(cx+hw(midY),midY)` → `(430,midY)` with the note text at `x=438`.
- **CSS classes**: `.pyr`, `.pyr-title`, `.pyr-band` (fill = `color-mix(--accent var(--d), --bg-surface)`), `.pyr-label`, `.pyr-lead`, `.pyr-note`. primitive: `.card-outlined`.
- **token**: `--accent`, `--bg-surface`, `--border-default`, `--text-primary/-secondary`, `--sp-*`, `--font-mono`.
- **INTERACTION**: none (static). `role="img"` + `<title>`. Band hover raises its density mix (paint only, reduced-motion guarded).
- **lineage**: unified-system original (strategy/hierarchy).

## `venn.html`

- **PURPOSE**: Self-contained **SVG Venn diagram** (no external libs, no `mix-blend`). Two or three translucent circles (fill = `--cat-N` mixed with `transparent`, so overlaps deepen by plain alpha compositing) with a set label per circle and a label in each intersection. For overlapping concepts, shared responsibility, skill-set / role overlap, scope intersections, the "sweet spot". Distinction: `mindmap` branches a topic into a tree, `chart-donut` splits a total with no overlap; `venn`'s whole point is the overlapping region.
- **VARIABLES**: `{{TITLE}}` + per set `{{SET_LABEL}}` + per overlap `{{OVERLAP_LABEL}}`.
- **GEOMETRY**: 3-set arrangement (`viewBox="0 0 460 360"`) - `cx=230,cy=175`; circle `r=104`; centers at apex / lower-left / lower-right: `A=(230,115)` `B=(176,205)` `C=(284,205)`. Set labels sit outside the shared core; pairwise labels at the lens midpoints (`A∩B (168,144)`, `A∩C (292,144)`, `B∩C (230,242)`), triple at `(230,180)`. For a 2-set diagram delete circle `C`.
- **CSS classes**: `.venn`, `.venn-title`, `.venn-set`(+`.cat-1..5`, translucent fill + firm stroke), `.venn-label`, `.venn-cross`. primitive: `.card-outlined`.
- **token**: `--cat-1..5`, `--bg-surface`, `--border-default`, `--text-primary/-secondary`, `--font-mono`, `--sp-*`.
- **INTERACTION**: none (static). `role="img"` + `<title>`. On `svg:hover` sibling sets fade and the hovered set fills fully (paint only, reduced-motion guarded).
- **lineage**: unified-system original (concept/overlap).

## `before-after.html`

- **PURPOSE**: An **As-Is → To-Be transformation diagram** (pure CSS grid - no SVG). A left "current state" panel of problem chips (danger-toned `✕` markers), a large central transform arrow (a danger→success gradient shaft + solid head) carrying an improvement-summary label, and a right "target state" panel of outcome chips (success-toned `✓` markers). This is a state-**transition** explainer (one story, two states) - distinct from review-mode before/after, which diffs one screen's two renderings, and from `diff-block`, which annotates a code hunk.
- **VARIABLES**: `{{TITLE}}`; `{{BEFORE_TAG}}` `{{BEFORE_TITLE}}` + per `{{BEFORE_ITEM}}`; `{{TRANSFORM_LABEL}}` (the improvement summary); `{{AFTER_TAG}}` `{{AFTER_TITLE}}` + per `{{AFTER_ITEM}}`.
- **CSS classes**: `.ba`, `.ba-title`, `.ba-grid` (`1fr auto 1fr`, restacks to one column ≤640px), `.ba-panel`(+`.ba-before`/`.ba-after` state rails), `.ba-head`, `.ba-tag`, `.ba-list`, `.ba-chip`(+`.ba-neg`/`.ba-pos`), `.ba-arrow`, `.ba-arrow-shape` (CSS shaft + triangle head; rotates 90° when stacked), `.ba-arrow-label`. primitive: `.card-outlined`.
- **token**: `--color-danger`, `--color-success`, `--accent`, `--on-accent`, `--bg-surface`, `--border-default/-subtle`, `--text-primary/-secondary`, `--radius-*`, `--sp-*`, `--shadow-sm`.
- **INTERACTION**: none (static). `aria-label` on the figure; both panels are real text and the arrow shape is `aria-hidden`. Chip hover tints the row by state color (paint only, reduced-motion guarded).
- **lineage**: unified-system original (transformation/narrative).

## `risk-matrix.html`

- **PURPOSE**: A **probability × impact risk matrix** (pure CSS grid - no SVG). A 5×5 (or 3×3) heat grid whose cell tint steps `--color-success → warning → danger` by severity band, with risk-item chips dropped into their cells and a dimension label on each axis. For risk registers, threat assessment, issue triage. Distinction from `heatmap`: heatmap encodes one continuous numeric magnitude per cell, whereas here the tint is a discrete qualitative severity band and cells hold named risk chips.
- **VARIABLES**: `{{TITLE}}`; `{{X_AXIS}}` (impact) + per column `{{IMPACT_LABEL}}`; `{{Y_AXIS}}` (probability) + per row `{{PROB_LABEL}}`; per cell a severity class `.rm-s1..s5` and `0+` `{{RISK}}` chips.
  - **SEVERITY**: `.rm-s1..s5` set `--sev` (s1 = `--color-success` … s5 = `--color-danger`; s2/s4 blend the adjacent colors). Cell bg = `color-mix(--sev 20%, --bg-surface)`. A common map is `band = clamp(round(prob×impact / 5), 1, 5)`. Order rows high→low probability (top row = highest).
- **CSS classes**: `.rm`, `.rm-title`, `.rm-frame`, `.rm-axis-y` / `.rm-axis-x` (dimension labels), `.rm-grid` (`auto repeat(5,1fr)`), `.rm-corner`, `.rm-colhead`, `.rm-rowhead`, `.rm-cell`(+`.rm-s1..s5`), `.rm-chip`. primitive: `.card-outlined`.
- **token**: `--color-success/-warning/-danger`, `--bg-surface`, `--border-default`, `--text-primary/-secondary/-muted`, `--radius-*`, `--sp-*`, `--font-mono`.
- **INTERACTION**: none (static). `aria-label` on the figure; axis labels, headers, and risk chips are real text. Cell hover firms its `--sev` ring (paint only, reduced-motion guarded).
- **lineage**: unified-system original (risk/assessment).


---

# v4 modules (18 added - expressiveness pass 2)

18 hand-pasted modules (`section: (manual)` in the index) added to widen the diagram vocabulary: cause analysis, quantity flows, branching decisions, radial/containment structures, opposing forces, two-point/rank/distribution/composition charts, and strategy & voice document blocks. Same contract as every other module: semantic tokens only, self-contained, ≤150 lines, SVG carries `role="img"` + `<title>`.

## `fishbone.html`

- **PURPOSE**: Self-contained **SVG Ishikawa (cause-and-effect / fishbone) diagram** (no external libs). A horizontal spine drives into a problem-statement **head box on the right**; four angled major bones (2 up, 2 down) each carry a `--cat` category label at the tip plus 2–3 rib lines of cause labels. For root-cause analysis grouped by category (6M / people-process-tools, defect drivers). Distinction: `mindmap` radiates ideas from a topic and `org-chart`/`tree` nest a hierarchy - fishbone attributes many **CAUSES** (grouped) to one **EFFECT**.
- **VARIABLES**: `{{TITLE}}`; effect `{{EFFECT}}`; per bone `{{CATEGORY}}`; per rib `{{CAUSE}}`.
- **GEOMETRY**: viewBox `0 0 760 420`. Spine `y=210` from `x=40→606` into a head rect `x=606 y=174 w=150 h=72`. Bones angle back from the head at slope `±0.5`: a top bone at spine `x=ax` runs `(ax,210)→(ax-70,70)`, a bottom bone `(ax,210)→(ax-70,350)`. Along a top bone the x at height `y` is `ax-70+0.5·(y-70)`; a rib is a short horizontal tick from that point leftward, cause text **end-anchored** at the tick's left tip. Category text sits past the tip (`y=58` top / `y=368` bottom). Add a bone by picking a free spine `x` + `cat-N`; add a rib by ticking the bone at a new `y`.
- **CSS classes**: `.fb`, `.fb-title`, `.fb-spine`, `.fb-bone`(+`.cat-1..4`), `.fb-major` (bone, cat-tinted), `.fb-rib`, `.fb-cat`, `.fb-cause`, `.fb-head`, `.fb-head-label`. primitive: `.card-outlined`.
- **token**: `--cat-1..4`, `--accent`, `--bg-card`, `--border-default`, `--text-primary/-secondary`, `--font-mono`, `--dur-fast`, `--ease`.
- **INTERACTION**: none (static). Hover thickens a bone + its ribs (paint/width only, `prefers-reduced-motion` guarded). `role="img"` + `<title>`. No arrowheads → no marker ids.
- **lineage**: unified-system original (v4 expressiveness pass).

## `sankey.html`

- **PURPOSE**: Self-contained **simplified SVG Sankey / flow-quantity diagram** (no external libs). A left column of source node bars and a right column of target node bars; each flow is a **cubic-bezier ribbon whose stroke-width encodes its quantity** and whose color is the source node's `--cat` tint at low opacity (`color-mix`). Node bars carry a name + value. For budget allocation, traffic split, energy/material balance, conversion-by-source. Distinction: `flow-diagram` shows sequence/logic and `funnel` is one shrinking pipeline - sankey **SPLITS and MERGES** quantities across parallel branches.
- **VARIABLES**: `{{TITLE}}`; per node `{{NODE}}` + `{{VALUE}}`; ribbons are sized by stroke-width.
- **GEOMETRY**: viewBox `0 0 760 420`, scale **3px per unit**. Source bars `x=40 w=24` (right edge 64); target bars `x=696 w=24` (left edge 696). A node's bar height = its total (Σ flows). Stack a node's flows into slices top→bottom; a ribbon leaves/enters at its slice **center** with `stroke-width` = slice height. Ribbon path `M 64,ys C 380,ys 380,yt 696,yt` (control x = mid 380). Sources end-anchored at `x=34`, targets start-anchored at `x=726`. **3-COLUMN**: add a middle bar column (e.g. `x=368`) and route source→mid ribbons ending at `x=344`, then mid→target from `x=392`.
- **CSS classes**: `.sk`, `.sk-title`, `.sk-flow`(+`.cat-1..3`, `--fc` sets ribbon color), `.sk-node`(+`.cat-1..3` sources / `.sk-target` targets), `.sk-name`, `.sk-val`, `.sk-col`. primitive: `.card-outlined`.
- **token**: `--cat-1..3`, `--accent`, `--bg-card`, `--border-default`, `--text-primary/-secondary/-muted`, `--font-mono`, `--dur-fast`, `--ease`.
- **INTERACTION**: none (static). Hover deepens a ribbon's opacity (paint only, `prefers-reduced-motion` guarded). `role="img"` + `<title>`. Ribbons carry stroke-width inline as `quantity·3`.
- **lineage**: unified-system original (v4 expressiveness pass).

## `decision-tree.html`

- **PURPOSE**: A **left-to-right decision tree** (pure CSS - no SVG). A root **question** node fans through labeled condition edges (yes/no or custom) into intermediate question nodes and finally into **leaf outcome** nodes tinted by verdict (`success` / `warning` / `danger`). Built from nested flex "trees": each node is followed by a `.dt-children` column of `.dt-branch` rows, and every branch carries a condition pill on the path. For eligibility rules, triage flows, "if X then Y" policy trees. Distinction: `flow-diagram` is a general process with arbitrary shapes; `tree` (interactive) is a collapsible file/outline - decision-tree encodes branching **CONDITIONS** resolving to typed **OUTCOMES**.
- **VARIABLES**: `{{TITLE}}`; per question `{{QUESTION}}`; per edge `{{CONDITION}}`; per leaf `{{OUTCOME}}` (+ tint class `dt-ok` / `dt-warn` / `dt-danger`).
- **SCALING**: nesting = depth. A `.dt-tree` is a flex row `[node | .dt-children]`; each child is a `.dt-branch` (flex row) holding a `.dt-edge` condition pill then either another `.dt-tree` or a leaf `.dt-node`. The pill's `::before`/`::after` are the horizontal connector stubs; `.dt-children`'s left spine joins the branches. `align-items:center` keeps a parent centered against its subtree. Add a branch = one more `.dt-branch`; deepen = nest another `.dt-tree`.
- **CSS classes**: `.dt`, `.dt-title`, `.dt-tree`, `.dt-children` (left spine `::before`), `.dt-branch`, `.dt-node`(+`.dt-q` question / `.dt-ok`/`.dt-warn`/`.dt-danger` leaves), `.dt-edge` (condition pill with connector stubs). primitive: `.card-outlined`.
- **token**: `--accent`, `--color-success/-warning/-danger`, `--bg-surface`, `--bg-card`, `--border-default`, `--text-primary/-secondary`, `--radius-*`, `--sp-*`, `--shadow-*`, `--dur-fast`, `--ease`.
- **INTERACTION**: none (static). Hover lifts a node (paint/shadow only, `prefers-reduced-motion` guarded). `aria-label` on the figure; all nodes and labels are real text. No SVG → no `<title>`.
- **lineage**: unified-system original (v4 expressiveness pass).

## `hub-spoke.html`

- **PURPOSE**: Self-contained **SVG hub-and-spoke (radial) diagram** (no external libs). One central **hub** node with 5–8 peripheral nodes evenly placed on a circle, each joined to the hub by a spoke that can carry a relation label; every arm is tinted by `--cat`. For ecosystems, integration maps, a stakeholder ring, a platform + its satellites. Distinction: `node-graph` is an arbitrary many-to-many network and `mindmap` is a multi-level idea tree - hub-spoke is exactly **ONE center** with direct, single-hop satellites (no peripheral-to-peripheral links).
- **VARIABLES**: `{{TITLE}}`; hub `{{HUB}}`; per arm `{{NODE}}` + optional `{{RELATION}}`.
- **GEOMETRY**: viewBox `0 0 640 600`, center `(320,300)`, ring radius `R=200`. A node at angle `θ` (from top, clockwise) sits at `x=320+R·sinθ, y=300−R·cosθ`; for 6 nodes `θ = 0,60,120,180,240,300°` → `(320,100)(493,200)(493,400)(320,500)(147,400)(147,200)`. Spoke `= M320,300 L node`; relation label at the spoke midpoint `((320+nx)/2,(300+ny)/2)` with a page-colored halo. Node box `120×48` centered on its point; hub circle `r=54`. For N nodes step `θ` by `360/N`.
- **CSS classes**: `.hs`, `.hs-title`, `.hs-arm`(+`.cat-1..5`, `--nc` sets tint), `.hs-spoke`, `.hs-rel`, `.hs-node-box`, `.hs-node-label`, `.hs-hub`, `.hs-hub-label`. primitive: `.card-outlined`.
- **token**: `--cat-1..5`, `--accent`, `--on-accent`, `--bg-card`, `--border-default`, `--text-primary/-secondary`, `--font-mono`, `--dur-fast`, `--ease`.
- **INTERACTION**: none (static). Hovering an arm firms its spoke + node (paint/width only, `prefers-reduced-motion` guarded). `role="img"` + `<title>`. Hub drawn **last** on top of the spoke inner ends.
- **lineage**: unified-system original (v4 expressiveness pass).

## `concentric.html`

- **PURPOSE**: Self-contained **SVG onion / concentric-circles diagram** (no external libs). A labeled **core** at the center wrapped by 3–4 nested rings, each a real `<text>` label with a per-ring `--cat` tint (`color-mix`) that deepens toward the center. For layered scopes / spheres of influence / maturity shells: core→context, self→team→org→market, data→model→product. Distinction: `pyramid` ranks layers vertically by breadth and `venn` shows overlap between sets - concentric encodes **CONTAINMENT** (each ring wholly wraps the ones inside it).
- **VARIABLES**: `{{TITLE}}`; core `{{CORE}}`; per ring `{{RING_LABEL}}` (+ inline `--ri` density).
- **GEOMETRY**: viewBox `0 0 520 520`, center `(260,260)`. Circles are filled **largest-first** (painter's algorithm) so each smaller circle carves the next band: radii `240 / 180 / 120 / core 60`. A band between `r_out` and `r_in` shows a mid-band label at the **top**: `y = 260 − (r_out+r_in)/2` → outer `50`, mid `110`, inner `170`; core label at center `(260,260)`. For 3 rings drop the `r=120` circle and relabel; step radii evenly if you change the count.
- **CSS classes**: `.cc`, `.cc-title`, `.cc-ring`(+`.cat-2..4`, `--rc` color + inline `--ri` density), `.cc-core`, `.cc-label`, `.cc-core-label`. primitive: `.card-outlined`.
- **token**: `--cat-2..4`, `--accent`, `--on-accent`, `--bg-surface`, `--text-primary`, `--dur-fast`, `--ease`.
- **INTERACTION**: none (static). Hovering a ring deepens its tint (paint only, `prefers-reduced-motion` guarded). `role="img"` + `<title>`.
- **lineage**: unified-system original (v4 expressiveness pass).

## `force-field.html`

- **PURPOSE**: A **Lewin force-field analysis** (pure CSS - no SVG). A central vertical bar names the change/goal; a left column of **driving** forces are arrow bars pointing right (toward the change) and a right column of **restraining** forces are arrow bars pointing left. Each force carries a label and a strength **1–5** set via an inline `--s` custom property that scales the bar's length. Driving = `success` tint, restraining = `danger` tint. For change-readiness, go/no-go tension, adoption barriers vs pulls. Distinction: `before-after` contrasts two states and `pros-cons` (peer module) lists arguments as text - force-field visualizes **OPPOSING forces with MAGNITUDE** pushing on a single change.
- **VARIABLES**: `{{TITLE}}`; `{{CHANGE}}`; column heads `{{DRIVE_HEAD}}` `{{RESTRAIN_HEAD}}`; per force `{{FORCE}}` + `{{STRENGTH}}` with inline `--s` (1–5).
- **SCALING**: 3-column grid `[driving | change bar | restraining]`. A bar's width = `calc(24px + var(--s)·30px)`, so strength `1→54px … 5→174px`. Driving bars right-align so their arrow tips meet the center bar; restraining bars left-align so theirs do too. Arrowheads are `clip-path` polygons (right- or left-pointing). Set the shown `{{STRENGTH}}` number to match `--s`.
- **CSS classes**: `.ff`, `.ff-title`, `.ff-grid`, `.ff-head`(+`.ff-head-drive`/`.ff-head-restrain`), `.ff-center` (vertical change bar), `.ff-side`(+`.ff-drive`/`.ff-restrain`), `.ff-force`, `.ff-label`, `.ff-bar` (arrow, `--s` sizes width). primitive: `.card-outlined`.
- **token**: `--color-success`, `--color-danger`, `--accent`, `--bg-surface`, `--border-default`, `--text-primary/-secondary`, `--radius-*`, `--sp-*`, `--shadow-*`, `--font-mono`, `--tracking-tight`, `--dur-fast`, `--ease`.
- **INTERACTION**: none (static). Hover brightens a force bar (paint only, `prefers-reduced-motion` guarded). `aria-label` on the figure; labels + strengths are real text. No SVG → no `<title>`.
- **lineage**: unified-system original (v4 expressiveness pass).

## `slope-chart.html`

- **PURPOSE**: Self-contained **SVG slope chart** (no external libs). Two vertical axes - a "before" and an "after" column (e.g. 2025 vs 2026) - with one straight line per item connecting its two values; rising lines are success-tinted, falling danger-tinted, flat muted, and each end carries the item label + value. For ranking/level shifts across exactly TWO points. Distinction: `chart-line` traces a full time series along one axis; `before-after` contrasts two qualitative states with chips; `slope-chart` compares MANY items across two moments so slope = direction of change.
- **VARIABLES**: `{{TITLE}}`; column headers `{{PERIOD_LEFT}}` `{{PERIOD_RIGHT}}`; per item `{{ITEM}}` `{{VALUE_L}}` `{{VALUE_R}}` + inline LY/RY + trend class `slope-up | slope-down | slope-flat`.
- **GEOMETRY**: left axis `x=200`, right axis `x=520`; plot `y 48(top)→312(bottom)`. Map a value with `y = 312 − (v − MIN)/(MAX − MIN) * 264`. Line runs `(200,LY)→(520,RY)` with a dot at each end; left label = name(`x=150`,end) + value(`x=192`,end), right = value(`x=528`,start) + name(`x=562`,start), all centered on the dot's y.
- **CSS classes**: `.slope`, `.slope-title`, `.slope-axis`, `.slope-head`, `.slope-item`(+`.slope-up`/`.slope-down`/`.slope-flat`), `.slope-line`, `.slope-dot`, `.slope-name`, `.slope-val`. primitive: `.card-outlined`.
- **token**: `--color-success`, `--color-danger`, `--text-primary/-secondary/-muted`, `--accent`, `--border-default`, `--font-mono`, `--sp-*`.
- **INTERACTION**: none required. `role="img"` + `<title>`. On `svg:hover` sibling items fade so one slope reads (paint only, reduced-motion guarded).
- **lineage**: unified-system original (v4 expressiveness pass).

## `dot-plot.html`

- **PURPOSE**: A **dot / range plot** (pure CSS - no SVG). One row per category: a label, a horizontal track carrying a min–max range bar, and 1–2 value dots placed by `left%` (inline); a legend maps each dot series (e.g. 現状 vs 目標). For gap analysis, current-vs-target, before/after per category on a shared scale. Distinction: `chart-bar` encodes value as a length FROM ZERO; `chart-bullet` is one measure against qualitative bands; `dot-plot` foregrounds POSITION and the RANGE/gap per category (dumbbell-style).
- **VARIABLES**: `{{TITLE}}`; scale ends `{{SCALE_MIN}}` `{{SCALE_MID}}` `{{SCALE_MAX}}`; per row `{{CATEGORY}}` + range bar inline `left%`/`right%` + per dot inline `left%` (`.dp-dot-a`/`.dp-dot-b`); legend `{{SERIES_A}}` `{{SERIES_B}}`.
- **SCALING**: map a value to a track position with `pct = (v − MIN)/(MAX − MIN) * 100`. Range bar: `style="left:{minPct}%;right:{100−maxPct}%"`. Dot: `style="left:{pct}%"` (`translate(-50%,-50%)` centers it). Reuse MIN/MAX for every row.
- **CSS classes**: `.dp`, `.dp-title`, `.dp-row`, `.dp-label`, `.dp-track`, `.dp-range`, `.dp-dot`(+`.dp-dot-a`/`.dp-dot-b`), `.dp-scale`, `.dp-legend`. primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-1`, `--cat-4`, `--bg-surface`, `--border-subtle`, `--text-secondary/-muted`, `--radius-pill`, `--font-mono`, `--sp-*`, `--shadow-sm`.
- **INTERACTION**: none (static). `aria-label` on the figure; dots grow on hover (reduced-motion guarded). Labels are real text.
- **lineage**: unified-system original (v4 expressiveness pass).

## `waffle.html`

- **PURPOSE**: A **waffle / square-pie chart** (pure CSS - no SVG). A 10×10 grid of 100 cells where each category fills a run of CONSECUTIVE cells (one cell = 1%), tinted `--cat-1..5`; a legend maps color → label + percent. Makes a part-of-100 breakdown countable at a glance. Distinction: `chart-donut` encodes share as arc angle (small slices get hard to read); `progress` is one value against a goal; `waffle` makes each percent a TANGIBLE, countable square.
- **VARIABLES**: `{{TITLE}}`; per legend entry `{{CAT_LABEL}}` `{{CAT_PCT}}` (+ `.cat-N` swatch). Cells carry no text - category boundaries live in the fill order.
- **SCALING**: fill cells row-major (left→right, top→bottom). Give the first `{p1}` cells `.cat-1`, the next `{p2}` cells `.cat-2`, … the counts ARE the percents and must sum to 100. A category of `p%` = `p` cells.
- **CSS classes**: `.wf`, `.wf-title`, `.wf-grid`, `.wf-cell`(+`.cat-1..5`), `.wf-legend`, `.wf-key`, `.wf-pct`. primitive: `.card-outlined`.
- **token**: `--cat-1..5`, `--accent`, `--bg-surface`, `--border-subtle`, `--text-secondary/-muted`, `--radius-xs`, `--font-mono`, `--sp-*`.
- **INTERACTION**: none (static). `aria-label` on the figure; the 100-cell grid is `aria-hidden` (decorative), the legend carries the real labels + percents. Cells brighten on hover (reduced-motion guarded).
- **lineage**: unified-system original (v4 expressiveness pass).

## `boxplot.html`

- **PURPOSE**: Self-contained **SVG box-and-whisker plot** (no external libs). 3–5 vertical boxplots on a shared value axis: min/max whiskers with caps, a Q1–Q3 box (`--cat-N` tinted), a median line, and optional outlier dots; a left Y axis carries mono gridline labels. Summarizes a DISTRIBUTION per category. Distinction: `chart-bar` compares single values as bar length; `chart-scatter` plots every individual point in 2D; `boxplot` condenses a whole distribution (spread + median + outliers) into one glyph per category.
- **VARIABLES**: `{{TITLE}}`; Y ticks `{{Y_MIN}}` `{{Y_MID}}` `{{Y_MAX}}`; per box `{{CATEGORY}}` (+ `.cat-N` and the five y-coords max/Q3/med/Q1/min, optional outlier).
- **GEOMETRY**: Y axis `x=64`; plot `y 40(top)→300(baseline)`. Map a value with `y = 300 − (v − MIN)/(MAX − MIN) * 260`. Box centers spread across the field (example `x=168, 330, 492, 654`). Whisker = vertical line `minY→maxY` at the center; caps ±14px; box = rect `x=cx−30 w=60` from Q3y down to Q1y; median line spans the box width.
- **CSS classes**: `.bp`, `.bp-title`, `.bp-grid`, `.bp-axis`, `.bp-tick`, `.bp-whisker`, `.bp-cap`, `.bp-box`(+`.cat-1..5`), `.bp-median`, `.bp-outlier`, `.bp-cat`, `.bp-box-g`. primitive: `.card-outlined`.
- **token**: `--cat-1..5`, `--accent`, `--text-primary/-secondary/-muted`, `--border-subtle`, `--border-default`, `--bg-surface`, `--font-mono`, `--sp-*`.
- **INTERACTION**: none required. `role="img"` + `<title>`. Boxes brighten on hover (paint only, reduced-motion guarded).
- **lineage**: unified-system original (v4 expressiveness pass).

## `chart-area.html`

- **PURPOSE**: Self-contained **SVG stacked area chart** (no external libs). 2–3 series stacked over 5–7 time points as translucent `color-mix(--cat-N)` bands, each with a visible top edge; x labels + y gridlines. Shows how a TOTAL and its composition evolve continuously. Distinction: `chart-line` overlays independent series on a common baseline; `chart-stacked` is discrete stacked BARS at separate categories; `chart-area` stacks continuous bands so the top edge reads as the running total and each band as its share.
- **VARIABLES**: `{{TITLE}}`; per series a filled `{{AREA_N}}` path + a top-edge `{{EDGE_N}}` polyline; per time point `{{XLABEL}}`; legend `{{SERIES}}`.
- **SCALING**: plot `x 40→700` (6 points at `x=40,172,304,436,568,700`); baseline `y=280`, top `y=40` (240px). Cumulative value → `y = 280 − cum/MAX*240` (MAX = largest stack total). `AREA_N` = top edge (cumₙ) then bottom edge (cumₙ₋₁, reversed) closed; series 1's bottom edge is the baseline `y=280`.
- **CSS classes**: `.ac`, `.ac-title`, `.ac-grid`, `.ac-axis`, `.ac-cat`, `.ac-area`(+`.cat-1..3`), `.ac-edge`(+`.cat-1..3`), `.ac-legend`. primitive: `.card-outlined`.
- **token**: `--cat-1..3`, `--accent`, `--text-muted`, `--border-subtle`, `--border-default`, `--bg-surface`, `--radius-xs`, `--sp-*`.
- **INTERACTION**: none required. `role="img"` + `<title>`. Bands deepen on `svg:hover` (paint only, reduced-motion guarded).
- **lineage**: unified-system original (v4 expressiveness pass).

## `bump-chart.html`

- **PURPOSE**: Self-contained **SVG bump chart / rank trajectory** (no external libs). Y axis is ORDINAL RANK (1 on top → N at the bottom), X is 3–5 time points; one polyline per item connects its rank at each point with a dot at every vertex, and the item label sits at both ends - line crossings read as overtakes. Distinction: `chart-line` plots raw VALUES on a continuous axis; `slope-chart` compares exactly two points; `bump-chart` tracks position in a RANKING across several periods (league tables, priority shifts).
- **VARIABLES**: `{{TITLE}}`; per time point `{{PERIOD}}`; per item `{{ITEM}}` (label at both ends) + a rank polyline (`.cat-N`) with a dot per vertex.
- **GEOMETRY**: time points at `x=160,260,360,460,560`; rank rows `y = 52 + (rank−1)*58` (rank1=52 … rank5=284). A vertex for item at (period i, rank r) is `(x_i, 52+(r−1)*58)`. Left label at the first vertex (`x=148`, end); right label at the last vertex (`x=572`, start). Faint gridline per rank row.
- **CSS classes**: `.bump`, `.bump-title`, `.bump-grid`, `.bump-rank`, `.bump-period`, `.bump-item`(+`.cat-1..5`), `.bump-line`, `.bump-dot`, `.bump-name`. primitive: `.card-outlined`.
- **token**: `--cat-1..5`, `--accent`, `--text-primary/-secondary/-muted`, `--border-subtle`, `--bg-surface`, `--font-mono`, `--sp-*`.
- **INTERACTION**: none required. `role="img"` + `<title>`. On `svg:hover` sibling trajectories fade so one path reads (paint only, reduced-motion guarded).
- **lineage**: unified-system original (v4 expressiveness pass).

## `swot.html`

- **PURPOSE**: A **SWOT analysis board** (pure CSS - no SVG). A fixed 2×2 grid of four strategic cards, each with a tinted header, an S/W/O/T monogram and a bullet list: Strengths (`--color-success`), Weaknesses (`--color-danger`), Opportunities (`--accent`), Threats (`--color-warning`). For strategic reviews, competitive self-assessment, project kick-off framing. Distinction: `quadrant` PLOTS items as points on two continuous axes; `risk-matrix` scores each item by probability × impact; `swot` GROUPS bullet items into four FIXED internal/external × positive/negative categories.
- **VARIABLES**: `{{TITLE}}`; per quadrant `{{HEAD}}` (name) + repeated `{{ITEM}}` bullets.
- **SCALING**: fixed 2×2 CSS grid (`repeat(2,1fr)`), collapses to one column below 640px. Each cell drives its own `--sw-tint` hue so header / monogram / bullet marker / hover stay category-agnostic; the monogram is the first letter of S/W/O/T.
- **CSS classes**: `.sw`, `.sw-title`, `.sw-grid`, `.sw-cell`(+`.sw-s/.sw-w/.sw-o/.sw-t`), `.sw-head`, `.sw-mono`, `.sw-name`, `.sw-list`, `.sw-item`. primitive: `.card-outlined`.
- **token**: `--accent`, `--color-success/-danger/-warning`, `--bg-card`, `--border-default/-subtle`, `--text-primary/-secondary`, `--radius-md/-sm/-pill`, `--sp-*`, `--shadow-sm/-md`, `--dur-fast`, `--ease`.
- **INTERACTION**: paint-only hover deepens each quadrant's own tint and lifts the shadow (reduced-motion guarded). `aria-label` on the figure; S/W/O/T monograms are `aria-hidden`.
- **lineage**: unified-system original (v4 expressiveness pass).

## `pros-cons.html`

- **PURPOSE**: A **pros / cons argument board** for ONE option (pure CSS - no SVG). Under a single topic, two columns: pros on the left (`--color-success` tint, ＋ markers), cons on the right (`--color-danger` tint, − markers); each item may carry a mono weight note, and a footer verdict strip closes the call. For go/no-go writeups, option debriefs, "should we do X" memos. Distinction: `comparison-grid` compares SEVERAL options across attribute rows; `before-after` contrasts two states in time; `decision-matrix` scores options numerically; `pros-cons` argues a SINGLE option's for-vs-against.
- **VARIABLES**: `{{TITLE}}` (the option); per column `{{HEAD}}`; per item `{{POINT}}` + optional `{{WEIGHT}}`; footer `{{VERDICT_LABEL}}` + `{{VERDICT}}`.
- **SCALING**: two equal columns (`1fr 1fr`), stack to one column below 620px. Each column drives its own `--pc-tint` hue and `--pc-mark` glyph (＋ / −), so the shared rules stay side-agnostic.
- **CSS classes**: `.pc`, `.pc-title`, `.pc-cols`, `.pc-col`(+`.pc-pros/.pc-cons`), `.pc-head`, `.pc-sign`, `.pc-list`, `.pc-item`, `.pc-weight`, `.pc-verdict`. primitive: `.card-outlined`.
- **token**: `--accent`, `--color-success/-danger`, `--bg-card`, `--bg-surface`, `--text-primary/-secondary/-muted`, `--border-default/-subtle`, `--font-mono`, `--radius-md/-pill`, `--sp-*`.
- **INTERACTION**: none (static). `aria-label` on the figure; the ＋ / − sign chips are `aria-hidden`; the verdict is a plain paragraph.
- **lineage**: unified-system original (v4 expressiveness pass).

## `persona-card.html`

- **PURPOSE**: A **user-persona card** (pure CSS - no SVG) profiling ONE archetype for UX work: a `--cat-N`-tinted initials avatar, name, a role/age/context meta line, a one-line quote, then three tinted mini-sections - Goals (`--color-success`), Frustrations (`--color-danger`), Behaviors (`--accent`) - plus a row of trait/tool chips. Cards are sized to sit 2–3 across a grid. Distinction: `feature-grid` lists PRODUCT features; `stat-list` shows metric facts; `persona-card` profiles a PERSON archetype.
- **VARIABLES**: section `{{TITLE}}`; per card `{{INITIALS}}` `{{NAME}}` `{{META}}` (role · age · context) `{{QUOTE}}`; per mini-section `{{HEAD}}` + repeated `{{ITEM}}`; per chip `{{TAG}}`.
- **SCALING**: `.psn-grid` = `repeat(var(--psn-cols,2),1fr)`, one column below 780px. The avatar hue follows the card's `.cat-N` (defaults to `--cat-1`); each mini-section drives `--ph-tint` for its heading dot.
- **CSS classes**: `.psn-sec`, `.psn-grid`, `.psn`(+`.cat-1..5`), `.psn-top`, `.psn-avatar`, `.psn-name`, `.psn-meta`, `.psn-quote`, `.psn-block`(+`.psn-goals/.psn-frus/.psn-behav`), `.psn-h`, `.psn-list`, `.psn-tags`. primitives: `.card-outlined`, `.chip`.
- **token**: `--cat-1..5`, `--accent`, `--color-success/-danger`, `--bg-surface`, `--text-primary/-secondary/-muted`, `--border-default`, `--radius-pill`, `--sp-*`, `--type-*`, `--tracking-tight`.
- **INTERACTION**: none (static). `aria-label` on the section; each persona is an `<article>`; avatar initials are `aria-hidden`.
- **lineage**: unified-system original (v4 expressiveness pass).

## `quote-block.html`

- **PURPOSE**: A **pull-quote / testimonial** (pure CSS - no SVG, no image). A large decorative opening quotation mark (CSS `::before` content glyph, `\201C`) sits behind the quote text; an attribution line carries a name, a title and an optional org (mono). An optional `--accent` left rail marks a highlight, and up to two quotes can sit in a row. For testimonials, customer voices, key takeaway lines. Distinction: `callout-box` flags info / warnings; `activity-feed` logs timestamped events; `quote-block` gives VOICE - a named person speaking.
- **VARIABLES**: per quote `{{QUOTE}}` `{{NAME}}` `{{ROLE}}` + optional `{{ORG}}`.
- **SCALING**: `.qb-row` = `repeat(var(--qb-cols,1),1fr)`, one column below 680px. The decorative mark is a typographic `\201C` rendered from `--font-serif`, tinted from `--accent`; add `.qb-accent` for the left rail.
- **CSS classes**: `.qb-row`, `.qb`(+`.qb-accent`), `.qb-text`, `.qb-figcap`, `.qb-name`, `.qb-role`, `.qb-org`. primitive: `.card-outlined`.
- **token**: `--accent`, `--bg-card`, `--text-primary/-secondary/-muted`, `--border-default`, `--font-serif`, `--font-mono`, `--radius-*`, `--sp-*`, `--type-h3/-small`.
- **INTERACTION**: none (static). Each `<figure>` is self-labelled by its `<figcaption>` attribution; the oversized quotation mark is a decorative `::before` glyph (`aria-hidden` by construction).
- **lineage**: unified-system original (v4 expressiveness pass).

## `rating-scale.html`

- **PURPOSE**: A **Likert / rating-scale board** (pure CSS - no SVG). One row per criterion: a label, a discrete 5-step dot scale where the filled dots (`--accent`) show the score, and an optional trailing numeric / verdict text. A header row names the two scale ends (e.g. 弱い ↔ 強い); an optional averaged summary row closes it. For survey results, self-assessments, maturity ratings. Distinction: `progress` shows % toward one goal; `spectrum` places items on a CONTINUOUS axis; `data-table` is raw numbers; `rating-scale` shows DISCRETE ordinal scores across several criteria at a glance.
- **VARIABLES**: `{{TITLE}}`; header `{{SCALE_LABEL}}` `{{VAL_HEAD}}`; scale ends `{{LOW_END}}` `{{HIGH_END}}`; per row `{{LABEL}}` + filled-dot count (`.rs-on`) + optional `{{VAL}}`; summary `{{AVG_LABEL}}` + `{{VAL}}`.
- **SCALING**: every row shares one 3-track grid - label (`1fr`), a fixed `108px` dot rail (5 dots, `space-between`), value (`auto`). The end labels sit in the same `108px` rail so they align to the first / last dot. Score = number of leading `.rs-on` dots (0–5).
- **CSS classes**: `.rs`, `.rs-title`, `.rs-head`, `.rs-ends`, `.rs-row`(+`.rs-avg`), `.rs-label`, `.rs-dots`, `.rs-dot`(+`.rs-on`), `.rs-val`. primitive: `.card-outlined`.
- **token**: `--accent`, `--bg-surface`, `--text-primary/-secondary/-muted`, `--border-default/-subtle`, `--font-mono`, `--radius-pill`, `--sp-*`, `--type-*`, `--dur-fast`, `--ease`.
- **INTERACTION**: paint-only row hover tint (reduced-motion guarded). `aria-label` on the figure; each dot rail is a `role="img"` with an `aria-label` carrying the score, and the trailing value text repeats it.
- **lineage**: unified-system original (v4 expressiveness pass).

## `glossary.html`

- **PURPOSE**: A **term-definition list** (pure CSS - no SVG) in definition-list styling. Each entry: a bold term with an optional abbreviation badge and a mono reading / pronunciation, an optional trailing category chip, then an indented definition paragraph. Rows alternate a subtle tint for scanability. For spec glossaries, domain onboarding, acronym keys, 用語集. Distinction: `data-table` is tabular multi-column data; `checklist` tracks completion; `collapsible` hides long content behind a toggle; `glossary` presents flat TERM → DEFINITION reference pairs.
- **VARIABLES**: `{{TITLE}}`; per entry `{{TERM}}` + optional `{{ABBR}}` + optional `{{READING}}` + optional `{{CATEGORY}}` chip + `{{DEFINITION}}`.
- **SCALING**: single-column `<dl>`; each entry is a `.gl-item` wrapping `<dt>`/`<dd>`. Even rows take a faint `--accent` tint; the definition sits under a soft accent rail; the category chip is pushed to the trailing edge (`margin-left:auto`).
- **CSS classes**: `.gl`, `.gl-title`, `.gl-list`, `.gl-item`, `.gl-term`, `.gl-word`, `.gl-abbr`, `.gl-reading`, `.gl-cat`, `.gl-def`. primitives: `.card-outlined`, `.chip`.
- **token**: `--accent`, `--bg-card`, `--bg-surface`, `--text-primary/-secondary/-muted`, `--border-default/-subtle`, `--font-mono`, `--radius-md/-xs`, `--sp-*`, `--type-body/-small/-caption`, `--shadow-sm`.
- **INTERACTION**: none (static). Semantic `<dl>`/`<dt>`/`<dd>`; the abbreviation badge is a real inline element so it is read alongside the term.
- **lineage**: unified-system original (v4 expressiveness pass).

---

# v5 modules (18 added - high-frequency pass)

The highest-frequency artifact elements - landing pages (hero-cta, pricing-table, faq), reports (toc, agenda, code-snippet), dashboards (histogram, chart-combo, sparkline, pareto, progress-ring, chart-bubble), and project/planning docs (roadmap, process-chevron, layer-stack, story-map, capability-map, raci-matrix).

## `roadmap.html`

- **PURPOSE**: **Pure-CSS product roadmap** (no SVG). A coarse period × theme planning grid: columns are time periods (`Q1..Q4` / `H1..H2`), rows are theme lanes, and colored initiative bars span one or more periods via CSS `grid-column` with `--cat-N` tints. For exec / product roadmaps where WHEN is a quarter-grain band, not a date. Distinction: `gantt` is task-level with precise dates, % progress and dependencies; `timeline` is a single chronological event track; `roadmap` is coarse period×theme planning for exec docs.
- **VARIABLES**: `{{TITLE}}`; `{{N}}` (period count → `--rdm-cols`); per period `{{PERIOD}}`; per lane `{{LANE}}`; per initiative `{{INITIATIVE}}` placed with inline `grid-column` + a `.cat-N` tint.
- **SCALING**: the header and every lane share `grid-template-columns: var(--rdm-lane) repeat(N,1fr)`, so columns stay aligned. Column LINE 1 starts the lane-name gutter; line 2 = period 1, line 3 = period 2 … An initiative over periods `[a,b]` uses `grid-column: (a+1) / (b+2)` (e.g. Q1–Q2 → `2/4`, Q3 only → `4/5`). To stack two bars in one lane, give the second `grid-row:2` (lanes use `grid-auto-rows`).
- **CSS classes**: `.rdm`, `.rdm-title`, `.rdm-head`, `.rdm-corner`, `.rdm-period`, `.rdm-lane`(zebra), `.rdm-lane-name`, `.rdm-bar`(+`.cat-1..5`, `--bc` sets tint). primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-1..5`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-*`, `--font-mono`, `--radius-*`, `--sp-*`, `--shadow-*`, `--dur-fast`, `--ease`, `--tracking-eyebrow`.
- **INTERACTION**: hover brightens an initiative bar (paint-only, `prefers-reduced-motion` guarded). `figure` + `aria-label`; all cells real text.
- **lineage**: unified-system original (v5 high-frequency pass).

## `process-chevron.html`

- **PURPOSE**: **Pure-CSS horizontal chevron / arrow band** (no SVG). 3–6 interlocking right-pointing chevrons form a flat `→→→` pipeline; each carries a stage name and a short caption below it, tinted by `--cat-N`. `clip-path` polygons cut the arrowheads and a negative left margin nests each point into the next notch. For value chains, linear process pipelines, funnel-of-stages. Distinction: `stepper` is a numbered sequential-steps UI; `flow-diagram` has branches / nodes; `funnel` encodes narrowing volume; this is the flat, unnumbered value-chain arrow band.
- **VARIABLES**: `{{TITLE}}`; per stage `{{STAGE}}` (name) + `{{CAPTION}}` (one line) with a `.cat-N` tint; first chevron carries `.pcv-first` (flat left edge).
- **SCALING**: `--pcv-d` sets the arrow depth (default `22px`). Each chevron is `flex:1`. Default `clip-path` is a 6-point polygon (left notch + right point); `.pcv-first` drops the notch for a flat leading edge. Every chevron after the first pulls left by `--pcv-d` so its notch swallows the previous point; left padding clears the notch so text stays centered.
- **CSS classes**: `.pcv`, `.pcv-title`, `.pcv-band`, `.pcv-chev`(+`.pcv-first`, +`.cat-1..5`, `--pc` sets tint), `.pcv-name`, `.pcv-cap`. primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-1..5`, `--bg-surface`, `--border-default`, `--text-primary/-secondary`, `--radius-*`, `--sp-*`, `--dur-fast`, `--ease`.
- **INTERACTION**: hover brightens a chevron (paint-only, `prefers-reduced-motion` guarded). `figure` + `aria-label`; name + caption are real text; `clip-path` is decorative.
- **lineage**: unified-system original (v5 high-frequency pass).

## `layer-stack.html`

- **PURPOSE**: **Pure-CSS horizontal layered stack** (no SVG). Full-width layers stacked top → bottom (tech stack / OSI-style), each with a name in its left gutter and a wrap of item chips in the body; an optional right-side aside carries cross-cutting concern bands (security, observability) spanning the height. For architecture layers, technology stacks, protocol / responsibility tiers. Distinction: `pyramid` is a triangular hierarchy of importance; `arch-diagram` is a boxes-and-arrows topology; `concentric` nests rings around a core; this is flat, equal-width NAMED layers.
- **VARIABLES**: `{{TITLE}}`; per layer `{{LAYER}}` (name) + `{{ITEM}}` chips, tinted `.cat-N`; per cross-cutting concern `{{CONCERN}}` (vertical aside band), tinted `.cat-N`.
- **SCALING**: `.lst-wrap` is a flex row: the layer stack (`flex:1`) plus an optional `.lst-cross` aside. Each `.lst-layer` is a 2-col grid (name gutter `150px` + `1fr` body). Concern bands use `writing-mode: vertical-rl` + `text-orientation: mixed` (never `rotate(180deg)`, which flips upright CJK characters upside-down) and stretch to the stack height. Drop the aside if there are no concerns.
- **CSS classes**: `.lst`, `.lst-title`, `.lst-wrap`, `.lst-stack`, `.lst-layer`(+`.cat-1..5`, `--lc` sets tint), `.lst-name`, `.lst-items`, `.lst-item`, `.lst-cross`, `.lst-concern`(+`.cat-4/5`, `--cc` sets tint). primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-1..5`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-*`, `--font-mono`, `--radius-*`, `--sp-*`, `--shadow-*`, `--tracking-eyebrow`, `--dur-fast`, `--ease`.
- **INTERACTION**: hover brightens a layer (paint-only, `prefers-reduced-motion` guarded). `figure` + `aria-label`; layer names, chips and concern bands are all real text.
- **lineage**: unified-system original (v5 high-frequency pass).

## `story-map.html`

- **PURPOSE**: **Pure-CSS user story map** (no SVG). A backbone row of activities (the user's tasks left → right) tops a grid; under each activity, story cards stack in release rows (MVP / Next / Later) so scope reads as horizontal slices. For release planning, backlog slicing, MVP scoping. Distinction: `journey-map` tracks emotion / touchpoints along stages; `kanban-board` tracks live work status; `roadmap` plans by time period; this is forward-looking scoped RELEASE planning by user activity × release slice.
- **VARIABLES**: `{{TITLE}}`; `{{N}}` (activity count → `--smp-cols`); per activity `{{ACTIVITY}}`; per release `{{RELEASE}}` (row label, tone `.-mvp` | `.-next` | `.-later`); per story `{{STORY}}` card with a `.cat-N` tint.
- **SCALING**: the grid is `var(--smp-rel) repeat(N,1fr)`: a release-label gutter plus N activity columns. Row 1 is the backbone (corner + activity headers). Each release is a row: its label cell in the gutter, then one `.smp-cell` per activity holding 0..n stacked `.smp-card`. Set `--smp-cols = N`.
- **CSS classes**: `.smp`, `.smp-title`, `.smp-grid`, `.smp-corner`, `.smp-activity`, `.smp-rel`(+`.-mvp`/`.-next`), `.smp-cell`, `.smp-card`(+`.cat-1..5`, `--sc` sets rail tint). primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-1..5`, `--color-success`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-*`, `--font-mono`, `--radius-*`, `--sp-*`, `--shadow-*`, `--tracking-eyebrow`, `--dur-fast`, `--ease`.
- **INTERACTION**: hover lifts a story card (paint-only, `prefers-reduced-motion` guarded). `figure` + `aria-label`; backbone, release labels and cards are all real text in a CSS grid.
- **lineage**: unified-system original (v5 high-frequency pass).

## `capability-map.html`

- **PURPOSE**: **Pure-CSS business capability map** (no SVG). 3–4 top-level DOMAIN blocks sit side by side, each with a tinted header and a grid of capability TILES; tiles can carry optional heat via `data-level` (1 mature → success, 2 gap → warning, 3 at-risk → danger). For capability inventories, target operating models, portfolio heat maps. Distinction: `treemap` encodes numeric size by area; `org-chart` shows reporting lines; `feature-grid` is a flat marketing grid; this is a nested COMPETENCE inventory (domains → capabilities) with heat as an optional maturity overlay, not a measured quantity.
- **VARIABLES**: `{{TITLE}}`; `{{N}}` (domain count → `--cpm-cols`); per domain `{{DOMAIN}}` header, tinted `.cat-N`; per tile `{{CAPABILITY}}` with optional `data-level`.
- **SCALING**: `.cpm-grid` is `repeat(N,1fr)` domains. Each domain body is its own 2-col tile grid (`repeat(2,minmax(0,1fr))`). `data-level` tints a tile: `1`=success, `2`=warning, `3`=danger; omit it for a neutral tile. Set `--cpm-cols = N`.
- **CSS classes**: `.cpm`, `.cpm-title`, `.cpm-grid`, `.cpm-domain`(+`.cat-1..5`, `--dc` sets tint), `.cpm-domain-head`, `.cpm-tiles`, `.cpm-tile`(+`[data-level="1|2|3"]` heat). primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-1..5`, `--color-success/-warning/-danger`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-*`, `--radius-*`, `--sp-*`, `--shadow-*`, `--dur-fast`, `--ease`.
- **INTERACTION**: hover brightens a tile (paint-only, `prefers-reduced-motion` guarded). `figure` + `aria-label`; domain headers and tiles are real text; `data-level` adds a color tint only.
- **lineage**: unified-system original (v5 high-frequency pass).

## `raci-matrix.html`

- **PURPOSE**: **Pure-CSS RACI responsibility table** (no SVG). Rows are tasks / deliverables, columns are roles, and each cell holds an R / A / C / I badge in a distinct token color (A = accent solid, R = `--cat-1`, C = `--cat-2`, I = muted); a legend spells out the letters. For responsibility assignment across a team. Distinction: `decision-matrix` SCORES options against weighted criteria; `swimlane` shows the process FLOW handed between roles; `comparison-grid` contrasts items by attribute; this assigns a responsibility LABEL per task×role.
- **VARIABLES**: `{{TITLE}}`; per role column `{{ROLE}}`; per task row `{{TASK}}`; each cell a badge (`.rci-a`/`.rci-r`/`.rci-c`/`.rci-i` or blank); legend meanings `{{R_MEANING}}` `{{A_MEANING}}` `{{C_MEANING}}` `{{I_MEANING}}`.
- **SCALING**: a normal `<table>`: first column = task names (`th scope=row`), one column per role. Each responsibility cell centers one `.rci-badge`. `A` is styled solid (`--accent` + `--on-accent`) so the single Accountable owner reads loudest even where `--cat-1` resolves to the accent hue; `R`/`C` are tinted, `I` is muted. Put exactly ONE `.rci-a` per row.
- **CSS classes**: `.rci`, `.rci-title`, `.rci-scroll`, `.rci-table`, `.rci-corner`, `.rci-task`, `.rci-cell`, `.rci-badge`(+`.rci-a`/`.rci-r`/`.rci-c`/`.rci-i`), `.rci-legend`, `.rci-key`. primitive: `.card-outlined`.
- **token**: `--accent`, `--on-accent`, `--cat-1`, `--cat-2`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-*`, `--font-mono`, `--radius-*`, `--sp-*`, `--shadow-*`, `--dur-fast`, `--ease`.
- **INTERACTION**: hover tints the whole task row (paint-only, `prefers-reduced-motion` guarded). `figure` + `aria-label`; real `<table>` with `th scope=row/col`; badge letters + legend are readable text.
- **lineage**: unified-system original (v5 high-frequency pass).

## `histogram.html`

- **PURPOSE**: Self-contained **frequency histogram** (pure CSS - no SVG). Contiguous vertical bins with NO gaps between bars (the visual signature), each bin a flex column whose height encodes its frequency; an x-axis of bin labels below and an optional dashed mean-marker line across the plot. Shows the SHAPE of a distribution (spread, skew, modality). Distinction: `chart-bar` compares discrete categories with GAPPED bars; `boxplot` condenses a distribution into a five-number quartile glyph; `histogram` draws the full distribution as touching frequency bins.
- **VARIABLES**: `{{TITLE}}`; optional `{{MEAN_LABEL}}`; per bin `{{FREQ}}` (count above the bar) and `{{BIN}}` (x-axis range label).
- **SCALING**: plot height `240px`. Bar `--h = frequency / maxFrequency × 100%`. Bars are contiguous (`flex:1`, no gap); a 1px card-toned `border-right` notches each boundary without opening a gap. Mean marker `left% = (mean − min)/(max − min) × 100`.
- **CSS classes**: `.hgm`, `.hgm-title`, `.hgm-plot`, `.hgm-bars`, `.hgm-bar`(+inline `--h`), `.hgm-freq`, `.hgm-mean`, `.hgm-mean-tag`, `.hgm-axis`, `.hgm-tick`. primitive: `.card-outlined`.
- **token**: `--cat-1`, `--accent`, `--bg-surface`, `--bg-card`, `--text-primary/-secondary/-muted`, `--border-default`, `--font-mono`, `--radius-pill`, `--sp-*`.
- **INTERACTION**: none required. `aria-label` on the figure; counts and bin labels are real text. Bins brighten on hover (paint only, reduced-motion guarded).
- **lineage**: unified-system original (v5 high-frequency pass).

## `chart-combo.html`

- **PURPOSE**: Self-contained **SVG dual-axis combo chart** (no external libs). Bars encode a PRIMARY measure on the left axis; an overlaid line + dots encode a SECONDARY measure with its own right-side axis (different units). Correlates two measures on one canvas - e.g. monthly revenue (bars) vs growth-rate % (line). Distinction: `chart-bar` and `chart-line` each show ONE measure against one axis; `chart-combo` pairs two measures with different scales so their relationship reads at a glance.
- **VARIABLES**: `{{TITLE}}`; axis titles `{{PRIMARY_AXIS}}` `{{SECONDARY_AXIS}}`; left ticks `{{P_MID}}` `{{P_MAX}}`; right ticks `{{S_MID}}` `{{S_MAX}}`; per category `{{CAT}}` `{{P_VALUE}}` (bar) `{{S_VALUE}}` (line point).
- **GEOMETRY**: viewBox `640×360`. Left axis `x=52`, right axis `x=588`, baseline `y=300`, top `y=36` (264px range). 6 category centers spread across: `97,186,275,365,454,543` (bar width 48, `x = center−24`). Bar `H = P_VALUE/P_MAX×264`, `Y = 300−H`. Line point `CY = 300 − S_VALUE/S_MAX×264` at the category center.
- **CSS classes**: `.cmb`, `.cmb-title`, `.grid-line`, `.axis`, `.bar`, `.line`, `.dot`, `.tick`, `.cat`, `.axis-label`. primitive: `.card-outlined`.
- **token**: `--cat-1`, `--cat-4`, `--accent`, `--text-secondary/-muted`, `--border-subtle`, `--border-default`, `--bg-surface`, `--font-mono`, `--sp-*`.
- **INTERACTION**: none required. `role="img"` + `<title>`; per-mark `<title>` tooltips. Bars/dots highlight on hover (paint only, reduced-motion guarded).
- **lineage**: unified-system original (v5 high-frequency pass).

## `sparkline.html`

- **PURPOSE**: A compact **multi-metric scan table** (no external libs). Each row carries a label, the current value, a tiny inline sparkline (per-row polyline SVG ~120×32), and a delta badge (▲/▼ toned success/danger). 3–5 rows let a dashboard show many KPIs' "now + recent shape" in one dense block. Distinction: `stat-trend` is a grid of full KPI cards (one big value + trend each); `chart-line` is a single full-size chart; `sparkline` is the tightest form - one thin row per metric for at-a-glance scanning.
- **VARIABLES**: `{{TITLE}}`; per row `{{LABEL}}` `{{VALUE}}` `{{DELTA}}` (tone the row's sparkline and badge with `-up` = success / `-down` = danger).
- **GEOMETRY**: each sparkline SVG viewBox `0 0 120 32`, pad 3. `x = 3 + i/(n−1)×114`; `y = (32−3) − (v−min)/(max−min)×(32−2·3)` so higher values sit nearer the top. The area path repeats the polyline then drops to `y=29` and closes.
- **CSS classes**: `.spk`, `.spk-title`, `.spk-rows`, `.spk-row`, `.spk-label`, `.spk-value`, `.spk-graph`(+`.-up`/`.-down`), `.s-line`, `.s-area`, `.s-dot`, `.spk-delta`(+`.-up`/`.-down`). primitive: `.card-outlined`.
- **token**: `--accent`, `--color-success`, `--color-danger`, `--text-primary/-secondary`, `--border-subtle`, `--font-mono`, `--sp-*`.
- **INTERACTION**: none (static). Each row's SVG carries `role="img"` + `<title>`; the value is real text so the badge/spark are decorative.
- **lineage**: unified-system original (v5 high-frequency pass).

## `pareto.html`

- **PURPOSE**: Self-contained **SVG Pareto chart** (no external libs). Descending bars encode counts (defects / causes) on the left axis; an overlaid cumulative-percentage line + dots rides a 0–100% right axis, with a dashed 80% reference rule. Sorts causes so the "vital few" that make up most of the effect stand out (80/20). Distinction: `chart-bar` has no cumulative overlay and no forced sort; `funnel` shows stage-to-stage conversion of one flow; `pareto` pairs sorted magnitudes with a cumulative % to locate the 80% threshold.
- **VARIABLES**: `{{TITLE}}`; axis title `{{COUNT_AXIS}}`; left ticks `{{L_MID}}` `{{L_MAX}}`; per category `{{CAT}}` `{{COUNT}}` (bar) `{{CUM}}` (cumulative %, right axis).
- **GEOMETRY**: viewBox `640×360`. Left axis `x=52`, right axis `x=588`, baseline `y=300`, top `y=36` (264px range). 6 category centers: `97,186,275,365,454,543` (bar width 48, `x = center−24`). Bar `H = COUNT/L_MAX×264`, `Y = 300−H`. Cumulative dot `CY = 300 − CUM/100×264`. 80% rule at `y = 300 − 0.8×264 = 88.8 ≈ 89`.
- **CSS classes**: `.prt`, `.prt-title`, `.grid-line`, `.axis`, `.bar`, `.cum-line`, `.cum-dot`, `.ref80`, `.ref80-tag`, `.tick`, `.cat`, `.axis-label`. primitive: `.card-outlined`.
- **token**: `--cat-1`, `--cat-4`, `--accent`, `--color-warning`, `--text-secondary/-muted`, `--border-subtle`, `--border-default`, `--bg-surface`, `--font-mono`, `--sp-*`.
- **INTERACTION**: none required. `role="img"` + `<title>`; per-mark `<title>` tooltips. Bars/dots highlight on hover (paint only, reduced-motion guarded).
- **lineage**: unified-system original (v5 high-frequency pass).

## `progress-ring.html`

- **PURPOSE**: A compact grid of **circular progress rings** (no external libs). 2–4 SVG rings side by side, each a track circle + an arc drawn with `stroke-dasharray`; the centre shows a big % number with a label below. Toned per ring with `--cat-N` so a dashboard row of completion / utilisation ratios reads at a glance. Distinction: `gauge` is a single dial (value against zones); `progress` is a linear bar; `progress-ring` is the multi-widget CIRCULAR % grid - several rings compared side by side, one categorical tone each.
- **VARIABLES**: `{{TITLE}}`; per ring `{{LABEL}}` `{{PCT}}` (0–100, shown centred) and the `stroke-dasharray` "SEG GAP" pair.
- **GEOMETRY**: viewBox `120×120` per ring; track/arc circle `r=52` ⇒ circumference `C = 2·π·52 = 326.73`. `frac = PCT/100`. `SEG = frac·326.73`, `GAP = 326.73 − SEG`. The arc `<circle>` is rotated `−90°` about `(60,60)` so it starts at 12 o'clock. Examples: 72% → `"235.25 91.48"`; 45% → `"147.03 179.70"`; 88% → `"287.52 39.21"`.
- **CSS classes**: `.pgr`, `.pgr-title`, `.pgr-grid`, `.pgr-item`(+`.cat-1..4`), `.pgr-track`, `.pgr-arc`, `.pgr-num`, `.pgr-label`. primitive: `.card-outlined`.
- **token**: `--cat-1..4`, `--bg-muted`, `--text-primary/-secondary`, `--font-mono`, `--radius-*`, `--sp-*`.
- **INTERACTION**: none (static). Each ring SVG carries `role="img"` + `<title>`; the centre % and label are real text. Arc gains a soft tinted shadow on hover (paint only, reduced-motion guarded).
- **lineage**: unified-system original (v5 high-frequency pass).

## `chart-bubble.html`

- **PURPOSE**: Self-contained **SVG bubble chart** (no external libs). A scatter where each point's RADIUS encodes a third measure (e.g. market size), 5–8 labelled bubbles filled with translucent `--cat-N`, X & Y axes with ticks + titles, and optional dashed quadrant midlines. Plots three dimensions at once. Distinction: `chart-scatter` encodes only x/y position (fixed dot size); `chart-bubble` adds magnitude via bubble size and names each bubble in place, so position AND weight read together.
- **VARIABLES**: `{{TITLE}}`; axis titles `{{X_AXIS}}` `{{Y_AXIS}}`; ticks `{{X_MIN}}` `{{X_MID}}` `{{X_MAX}}` `{{Y_MIN}}` `{{Y_MID}}` `{{Y_MAX}}`; per bubble `{{LABEL}}` `{{VALUE}}`.
- **GEOMETRY**: viewBox `640×400`. Plot box `x∈[56,600]` (width 544), `y∈[40,340]` (height 300, baseline 340). `CX = 56 + (vx−X_MIN)/(X_MAX−X_MIN)×544`. `CY = 340 − (vy−Y_MIN)/(Y_MAX−Y_MIN)×300`. `R = 12 + (vz/Z_MAX)×34 → 12..46`. Quadrant midlines at `x=328, y=190` (delete if not splitting the field).
- **CSS classes**: `.bub`, `.bub-title`, `.grid-line`, `.axis`, `.mid`, `.tick`, `.axis-label`, `.bubble`(+`.cat-1..5`, translucent fill + firm stroke), `.b-label`. primitive: `.card-outlined`.
- **token**: `--cat-1..5`, `--accent`, `--text-primary/-secondary/-muted`, `--border-subtle`, `--border-default`, `--font-mono`, `--sp-*`.
- **INTERACTION**: none required. `role="img"` + `<title>`; per-bubble `<title>`. On `svg:hover` siblings recede and the hovered bubble fills fully (paint only, reduced-motion guarded).
- **lineage**: unified-system original (v5 high-frequency pass).

## `faq.html`

- **PURPOSE**: An **always-visible FAQ list** (pure CSS - no SVG, no JS). Each item pairs a round **Q** badge + question heading with a round **A** badge + answer paragraph, separated by thin dividers. For landing-page FAQ sections, product docs, and support pages. Distinction: `collapsible` is the INTERACTIVE accordion that hides answers behind a JS toggle; `glossary` maps short TERMS → definitions; `faq` keeps every Q&A pair open for reading, so it is the static FAQ layout, not a toggle or a lexicon.
- **VARIABLES**: `{{TITLE}}`; per item `{{QUESTION}}` + `{{ANSWER}}`.
- **SCALING**: single-column `<dl>`; each pair is a `.faq-item` wrapping a `<dt>` question and a `<dd>` answer. Badges are fixed 22px accent/neutral circles; the answer indents to align under the question text. Thin dividers between items; the last item drops its rule.
- **CSS classes**: `.faq`, `.faq-title`, `.faq-list`, `.faq-item`, `.faq-q`, `.faq-a`, `.faq-badge`, `.faq-text`. primitive: `.card-outlined`.
- **token**: `--accent`, `--bg-card`, `--bg-surface`, `--text-primary/-secondary/-muted`, `--border-default/-subtle`, `--radius-md/-pill`, `--sp-*`, `--type-body/-small/-caption`, `--shadow-sm`.
- **INTERACTION**: none (static). Semantic `<dl>`/`<dt>`/`<dd>`; the Q/A badges are `aria-hidden` so the question and answer text are read directly.
- **lineage**: unified-system original (v5 high-frequency pass).

## `pricing-table.html`

- **PURPOSE**: A **3-column pricing / plan-selection block** (pure CSS - no SVG, no JS). Each column is a plan card: name, a big price + billing period, a feature checklist (✓ included / – excluded), and a CTA button. The middle plan is highlighted with an accent border, a lift, and a "人気" badge. For SaaS pricing pages. Distinction: `comparison-grid` compares arbitrary options feature-by-feature in a matrix; `feature-grid` showcases capabilities with NO prices; `pricing-table` is the priced, one-card-per-plan layout whose job is to make the reader pick a plan.
- **VARIABLES**: per plan `{{PLAN}}` name, `{{PRICE}}` + `{{PERIOD}}`, `{{FEATURE}}` rows (mark `.prc-no` for excluded), `{{CTA}}` label; `{{TITLE}}` for a11y.
- **SCALING**: 3-column grid collapsing to 1 column under 720px. `.prc-featured` carries the accent border, a −4px lift (reduced-motion resets it), and the `.prc-popular` badge. ✓ / – are text glyphs (not SVG); excluded rows dim + strike through.
- **CSS classes**: `.prc`, `.prc-title`, `.prc-grid`, `.prc-plan`, `.prc-featured`, `.prc-popular`, `.prc-name`, `.prc-price`, `.prc-amount`, `.prc-period`, `.prc-feats`, `.prc-feat`, `.prc-mark`, `.prc-no`, `.prc-cta`. primitives: `.card-outlined`, `.btn`, `.btn-ghost`.
- **token**: `--accent`, `--on-accent`, `--bg-surface`, `--text-primary/-secondary/-muted`, `--border-default/-subtle`, `--color-success`, `--radius-pill`, `--sp-*`, `--type-h1/-h3/-small/-caption`, `--tracking-tight`, `--shadow-sm/-md`, `--dur-*`, `--ease-out`.
- **INTERACTION**: none beyond the `.btn` primitive's own hover (paint + 1px lift, reduced-motion guarded in `elements.css`).
- **lineage**: unified-system original (v5 high-frequency pass).

## `toc.html`

- **PURPOSE**: A **table of contents** (pure CSS - no SVG, no JS). Numbered chapters with a dotted leader running to a page number / anchor label, plus one level of indented subsections. Every row is a real `<a href="#...">` so it doubles as in-document navigation. For reports, specs, handbooks, long docs. Distinction: `glossary` pairs TERMS with prose definitions; `stepper` walks a PROCESS forward step-by-step; `toc` is a two-level navigational index of a document's own sections.
- **VARIABLES**: `{{TITLE}}`; per chapter `{{NUM}}` + `{{CHAPTER}}` + `{{PAGE}}` + `{{ANCHOR}}`; per subsection `{{SUBNUM}}` + `{{SUB}}` + `{{PAGE}}` + `{{ANCHOR}}`.
- **SCALING**: an `<ol>` of chapters; each chapter may nest an `<ol class="toc-subs">`. A row is a flex line: number, label, a flex-growing dotted leader (`.toc-dots` = a dotted `border-bottom`), then the page. Subsections indent under the chapter number column with quieter type. **ROOT EXCEPTION** (spec rule 8): the root is a `<nav aria-label>` - a table of contents IS a navigation landmark, so a semantic `<nav>` beats a `<figure>` here.
- **CSS classes**: `.toc`, `.toc-title`, `.toc-list`, `.toc-chapter`, `.toc-subs`, `.toc-sub`, `.toc-row`, `.toc-num`, `.toc-label`, `.toc-dots`, `.toc-page`. primitive: `.card-outlined`.
- **token**: `--accent`, `--bg-card`, `--text-primary/-secondary/-muted`, `--border-subtle`, `--font-mono`, `--radius-md`, `--sp-*`, `--type-body/-small/-h3`, `--shadow-sm`, `--dur-fast`, `--ease`.
- **INTERACTION**: paint-only hover (row label + page warm toward the accent), reduced-motion guarded. Each row is a keyboard-focusable anchor link.
- **lineage**: unified-system original (v5 high-frequency pass).

## `hero-cta.html`

- **PURPOSE**: A **landing-page hero / conversion block** (pure CSS - no SVG, no JS). An eyebrow label, a large headline with one accent-highlighted span, a supporting sub-lede, a primary + secondary CTA pair, and a small trust note (e.g. 導入実績) below the buttons. For the top-of-page opening of a marketing or product page. Distinction: `callout-box` is an inline notice mid-content; `empty-state` fills a zero-data view with a single recovery action; `hero-cta` is the page-opening block whose job is conversion.
- **VARIABLES**: `{{EYEBROW}}`; `{{HEAD_A}}` + `{{HEAD_MARK}}` (accent span) + `{{HEAD_B}}`; `{{LEDE}}`; `{{CTA_PRIMARY}}` + `{{CTA_SECONDARY}}`; `{{TRUST}}`.
- **SCALING**: centered column, max-width ~640px. Headline uses `--type-display`; the `.hro-mark` span tints to the accent with a soft underline highlight that survives line wraps (`box-decoration-break: clone`). Buttons wrap on narrow screens; the trust note sits quiet under them. **ROOT EXCEPTION** (spec rule 8): the root is a `<section aria-label>` - a hero is a page-level banner region, not a self-contained figure, so a semantic `<section>` is the correct landmark.
- **CSS classes**: `.hro`, `.hro-inner`, `.hro-eyebrow`, `.hro-headline`, `.hro-mark`, `.hro-lede`, `.hro-actions`, `.hro-trust`. primitives: `.btn`, `.btn-ghost`.
- **token**: `--accent`, `--bg-surface`, `--bg-page`, `--text-primary/-secondary/-muted`, `--border-subtle`, `--radius-lg`, `--sp-*`, `--type-display/-body/-caption`, `--tracking-display/-eyebrow`, `--shadow-sm`.
- **INTERACTION**: none beyond the `.btn` primitives' own hover (paint + 1px lift, reduced-motion guarded in `elements.css`).
- **lineage**: unified-system original (v5 high-frequency pass).

## `code-snippet.html`

- **PURPOSE**: A **single syntax-highlighted code listing** (pure CSS - no SVG, no JS, no highlighter lib). A dark-tinted panel (derived from `--text-primary` mixed with the page, so it stays theme-following with NO raw hex), a header bar with a mono filename + a language badge, a line-number gutter, and span classes for token roles (`.cs-kw` / `.cs-str` / `.cs-com` / `.cs-fn`) mapped to `--cat-*` / `--color-*` tokens. For docs, tutorials, API examples. Distinction: `diff-block` shows +/- CHANGE lines with add/remove tinting; `code-snippet` presents ONE finished listing whose color carries syntax roles, not change status.
- **VARIABLES**: `{{FILE}}` path, `{{LANG}}` badge; per line `{{N}}` gutter number + the code (wrap tokens in `<span class="cs-kw|cs-str|cs-com|cs-fn">`).
- **SCALING**: panel background = `color-mix(--text-primary → --bg-page)`; code text lifts back toward `--bg-surface` for contrast on the dark field. Rows are a grid: fixed gutter + code cell. Token spans mix their `--cat`/`--color` hue with `--bg-surface` so the hue reads bright on the dark panel.
- **CSS classes**: `.cs`, `.cs-head`, `.cs-file`, `.cs-lang`, `.cs-body`, `.cs-row`, `.cs-ln`, `.cs-code`, `.cs-kw`, `.cs-str`, `.cs-com`, `.cs-fn`. (no `elements.css` primitive needed.)
- **token**: `--text-primary`, `--bg-page`, `--bg-surface`, `--accent`, `--cat-2`, `--color-success`, `--font-mono`, `--radius-md`, `--sp-*`, `--border-default/-subtle`, `--type-caption`, `--shadow-sm`.
- **INTERACTION**: none (static). Real `<pre>`/`<code>`; the filename and language badge are text; token roles are color-only.
- **lineage**: unified-system original (v5 high-frequency pass).

## `agenda.html`

- **PURPOSE**: A **forward-looking meeting / event agenda** (pure CSS - no SVG, no JS). Time-slot rows - a mono start–end time, a session title, an owner / speaker chip, and an optional room / track tag - grouped under section dividers for morning / afternoon blocks. For conference programs, sprint schedules, workshop plans. Distinction: `timeline` narrates PAST events as a chronology; `gantt` plans task DURATIONS across a calendar; `activity-feed` logs what already happened; `agenda` is the SCHEDULED, still-upcoming program of a single day or session.
- **VARIABLES**: `{{TITLE}}`; per block `{{BLOCK}}` label; per slot `{{START}}`–`{{END}}` time, `{{SESSION}}` title, `{{OWNER}}` chip, optional `{{TRACK}}` tag.
- **SCALING**: each block is a labeled group of `.agd-slot` rows. A slot is a grid: a fixed mono time column + a body cell (title over a meta row of the owner chip and track tag). A left accent rail (transparent → accent on hover) ties each slot to the theme; block labels sit on a faint tinted strip.
- **CSS classes**: `.agd`, `.agd-title`, `.agd-list`, `.agd-block`, `.agd-block-label`, `.agd-slot`, `.agd-time`, `.agd-body`, `.agd-session`, `.agd-meta`, `.agd-track`. primitives: `.card-outlined`, `.chip`.
- **token**: `--accent`, `--bg-card`, `--bg-surface`, `--text-primary/-secondary`, `--border-default/-subtle`, `--font-mono`, `--radius-md/-xs`, `--sp-*`, `--type-body/-caption`, `--tracking-eyebrow`, `--shadow-sm`.
- **INTERACTION**: paint-only hover (a slot's left rail warms toward the accent). The owner chip reuses the `.chip` primitive.
- **lineage**: unified-system original (v5 high-frequency pass).

---

# v6 modules (18 added - high-frequency pass 2)

Planning/exec staples (okr-board, business-model-canvas, gap-analysis, maturity-ladder, project-status, calendar-month), infographic data units (leaderboard, composition-bar, diverging-bar, cohort-grid, tag-cloud, pictogram), and tech/product-doc staples (changelog, key-takeaways, team-grid, logo-wall, file-tree, api-endpoint).

## `okr-board.html`

- **PURPOSE**: **Pure-CSS OKR board** (no SVG). 2–3 Objective cards, each owning its Key Results as rows with a thin progress bar, a `%` value, and an on-track / at-risk status chip. For quarterly OKR reviews where a qualitative goal is aligned to a few measurable results. Distinction: `kpi-tree` decomposes ONE metric mathematically (×/÷ operator nodes); `project-status` reports workstream HEALTH point-in-time; `okr-board` is goal → measurable-results alignment (an Objective owns its Key Results).
- **VARIABLES**: `{{TITLE}}`; per objective `{{OBJ_KICKER}}` (O1/O2) + `{{OBJECTIVE}}`; per key result `{{KR}}`, `{{PCT}}` (0–100 → inline `--okr-v`), `{{STATUS}}` chip, with `.is-ontrack` / `.is-atrisk` on the row.
- **SCALING**: cards flow in an auto-fit grid (`minmax(240px, 1fr)`). A KR row is a stack: the label on top, then a `[bar 1fr | % auto | chip auto]` meta line. The bar fill width = the inline `--okr-v` percent; the row modifier flows the RAG-ish colour into `--okr-c` (chip + fill).
- **CSS classes**: `.okr`, `.okr-title`, `.okr-grid`, `.okr-obj`, `.okr-kicker`, `.okr-obj-name`, `.okr-krs`, `.okr-kr`(+`.is-ontrack`/`.is-atrisk`), `.okr-kr-name`, `.okr-meta`, `.okr-bar`, `.okr-pct`, `.okr-chip`. primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-1..5`, `--color-success`, `--color-warning`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-*`, `--font-mono`, `--radius-*`, `--sp-*`, `--shadow-sm`, `--dur-mid`, `--ease`, `--tracking-eyebrow`.
- **INTERACTION**: none required; the bar fill has a width transition (`prefers-reduced-motion` guarded). `figure` + `aria-label`; all values real text.
- **lineage**: unified-system original (v6 high-frequency pass 2).

## `business-model-canvas.html`

- **PURPOSE**: **Pure-CSS grid Business Model Canvas** (no SVG). The canonical Osterwalder 9-block layout - Key Partners / Key Activities / Key Resources / Value Propositions / Customer Relationships / Channels / Customer Segments across the top band, Cost Structure and Revenue Streams across the bottom - each block a mono kicker over bullet items. For business-model design / review on one page. Distinction: `swot` is 4 strategic quadrants (S/W/O/T); `capability-map` inventories competencies by domain; `business-model-canvas` is the fixed nine-block BMC template.
- **VARIABLES**: `{{TITLE}}`; per block only its `{{ITEM}}` bullets. The nine block titles (Key Partners … Revenue Streams) are the fixed canonical BMC slots and stay as printed.
- **SCALING**: a **10-col × 3-row grid** keeps BMC proportions - `grid-template-columns: repeat(10,1fr); grid-template-rows: repeat(2,minmax(84px,auto)) minmax(72px,auto)`. Placement: Key Partners `1/3·rows1-2`; Key Activities `3/5·row1`; Key Resources `3/5·row2`; Value Propositions `5/7·rows1-2`; Customer Relationships `7/9·row1`; Channels `7/9·row2`; Customer Segments `9/11·rows1-2`; Cost Structure `1/6·row3`; Revenue Streams `6/11·row3`. Collapses to one stacked column ≤720px.
- **CSS classes**: `.bmc`, `.bmc-title`, `.bmc-grid`, `.bmc-block`(+ placement classes `.bmc-partners/-activities/-resources/-value/-relations/-channels/-segments/-cost/-revenue`), `.bmc-kicker`, `.bmc-items`. primitive: `.card-outlined`.
- **token**: `--accent`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-*`, `--font-mono`, `--radius-*`, `--sp-*`, `--type-*`, `--shadow-sm`, `--tracking-eyebrow`, `--dur-fast`, `--ease`.
- **INTERACTION**: hover lifts a block's border toward the accent (paint-only, `prefers-reduced-motion` guarded). `figure` + `aria-label`; each block is a titled section with a bulleted list.
- **lineage**: unified-system original (v6 high-frequency pass 2).

## `gap-analysis.html`

- **PURPOSE**: **Pure-CSS As-Is → Gap → To-Be layout** (no SVG). Three columns - 現状 (current) / ギャップ+施策 (gap) / あるべき姿 (target) - where the middle column names each gap and pins a bridging-action chip to it, with arrow gutters flowing left → right. For improvement / transformation docs that make the gap and its closing actions explicit. Distinction: `before-after` shows two states side-by-side with delta chips only (no bridge); `force-field` weighs driving vs restraining forces around a change; `gap-analysis` makes the GAP itself and its bridging ACTIONS the middle term.
- **VARIABLES**: `{{TITLE}}`; column heads `{{ASIS_HEAD}}` `{{GAP_HEAD}}` `{{TOBE_HEAD}}`; per current item `{{ASIS_ITEM}}`; per gap `{{GAP}}` + its `{{ACTION}}` chip; per target item `{{TOBE_ITEM}}`.
- **SCALING**: a 5-track grid - `[as-is 1fr][arrow auto][gap 1.2fr][arrow auto][to-be 1fr]`. The two arrow gutters each hold one `→` glyph, vertically centred; the middle column is widened because each gap row also carries an action chip. ≤720px the grid collapses to one column and the arrow gutters rotate 90° to point downward.
- **CSS classes**: `.gap`, `.gap-title`, `.gap-cols`, `.gap-arrow`, `.gap-col`(+`.gap-as-is`/`.gap-mid`/`.gap-to-be`), `.gap-head`, `.gap-list`, `.gap-item`, `.gap-row`, `.gap-name`, `.gap-action` (arrow-prefixed chip). primitive: `.card-outlined`.
- **token**: `--accent`, `--color-success`, `--color-warning`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-*`, `--font-mono`, `--radius-*`, `--sp-*`, `--type-*`, `--shadow-sm`, `--tracking-eyebrow`.
- **INTERACTION**: none (static). `figure` + `aria-label`; columns are real text and arrow glyphs are `aria-hidden`.
- **lineage**: unified-system original (v6 high-frequency pass 2).

## `maturity-ladder.html`

- **PURPOSE**: **Pure-CSS maturity-model staircase** (no SVG). 4–5 ascending level steps (Lv1 初期 → Lv5 最適化), each a block with a level number, a name and a short traits list; the steps rise left → right and the CURRENT level is highlighted with an accent ring and a 現在 badge. For capability / process maturity assessments (CMMI-style scales). Distinction: `stepper` is a numbered PROCESS sequence walked through once; `pyramid` is a compositional HIERARCHY of stacked tiers; `maturity-ladder` is an assessment SCALE you climb, with a marked current rung.
- **VARIABLES**: `{{TITLE}}`; per level `{{LV}}` (Lv1…), `{{LEVEL_NAME}}`, and `{{TRAIT}}` bullets. The current step gets `.is-current` (ring + 現在 badge) and inline `style="--mtl-lv:N"` sets its rise (N runs 1..count).
- **SCALING**: `.mtl-steps` is a flex row, `align-items:flex-end`, so every step sits on a shared baseline; each step's height = `calc(var(--mtl-base) + N × var(--mtl-rise))` via the inline `--mtl-lv`, producing the ascending staircase (`--mtl-base:150px`, `--mtl-rise:34px`). Steps flex to equal widths; ≤720px they wrap and heights relax to auto.
- **CSS classes**: `.mtl`, `.mtl-title`, `.mtl-steps`, `.mtl-step`(+`.is-current`, `--mtl-lv` sets rise, `--mtl-c` tint), `.mtl-lv`, `.mtl-name`, `.mtl-traits`, `.mtl-badge`. primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-1..5`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-*`, `--font-mono`, `--radius-*`, `--sp-*`, `--type-*`, `--shadow-sm`, `--shadow-md`, `--tracking-eyebrow`, `--dur-fast`, `--ease`.
- **INTERACTION**: hover lifts a step (paint-only shadow, `prefers-reduced-motion` guarded). `figure` + `aria-label`; levels and the 現在 badge are real text.
- **lineage**: unified-system original (v6 high-frequency pass 2).

## `project-status.html`

- **PURPOSE**: **Pure-CSS weekly status report board** (no SVG, no JS). A header row carries the overall RAG chip + reporting period; then one row per workstream with its name, a RAG chip (green / amber / red via `--color-success/-warning/-danger`), a thin progress bar + `%`, an owner chip, and a next-milestone note. For the point-in-time health snapshot a PM circulates each week. Distinction: `kanban-board` is interactive card triage across To do/Doing/Done; `gantt` plans task bars on dates; `raci-matrix` assigns roles per task; `project-status` is the read-only health snapshot at one moment.
- **VARIABLES**: `{{TITLE}}`; `{{PERIOD}}`; overall `{{OVERALL}}` chip (`.is-green/-amber/-red` on `.pst-overall`); per workstream `{{STREAM}}`, its `{{RAG}}` chip (row modifier `.is-green/-amber/-red`), `{{PCT}}` (0–100 → inline `--pst-v`), `{{OWNER}}` chip, `{{MILESTONE}}` note.
- **SCALING**: each row is a grid - `[name 1.4fr | rag auto | bar 1fr | % auto | owner auto]` with the milestone note on a second line spanning the row (`grid-column:1/-1`). The bar fill width = the inline `--pst-v` percent; the row's RAG modifier flows one colour into `--pst-c` (left rail + chip + bar tint).
- **CSS classes**: `.pst`, `.pst-title`, `.pst-head`, `.pst-head-label`, `.pst-overall`, `.pst-period`, `.pst-list`, `.pst-row`(+`.is-green`/`-amber`/`-red`), `.pst-stream`, `.pst-rag`, `.pst-bar`, `.pst-pct`, `.pst-note`. primitives: `.card-outlined`, `.chip` (owner).
- **token**: `--accent`, `--color-success/-warning/-danger`, `--bg-card`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-*`, `--font-mono`, `--radius-*`, `--sp-*`, `--type-*`, `--shadow-sm`, `--dur-mid`, `--ease`, `--tracking-eyebrow`.
- **INTERACTION**: none required; the bar fill has a width transition (`prefers-reduced-motion` guarded). `figure` + `aria-label`; all chips and values real text.
- **lineage**: unified-system original (v6 high-frequency pass 2).

## `calendar-month.html`

- **PURPOSE**: **Pure-CSS month calendar** (no SVG, no JS). A weekday header row over a 5-week × 7-day grid; each day cell shows its day number and any cat-tinted event chips. Today is highlighted; days outside the current month are dimmed. For schedules, editorial / release calendars, and month-at-a-glance views. Distinction: `cal-heatmap` encodes an intensity value per day (GitHub-style contribution grid); `agenda` lists time slots for a SINGLE day; `gantt` spans task bars across dates; `calendar-month` is the familiar month grid with discrete per-day events.
- **VARIABLES**: `{{TITLE}}` (month label); per weekday `{{WD}}`; per event chip `{{EVENT}}` (with a `.cat-N` tint). Day numbers are literal (edit them to your month); out-of-month cells get `.is-out`, the current day gets `.is-today`.
- **SCALING**: `.cml-grid` is **7 equal columns**; row 1 = weekday heads, rows 2–6 = the five week rows (35 cells). Cells use `min-height:82px` so weeks stay even; add more `.cml-ev` chips inside a cell and it grows. First/last columns (Sun/Sat) carry a faint weekend tint. For a 6-week month add 7 more `.cml-day` cells.
- **CSS classes**: `.cml`, `.cml-title`, `.cml-grid`, `.cml-wd`, `.cml-day`(+`.is-out`/`.is-today`), `.cml-num`, `.cml-events`, `.cml-ev`(+`.cat-1..5`, `--cc` tint). primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-1..5`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-*`, `--font-mono`, `--radius-*`, `--sp-*`, `--type-*`, `--shadow-sm`, `--dur-fast`, `--ease`, `--tracking-eyebrow`.
- **INTERACTION**: hover raises a day cell (paint-only, `prefers-reduced-motion` guarded). `figure` + `aria-label`; weekday heads, day numbers and event chips are real text.
- **lineage**: unified-system original (v6 high-frequency pass 2).

## `leaderboard.html`

- **PURPOSE**: Self-contained **ranked standings table** (pure CSS - no SVG). Each row carries a rank badge (ranks 1–3 get medal-tinted badges via `--color-warning`/`--text-muted`/danger-mix tokens, the rest a plain badge), a name, a horizontal cat-tinted value bar, the value, and a since-last movement indicator (▲2 / ▼1 / – in success/danger/muted). For current standings, top-N lists, sales/points scoreboards. Distinction: `chart-bar` compares categories with no ranking semantics; `bump-chart` plots rank TRAJECTORIES over time; `leaderboard` is the current-standings snapshot with rank position and since-last movement.
- **VARIABLES**: `{{TITLE}}`; per row `{{RANK}}` `{{NAME}}` `{{VALUE}}` `{{MOVE}}` + inline `--v` on the bar fill.
- **SCALING**: each `.ldb-row` is a grid `auto minmax(96px,1fr) 2.4fr auto auto`. Bar fill width `--v = value / maxValue × 100%`. Top-3 badges take `.is-1`/`.is-2`/`.is-3` for gold/silver/bronze tints; lower ranks share the plain badge. Movement span takes `.up`/`.down`/`.flat`.
- **CSS classes**: `.ldb`, `.ldb-title`, `.ldb-list`, `.ldb-row`, `.ldb-rank`(+`.is-1/.is-2/.is-3`), `.ldb-name`, `.ldb-bar`, `.ldb-fill`(+inline `--v`, `.cat-1..5`), `.ldb-val`, `.ldb-move`(+`.up/.down/.flat`). primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-1..5`, `--color-success`, `--color-danger`, `--color-warning`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-primary/-secondary/-muted`, `--font-mono`, `--radius-sm/-pill/-xs`, `--sp-*`, `--shadow-sm`.
- **INTERACTION**: none required. `aria-label` on the figure; ranks, names, values, movement are real text. Rows lift and bars brighten on hover (paint only, reduced-motion guarded).
- **lineage**: unified-system original (v6 high-frequency pass 2).

## `composition-bar.html`

- **PURPOSE**: Self-contained **single 100% composition bar** (pure CSS - no SVG). One full-width strip split into cat-tinted segments (each width set inline as a percent), each carrying an in-bar label, with a legend row below mapping color → label + value. Optionally stack a SECOND bar to compare two periods (今年 vs 昨年) sharing one legend. For an inline part-of-whole readout. Distinction: `chart-stacked` is a multi-bar series across categories/time; `waffle` spells the same share as a 100-cell countable grid; `chart-donut` is radial; `composition-bar` is the compact one-strip readout for a text flow.
- **VARIABLES**: `{{TITLE}}`; optional per-bar `{{ROW_LABEL}}`; per segment `{{SEG_LABEL}}` with inline `width:NN%`; per legend entry `{{LEG_LABEL}}` `{{LEG_VALUE}}`.
- **SCALING**: each `.cmb-bar` is a flex row of `.cmb-seg` segments; inline `width:NN%` MUST sum to 100 within a bar. In-bar labels clip via overflow when a segment is too narrow; the legend always carries the values.
- **CSS classes**: `.cmb`, `.cmb-title`, `.cmb-rows`, `.cmb-row`, `.cmb-row-label`, `.cmb-bar`, `.cmb-seg`(+inline `width`, `.cat-1..5`), `.cmb-legend`, `.cmb-key`(+`.cat-1..5` swatch), `.cmb-v`. primitive: `.card-outlined`.
- **token**: `--cat-1..5`, `--accent`, `--bg-surface`, `--bg-muted`, `--border-subtle`, `--text-primary/-secondary/-muted`, `--font-mono`, `--radius-sm/-xs`, `--sp-*`.
- **INTERACTION**: none required. `aria-label` on the figure; segment + legend labels are real text. Segments brighten on hover (paint only, reduced-motion guarded).
- **lineage**: unified-system original (v6 high-frequency pass 2).

## `diverging-bar.html`

- **PURPOSE**: Self-contained **butterfly / diverging (tornado) bar chart** (pure CSS - no SVG). A central spine of category labels with bars extending LEFT for series A and RIGHT for series B, mirrored around the center; each value sits at the outer bar end. For contrasting two opposing series per category (男性/女性, 賛成/反対, 今期/前期, before/after). Distinction: `dot-plot` marks a range or two points on ONE shared axis; `chart-bar` groups the two series' bars side-by-side on the same side; `diverging-bar` mirrors them around a central spine so the opposition reads spatially.
- **VARIABLES**: `{{TITLE}}`; series names `{{SERIES_A}}` `{{SERIES_B}}`; per row `{{CATEGORY}}` `{{VALUE_A}}` `{{VALUE_B}}` + inline `--w` on each fill.
- **SCALING**: each `.dvb-row` is a grid `3em minmax(60px,1fr) auto minmax(60px,1fr) 3em` = valA | trackA | category | trackB | valB. Left fills are right-aligned (grow toward the spine), right fills left-aligned; each fill `--w = value / rowMax × 100%` on a shared scale. Values sit at the fixed outer extremes so rows align.
- **CSS classes**: `.dvb`, `.dvb-title`, `.dvb-legend`, `.dvb-key`(+`.a/.b`), `.dvb-rows`, `.dvb-row`, `.dvb-val`(+`.a/.b`), `.dvb-cat`, `.dvb-track`(+`.a/.b`), `.dvb-fill`(+inline `--w`). primitive: `.card-outlined`.
- **token**: `--cat-1`, `--cat-2`, `--accent`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-primary/-secondary/-muted`, `--font-mono`, `--radius-sm/-xs`, `--sp-*`.
- **INTERACTION**: none required. `aria-label` on the figure; categories, series names, both values are real text. Fills brighten on hover (paint only, reduced-motion guarded).
- **lineage**: unified-system original (v6 high-frequency pass 2).

## `cohort-grid.html`

- **PURPOSE**: Self-contained **retention cohort table** (pure CSS - no SVG). Rows are monthly signup cohorts, columns are period offsets M0..M5; each cell shows a retention % with a background whose intensity scales via `color-mix` of `--accent` (higher % = stronger tint), and the table is STAIRCASED - newer cohorts have fewer observed periods so their trailing cells are blank. Distinction: `heatmap` is a generic full intensity matrix; `cal-heatmap` tiles calendar days by date; `cohort-grid` is the triangular retention-analysis table where columns are relative period offsets from each cohort's own start.
- **VARIABLES**: `{{TITLE}}`; column headers `{{PERIOD}}` (M0..M5); per row `{{COHORT}}` `{{SIZE}}` + per cell `{{PCT}}` with inline `--i` (0–100 intensity = the retention percent).
- **SCALING**: grid columns `auto auto repeat(6, minmax(44px,1fr))` = cohort | size | M0..M5. Cell tint = `color-mix(in srgb, var(--accent) calc(var(--i)*1%), var(--bg-surface))`, so `--i` IS the retention percent (M0 = 100 → strongest). Staircase: give the newest cohort's unobserved trailing cells `.cht-na` (no tint, em-dash).
- **CSS classes**: `.cht`, `.cht-title`, `.cht-grid`, `.cht-h`(+`.lead`), `.cht-cohort`, `.cht-size`, `.cht-cell`(+inline `--i`), `.cht-na`. primitive: `.card-outlined`.
- **token**: `--accent`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-primary/-muted`, `--font-mono`, `--radius-xs`, `--sp-*`, `--tracking-eyebrow`.
- **INTERACTION**: none required. `aria-label` on the figure; cohorts, sizes, periods, percents are real text. Cells outline on hover (paint only, reduced-motion guarded).
- **lineage**: unified-system original (v6 high-frequency pass 2).

## `tag-cloud.html`

- **PURPOSE**: Self-contained **weighted tag / word cloud** (pure CSS - no SVG). Inline-flex tags that wrap, each SIZED by a weight class (`.w1`–`.w5` mapping onto the type scale) and cat-tinted, with an optional count. Makes the relative frequency / prominence of topics readable at a glance. Distinction: `treemap` encodes EXACT proportions as tile areas you can compare precisely; `feature-grid` explains items with descriptions; `tag-cloud` is the loose, at-a-glance frequency cloud where bigger = more prominent with no exact area.
- **VARIABLES**: `{{TITLE}}`; per tag `{{TAG}}` with a weight class `.w1..w5` and a `.cat-N` tint, plus an optional `{{COUNT}}` in a `.tgc-n` span.
- **SCALING**: five weight buckets map onto the type scale: `.w1` caption → `.w2` small → `.w3` body → `.w4` h3 → `.w5` h2. Assign each tag a bucket by its weight rank (heaviest → `.w5`). Tint via a `.cat-N` class; the cloud wraps via `flex-wrap`.
- **CSS classes**: `.tgc`, `.tgc-title`, `.tgc-cloud`, `.tgc-tag`(+`.w1..w5`, `.cat-1..5`), `.tgc-n`. primitive: `.card-outlined`.
- **token**: `--cat-1..5`, `--accent`, `--bg-surface`, `--border-default`, `--text-primary/-muted`, `--font-mono`, `--type-caption/-small/-body/-h3/-h2`, `--radius-pill`, `--sp-*`.
- **INTERACTION**: none required. `aria-label` on the figure; tags + counts are real text. Tags deepen tint on hover (paint only, reduced-motion guarded).
- **lineage**: unified-system original (v6 high-frequency pass 2).

## `pictogram.html`

- **PURPOSE**: Self-contained **icon-unit / ISOTYPE chart** (pure CSS - no SVG). Each row is a label plus a strip of repeated unit glyphs (`●` or a `人` glyph in spans) where the FILLED units are accent/cat-tinted and the rest dimmed, with a value readout (`7/10人`). Counts discrete units with a repeated icon, infographic-style. Distinction: `waffle` is an abstract 100-cell grid for a part-of-100 share; `progress` is one continuous bar toward a goal; `pictogram` counts DISCRETE whole units with a meaningful glyph so "7 of 10 people" reads as seven icons.
- **VARIABLES**: `{{TITLE}}`; per row `{{LABEL}}` `{{VALUE}}` (e.g. 7/10人) + a strip of `.pgm-u` unit glyphs (`.on` filled + `.cat-N` tint on `.pgm-units`, rest `.off`).
- **SCALING**: one `.pgm-u` per unit (glyph is the span's text - swap `●` for `人`/`★`). Mark the first {filled} units `.on` and the rest `.off`; keep the same unit COUNT per row so rows align. `.cat-N` on `.pgm-units` sets the row's fill hue.
- **CSS classes**: `.pgm`, `.pgm-title`, `.pgm-rows`, `.pgm-row`, `.pgm-label`, `.pgm-units`(+`.cat-1..5`), `.pgm-u`(+`.on/.off`), `.pgm-val`. primitive: `.card-outlined`.
- **token**: `--cat-1..5`, `--accent`, `--bg-surface`, `--border-default`, `--text-primary/-secondary/-muted`, `--font-mono`, `--type-small/-h3`, `--sp-*`.
- **INTERACTION**: none required. `aria-label` on the figure; labels + value readouts are real text; the glyph strip is `aria-hidden` and the value carries the count. Filled units lift on hover (paint only, reduced-motion guarded).
- **lineage**: unified-system original (v6 high-frequency pass 2).

## `changelog.html`

- **PURPOSE**: Self-contained **pure-CSS release notes** (no SVG, no JS). A stack of version blocks; each carries a mono version number, a release date, and an optional "latest" badge, then groups its entries under **Added / Changed / Fixed** chips (success / accent / warning tints) with one short description line per entry. For the versioned product-change record in READMEs / release pages. Distinction: `activity-feed` is a chronological event stream (actor+action); `diff-block` shows code +/- lines; `timeline` narrates milestones; `changelog` is the version-keyed record of what shipped.
- **VARIABLES**: `{{TITLE}}` + per version `{{VERSION}}` `{{DATE}}` (+ optional latest badge) + per group `{{TAG}}` (tone via `.-added/-changed/-fixed`) + per entry `{{ENTRY}}`.
- **SCALING**: vertical flow - one `.clg-ver` per release (newest first), separated by a hairline; inside, each `.clg-group` is a `max-content 1fr` grid so the toned chip sits in the gutter and its `.clg-list` entries stack to its right.
- **CSS classes**: `.clg`, `.clg-title`, `.clg-ver`, `.clg-head`, `.clg-num`(mono), `.clg-date`(mono), `.clg-latest`(accent pill), `.clg-group`, `.clg-tag`(+`.-added/-changed/-fixed`), `.clg-list`, `.clg-entry`. primitive: `.card-outlined`.
- **token**: `--accent`, `--color-success`, `--color-warning`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-primary/-secondary/-muted`, `--font-mono`, `--radius-*`, `--sp-*`, `--dur-fast`, `--ease`.
- **INTERACTION**: hover lifts an entry line's tint (paint-only, `prefers-reduced-motion` guarded). `figure` + `figcaption`; releases are `<section>`s, entries real list items.
- **lineage**: unified-system original (v6 high-frequency pass 2).

## `key-takeaways.html`

- **PURPOSE**: Self-contained **pure-CSS TL;DR panel** (no SVG, no JS). An accent-framed box titled 要点 / Key Takeaways holding 3–5 numbered rows; each row pairs a number badge (auto CSS counter) with a bold one-line lead and an optional short elaboration. For the up-front executive summary of a report or deck. Distinction: `callout-box` is a single aside note; `stat-list` is numeric key→value facts; `checklist` is actionable to-dos; `key-takeaways` is the ordered set of conclusions to walk away with.
- **VARIABLES**: `{{TITLE}}` (panel heading) + per row `{{LEAD}}` (bold one-liner) + optional `{{ELAB}}` (elaboration). Badge numbers are auto (1..N).
- **SCALING**: the frame is a `.card-outlined` figure with a 3px accent `border-left` rail and a faint accent wash; `.ktw-list` uses `counter-reset` so each `.ktw-row` (`auto 1fr` grid) numbers itself via `.ktw-num::before { content: counter(ktw) }`. Keep to 3–5 rows.
- **CSS classes**: `.ktw`, `.ktw-title`(+`::before` TL;DR chip), `.ktw-list`, `.ktw-row`, `.ktw-num`(accent disc), `.ktw-body`, `.ktw-lead`(bold), `.ktw-elab`. primitive: `.card-outlined`.
- **token**: `--accent`, `--bg-surface`, `--bg-muted`, `--border-default`, `--text-primary/-secondary`, `--radius-*`, `--sp-*`, `--tracking-eyebrow`, `--dur-fast`, `--ease`.
- **INTERACTION**: hover warms a row wash and fills its number badge (paint-only, `prefers-reduced-motion` guarded). `figure` + `figcaption`; rows are an ordered list, badges aria-hidden.
- **lineage**: unified-system original (v6 high-frequency pass 2).

## `team-grid.html`

- **PURPOSE**: Self-contained **pure-CSS team roster** (no SVG, no JS). A 3–4 column grid of member cards; each leads with an initials avatar (accent / cat-tinted disc), then name, role, a one-line bio, and contact/skill chips. For the "who we are" introduction on about pages / proposals. Distinction: `persona-card` is a deep UX archetype profile (goals/pains); `org-chart` shows the reporting hierarchy; `team-grid` is the flat, equal-weight gallery of the actual people.
- **VARIABLES**: `{{TITLE}}` + per card `{{INITIALS}}` (avatar, tint via `.cat-N`) `{{NAME}}` `{{ROLE}}` `{{BIO}}` + per chip `{{TAG}}`.
- **SCALING**: `.tmg-grid` is `repeat(var(--tmg-cols),1fr)`; set `style="--tmg-cols:3|4"` on the figure. Cards are centered flex columns; the responsive rule collapses to 2 columns under 720px. Avatar tint switches via `.tmg-avatar.cat-1..5`.
- **CSS classes**: `.tmg`, `.tmg-title`, `.tmg-grid`, `.tmg-card`, `.tmg-avatar`(+`.cat-1..5`), `.tmg-name`, `.tmg-role`, `.tmg-bio`, `.tmg-tags`, `.tmg-tag`. primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-1..5`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-primary/-secondary/-muted`, `--radius-*`, `--sp-*`, `--shadow-sm/-md`, `--dur-fast`, `--ease`, `--ease-out`.
- **INTERACTION**: hover lifts a card (border/shadow + `translateY`, motion under `prefers-reduced-motion: no-preference`). `figure` + `figcaption`; cards carry real name/role/bio text, avatars aria-hidden.
- **lineage**: unified-system original (v6 high-frequency pass 2).

## `logo-wall.html`

- **PURPOSE**: Offline social-proof strip with a kicker and a wrapping row of verified company names; supplied inline SVG marks are optional. Do not invent customers, logos or adoption claims.
- **VARIABLES**: `{{KICKER}}` + per item `{{COMPANY}}`. Repeat `.lgw-item` for each supplied company. Optional adoption text uses `.lgw-stat` and must have evidence.
- **SCALING**: centered `flex-wrap` row with token spacing. Legacy `.lgw-tile` remains a supported alias.
- **CSS classes**: `.lgw`, `.lgw-kicker`, `.lgw-row`, `.lgw-item`, `.lgw-name`, optional `.lgw-mono` / `.lgw-stat`; legacy `.lgw-tile`.
- **INTERACTION**: paint-only hover, reduced-motion guarded; company names remain readable text.
- **lineage**: unified-system original (v6 high-frequency pass 2).

## `file-tree.html`

- **PURPOSE**: Self-contained **pure-CSS static directory listing** (no SVG, no JS). A mono-font project tree whose guides (├─ └─ │) are literal box-drawing glyphs in a dimmed lead column; folder rows read bold + accent, file rows plain, and an optional per-line annotation sits dimmed at the right. For the always-visible project-layout block in READMEs / specs. Distinction: `tree` (interactive) collapses arbitrary hierarchies via `HA.tree`; `code-snippet` shows a file's contents; `file-tree` is the flat, printed, never-collapsing layout listing that needs no JS.
- **VARIABLES**: `{{TITLE}}` + per row `{{GUIDE}}` (box-drawing prefix, e.g. `"│  ├─ "`) `{{NAME}}` (add `.-dir` for folders) + optional `{{NOTE}}` (right annotation).
- **SCALING**: each `.ftr-row` is a mono baseline flex line - `.ftr-guide` holds the literal ASCII guide (`white-space:pre` keeps indentation), `.ftr-name` the entry, and `.ftr-note` is pushed right by `margin-inline-start:auto`. Mono font + `pre` guides keep the ├─ └─ │ columns aligned across rows; the block scrolls horizontally if narrow.
- **CSS classes**: `.ftr`, `.ftr-title`, `.ftr-tree`, `.ftr-row`, `.ftr-guide`(dimmed glyphs), `.ftr-name`(+`.-dir` bold accent), `.ftr-note`(dimmed right). primitive: `.card-outlined`.
- **token**: `--accent`, `--bg-muted`, `--border-default/-subtle`, `--text-secondary/-muted`, `--font-mono`, `--radius-*`, `--sp-*`, `--dur-fast`, `--ease`.
- **INTERACTION**: hover tints a row (paint-only, `prefers-reduced-motion` guarded). `figure` + `figcaption`; tree is a labeled group, names real text.
- **lineage**: unified-system original (v6 high-frequency pass 2).

## `api-endpoint.html`

- **PURPOSE**: Self-contained **pure-CSS REST endpoint reference** (no SVG, no JS). Per endpoint: a header line with a method badge (GET / POST / PUT / DELETE tinted success / accent / warning / danger) and a mono path with highlighted `:params`, a short description, a compact params table (name / type / required / description), and a response row (status chip + description). Two endpoint blocks ship in the template. Distinction: `code-snippet` is a raw code listing; `data-table` is a generic (possibly interactive) grid; `api-endpoint` is the structured, self-labeling API-reference unit for tech specs / API docs.
- **VARIABLES**: `{{TITLE}}` + per endpoint `{{METHOD}}` (tone via `.-get/-post/-put/-delete`) `{{PATH}}` (wrap `:params` in `.api-param`) `{{DESC}}`; per param `{{PNAME}}` `{{PTYPE}}` `{{PREQ}}` `{{PDESC}}`; per response `{{STATUS}}` (tone via `.-ok/-warn/-err`) `{{RDESC}}`.
- **SCALING**: one `.api-ep` card per endpoint, stacked with `--sp-4` gaps. `.api-head` is a wrapping flex of badge + path; `.api-params` is a real `border-collapse` table; `.api-res` is a dashed-topped flex row. Method/status hues come from the tone classes only.
- **CSS classes**: `.api`, `.api-title`, `.api-ep`, `.api-head`, `.api-method`(+`.-get/-post/-put/-delete`), `.api-path`, `.api-param`(highlight), `.api-desc`, `.api-params`(table), `.api-prow`, `.api-pn`(mono), `.api-pt`(mono), `.api-req`/`.api-opt`, `.api-res`, `.api-status`(+`.-ok/-warn/-err`), `.api-rdesc`. primitive: `.card-outlined`.
- **token**: `--accent`, `--color-success/-warning/-danger`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-primary/-secondary/-muted`, `--font-mono`, `--radius-*`, `--sp-*`, `--tracking-eyebrow`, `--dur-fast`, `--ease`.
- **INTERACTION**: hover tints a param-table row (paint-only, `prefers-reduced-motion` guarded). `figure` + `figcaption`; endpoints are `<section>`s, params a real `<table>` with header cells.
- **lineage**: unified-system original (v6 high-frequency pass 2).

---

## `request-trace.html`

- **PURPOSE**: **Latency waterfall for ONE request** crossing the system. Each hop is a bar on a shared time axis, positioned by `start` and sized by `dur`, coloured by hop kind, above a summary strip (end-to-end total / hop count / slowest hop) and a tick axis. Distinction: `gantt` plots project phases over calendar time; `sequence-diagram` orders messages with no timing; `funnel` shows drop-off. This is the only module that answers **"where does the time actually go"**, which is the question a topology diagram provokes and cannot answer.
- **BUILDER**: `section.type: "request-trace"` - `{ title, desc, unit, total, hops: [{ component, op, start, dur, kind, note }] }`. `kind`: `network | compute | db | queue | cache | external`. `total` defaults to the end of the last hop; `unit` defaults to `ms`.
- **SCALING**: one `.rtrace-row` per hop, `grid-template-columns: 240px 1fr`. The builder decides per bar whether the duration text fits inside it; if not it emits `.rtrace-dur-out` just past the bar's end, so a 4ms sliver is still labelled. The legend lists only the kinds actually present.
- **CSS classes**: `.rtrace`, `.rtrace-head`, `.rtrace-desc`, `.rtrace-summary`, `.rtrace-sum-item/-key/-val`, `.rtrace-axis`, `.rtrace-axis-ticks`, `.rtrace-tick`, `.rtrace-rows`, `.rtrace-row`, `.rtrace-label`, `.rtrace-comp`, `.rtrace-n`, `.rtrace-op`, `.rtrace-track`, `.rtrace-bar`, `.rtrace-dur`, `.rtrace-dur-out`, `.rtrace-note`, `.rtrace-k-{network|compute|db|queue|cache|external}`, `.rtrace-legend`, `.rtrace-swatch`. primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-1/-2/-3`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-primary/-secondary/-muted`, `--on-accent`, `--font-mono`, `--radius-*`, `--sp-*`, `--shadow-sm`, `--dur-fast`, `--ease`.
- **INTERACTION**: none. Durations are text, never colour-only, so it prints and reads aloud intact.
- **lineage**: unified-system v7 architecture pass.

---

## `event-catalog.html`

- **PURPOSE**: **Producer → event → consumers fan-out**, one card per event, with delivery guarantee / transport / volume chips and an optional payload shape. The centre spine is a vertical rail so the **1-to-N** shape is visible at a glance. Distinction: `pipeline-flow` is strictly linear (one stage feeds the next); `api-endpoint` documents synchronous request/response; `sequence-diagram` orders messages on a timeline. This is the module for **"who emits this and who reacts to it"**.
- **BUILDER**: `section.type: "event-catalog"` - `{ title, desc, events: [{ name, desc, payload, transport, volume, delivery, producers: [string], consumers: [{ name, action, async }] }] }`. `producers`/`consumers` accept a plain string or an object.
- **SCALING**: `.evcat-flow` is `1fr auto 1.4fr` (producers / spine / consumers) and collapses to a single column with a horizontal spine under 760px. The consumer column header carries the count, which is the number that matters when auditing coupling.
- **CSS classes**: `.evcat`, `.evcat-head`, `.evcat-desc`, `.evcat-list`, `.evcat-card`, `.evcat-card-head`, `.evcat-name`, `.evcat-chip`(+`.evcat-chip-strong`), `.evcat-card-desc`, `.evcat-flow`, `.evcat-col`, `.evcat-col-key`, `.evcat-party`(+`.evcat-producer`/`.evcat-consumer`), `.evcat-party-name`, `.evcat-party-act`, `.evcat-async`, `.evcat-spine`, `.evcat-spine-dot`, `.evcat-payload`. primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-2`, `--bg-surface`, `--bg-muted`, `--border-subtle`, `--text-primary/-secondary/-muted`, `--on-accent`, `--font-mono`, `--radius-*`, `--sp-*`, `--shadow-sm`.
- **INTERACTION**: none (static).
- **lineage**: unified-system v7 architecture pass.

---

## `deployment-topology.html`

- **PURPOSE**: **Where the software actually runs** - region → availability zone → deployed unit, with replica counts and instance tech, plus a separate strip for region-less edge/shared services. Distinction: `arch-explorer` is the logical runtime view; `layer-stack` is an ordered tech stack with no placement; `file-tree` is repository structure. This is the **physical/infrastructure** view, the one that answers failover, latency and cost questions.
- **BUILDER**: `section.type: "deployment-topology"` - `{ title, desc, global: [{ name, kind, tech, note }], regions: [{ name, sub, role, zones: [{ name, units: [{ name, kind, replicas, tech, note }] }] }] }`. `role`: `primary | secondary | dr` (accents the region header, label localized). `kind`: `service | worker | database | cache | queue | gateway | storage | cdn` - same hues as `arch-explorer` node types so the two views read as one system.
- **SCALING**: `.dtopo-regions.is-multi` becomes a responsive multi-column grid at ≥900px when there is more than one region; zones are dashed sub-boxes; units auto-fill at `minmax(148px, 1fr)`.
- **CSS classes**: `.dtopo`, `.dtopo-head`, `.dtopo-desc`, `.dtopo-regions`(+`.is-multi`), `.dtopo-region`, `.dtopo-region-head/-name/-sub`, `.dtopo-role`, `.dtopo-r-{primary|secondary|dr}`, `.dtopo-zones`, `.dtopo-zone`, `.dtopo-zone-name`, `.dtopo-units`, `.dtopo-unit`, `.dtopo-unit-top/-name/-tech/-note`, `.dtopo-replicas`, `.dtopo-k-{gateway|service|worker|queue|database|cache|storage|cdn}`, `.dtopo-global`, `.dtopo-global-key`, `.dtopo-global-list`. primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-1/-2/-3/-4`, `--bg-surface`, `--bg-muted`, `--border-default/-subtle`, `--text-primary/-secondary/-muted`, `--font-mono`, `--radius-*`, `--sp-*`, `--shadow-sm`.
- **INTERACTION**: none (static).
- **lineage**: unified-system v7 architecture pass.

---

## `failure-modes.html`

- **PURPOSE**: Per component - **what breaks, who feels it, how you find out, what absorbs it**: impact, blast radius, detection, mitigation and RTO, with a severity chip and an optional "degrades, stays up" chip. Rows are **auto-sorted severity-first** so the card that would wake someone at 3am is read first. Distinction: `risk-matrix` scores generic project risks on a likelihood/impact grid; `fishbone` analyses one incident that already happened. This is component-anchored **operational** reality, the section an architecture review always reaches.
- **BUILDER**: `section.type: "failure-modes"` - `{ title, desc, rows: [{ component, failure, severity, impact, blast, detect, mitigate, rto, degraded }] }`. `severity`: `critical | high | medium | low`. `degraded: true` renders the reduced-mode chip. Omitted fields drop their row rather than printing an empty one.
- **SCALING**: `.fmodes-list` becomes `auto-fit minmax(420px, 1fr)` at ≥1000px; each card's whole accent (left border + header tint + chip) is driven by severity. Key/value rows collapse to stacked lines under 560px.
- **CSS classes**: `.fmodes`, `.fmodes-head`, `.fmodes-desc`, `.fmodes-list`, `.fmode`, `.fmode-s-{critical|high|medium|low}`, `.fmode-head`, `.fmode-comp`, `.fmode-sev`, `.fmode-degraded`, `.fmode-what`, `.fmode-grid`, `.fmode-row`, `.fmode-key`, `.fmode-val`, `.fmode-rto`. primitive: `.card-outlined`.
- **token**: `--cat-2`, `--color-danger`, `--color-warning`, `--bg-surface`, `--bg-muted`, `--border-subtle`, `--text-primary/-secondary/-muted`, `--on-accent`, `--font-mono`, `--radius-*`, `--sp-*`, `--shadow-sm`. Severity hues derive from `--color-danger` and `--color-warning` via `color-mix()` so critical/high/medium stay theme-native in every palette.
- **INTERACTION**: none (static). Severity is a text chip as well as a colour.
- **lineage**: unified-system v7 architecture pass.

---

## `arch-explorer.html`

- **PURPOSE**: **Interactive multi-zone architecture topology explorer** with a master-detail inspector drawer and zone filter pills. Each zone is a horizontal band containing typed service/worker/database/cache/queue/gateway/external cards (`W=206, H=76`); clicking a node highlights its 1-hop upstream/downstream edges and populates the right-hand detail drawer (tech, SLA, owner, throughput, endpoints, dependencies).
- **BUILDER**: `section.type: "arch-explorer"` - `{ title, subtitle, zones: [{ id, label, sublabel }], nodes: [{ id, label, sub, zone, type, status, badge, desc, tech, owner, sla, throughput, endpoints, details }], edges: [{ from, to, label, style }] }`.
- **CSS classes**: `.arch-exp`, `.arch-exp-header`, `.arch-exp-toolbar`, `.arch-filter`, `.arch-exp-body`, `.arch-exp-canvas`, `.arch-exp-svg`, `.zone-band`, `.arch-edge`, `.arch-edge-label`, `.arch-node`, `.node-card`, `.node-title`, `.node-sub`, `.node-badge-text`, `.arch-exp-drawer`. primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-1..5`, `--color-success/-warning/-danger`, `--bg-card/-surface/-muted`, `--border-default/-subtle`, `--text-primary/-secondary/-muted`, `--font-mono`.
- **INTERACTION**: `HA.archExplorer` (node selection + 1-hop neighborhood dimming + zone filter + inspector drawer) and `HA.fitSvgText` (clamps `.node-title`, `.node-sub`, `.node-badge-text` within card right boundary).
- **lineage**: unified-system v7 architecture pass.

---

## `pipeline-flow.html`

- **PURPOSE**: **Linear multi-stage process** (data pipeline, request handling, or "how method X gets from input to result"): numbered stage panels, each holding one or more cards with optional IN/OUT rows and go / warn / stop badges.
- **BUILDER**: `section.type: "pipeline-flow"` - `{ title, desc, flow: "grid"|"line", stages: [{ name, num, proto, emphasis: "hero"|"quiet", cards: [{ title, desc, in, out, branches: [{ label, kind|type: "go"|"warn"|"stop" }] }] }] }`. Stage keys outside this list are reported by the spec check (they would vanish).
- **flow**: default `grid` balances stages into columns (6 → 3×2) and wraps, so the order is implied by the numbers only. `line` keeps all stages on one row with `→` connectors and stacks them with down arrows below 720px - use it whenever the reader must follow the order (≤ 7 short stages).
- **emphasis**: when several flows are compared one after another, mark the stages that differ from the baseline `hero` and the ones identical to it `quiet`, and say so in `desc` - otherwise every flow looks the same and the difference has to be read out of the text.
- **CSS classes**: `.pipe`, `.pipe-head`, `.pipe-desc`, `.pipe-track`, `.pipe-line`, `.pipe-arrow`, `.pipe-stage`, `.pipe-stage-hero`, `.pipe-stage-quiet`, `.pipe-stage-head`, `.pipe-stage-num`, `.pipe-stage-name`, `.pipe-stage-proto`, `.pipe-stage-body`, `.pipe-card`, `.pipe-card-title`, `.pipe-card-desc`, `.pipe-io`, `.pipe-branch`, `.pipe-badge-go|warn|stop`. primitive: `.card-outlined`.
- **token**: `--accent`, `--color-success/-warning/-danger`, `--bg-surface/-muted`, `--border-subtle`, `--text-primary/-secondary/-muted`, `--font-mono`.
- **INTERACTION**: none (static).
- **lineage**: unified-system v7 architecture pass.

---

## `service-catalog.html`

- **PURPOSE**: **Filterable service / component directory** with search input, kind filter chips (`service | worker | database | queue | gateway | cache | external`), summary counters, and rich cards showing owner, SLA, repo, tech tags, dependencies, and exposed endpoints.
- **BUILDER**: `section.type: "service-catalog"` - `{ title, subtitle, services: [{ name, id, kind, status, tier, desc, owner, repo, sla, rps, latency, tech: [string], deps: [string], endpoints: [{ method, path, note }] }] }`.
- **CSS classes**: `.scat`, `.scat-header`, `.scat-controls`, `.scat-search`, `.scat-filters`, `.scat-filter-btn`, `.scat-summary`, `.scat-grid`, `.scat-card`, `.scat-card-top`, `.scat-kind-badge`, `.scat-tier`, `.scat-name`, `.scat-desc`, `.scat-metrics`, `.scat-tags`, `.scat-endpoints`, `.scat-deps`, `.scat-footer`. primitive: `.card-outlined`.
- **token**: `--accent`, `--cat-1..5`, `--color-success/-warning/-danger`, `--bg-card/-surface/-muted`, `--border-default/-subtle`, `--text-primary/-secondary/-muted`, `--font-mono`.
- **INTERACTION**: inline search + kind filter (`data-scat-filter`, `data-scat-search`).
- **lineage**: unified-system v7 architecture pass.

---

## How to Compose (connecting with base.template)

1. Copy `base.template.html` and fill in `{{LANG}}` / `{{THEME}}` / `{{TITLE}}`, etc.
2. Inline into `{{CORE_CSS}}` in the order `reset.css -> tokens.css -> themes.css -> elements.css`.
3. Inline the `<style data-module="...">` block of each module used into `{{MODULE_CSS}}` **exactly once per module**.
4. Paste each module's markup into `{{CONTENT}}` (`<main class="container layout-{{LAYOUT}}">` - one `layout-stack`/`layout-bento`/`layout-sidebar`/`layout-split` class per the chosen layout axis; `layout-stack` replaces the old page-level `stack-lg`) and replace `{{...}}` with real data.
5. If you use even one interactive module, inline `interactions.js` into the `<script>` just before `</body>` (`HA.init` auto-starts). If only `collapsible` is used, no JS is needed.
