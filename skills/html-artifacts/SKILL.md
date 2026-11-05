---
name: html-artifacts
description: >-
  Create a self-contained offline HTML file for reports, specifications,
  dashboards, diagrams and UI prototypes using bundled templates and
  deterministic builds. Use when the requested deliverable is HTML;
  scan existing UI when fidelity matters.
command: /html-artifacts
user_invocable: true
argument-hint: "[--shape=…] [--theme=…] <what to generate>"
version: 1.0.0
category: meta
---

# /html-artifacts - Self-Contained HTML Artifacts (unified system)

Generates **one self-contained `.html`** from any input with a **single template-driven,
dependency-free** system. (It consolidates five former local HTML skills; see
`reference/01-overview-and-flow.md` §3 for the integration mapping.)

**Core constraint:** the output is always ONE `.html`. CSS is inlined in `<style>` and JS
in `<script>`. No CDN / external library / build step. It opens offline in any browser.

---

## Instructions

### Overall flow (8 phases + optional scan gate)

```
DECIDE → BRIEF → TARGET → (SCAN if current UI) → DETECT → THEME+LAYOUT → ASSEMBLE → FILL → VALIDATE → LOOK → DELIVER
```

| # | Phase | What to do |
|---|---------|---------|
| 1 | **DECIDE** | Whether it should be HTML at all. Use HTML if you need visual hierarchy, diagrams, interaction, or shareability; use Markdown for agent self-consumption. |
| 1b | **BRIEF** | Size the job (S / M / L - table below) and write every explicit ask of the user as a requirement in the spec's `brief.requirements` (`{ "id": "R1", "text": "…" }` - one row per ask: each chart, table, comparison, language, tone, length or "must include"). Each section then claims what it satisfies with `"covers": ["R1"]`; the build fails while a requirement is uncovered, so nothing the user asked for is silently dropped. An ask you cannot satisfy gets `"waived": "<reason>"` and is reported to the user. Contract: `reference/07` §1.6. |
| 2 | **TARGET** | Read `reference/00-target-surface.md` and determine `--target=auto|mobile-app|tablet-app|web-app|desktop-app|document|diagram` plus `--viewport=auto|phone|tablet|desktop` and `--lang=auto|ko|ja|en`. Korean/Japanese prompt phrases count as first-class detection signals. Browser delivery is not the same thing as Web UI. |
| 2b | **SCAN** | If the request references the current/existing UI, a specific local route, an attached/browser screenshot, or asks for an as-is copy/redesign, read `reference/08-project-scan.md` and gather evidence before DETECT. **Check the spec-preview UI cache first**: if `<project>/.tmp/spec-preview/ui-cache/ui-cache.json` exists and `node <spec-preview skill>/assets/ui-scan.mjs check --project <root>` reports `fresh`, reuse its `tokens.cssVars` / `tokens.colors` / `tokens.fonts` / `components` / `project.framework` / `project.lang` / `project.targetSurface` / `aiNotes` as scan evidence and skip re-reading token sources (full procedure: `reference/08-project-scan.md` Step 0). First identify the framework and use `reference/09-framework-scan-playbooks.md` for the shortest route-to-component/token path (for example, Next.js App Router page→ancestor layouts→imports→CSS/assets). Then collect running-app screenshots, DOM/accessibility structure, computed styles, responsive breakpoints, and interaction states. Use the scan to override generic theme/layout defaults; do not invent colors, spacing, typography, text, or behavior that the project already defines. |
| 3 | **DETECT** | **If the request names a document GENRE** (経営資料 / 進捗報告 / SaaS分析 / 技術仕様書 / **システム構成・アーキテクチャ解説** / 提案書 / 障害報告 / 会議資料 / リリース資料 / 調査報告 / 導入ガイド), match it against the blueprint table in `reference/10-composition-standards.md` §1.1 first - a blueprint is a ready-to-build spec (`templates/blueprints/<id>.spec.json`) you adapt per its `_recipe` instead of composing from scratch. Otherwise determine the output **shape** (report / spec / code-review / data-viz / diagram / infographic / prototype / editor). Override with `--shape=`. |
| 4 | **THEME+LAYOUT** | Choose **theme / layout / header / density explicitly** via the content→axes mapping table below ("Page axes"). Silently falling back to the defaults is a contract violation - even when the mapping's own pick is what you want, choose it consciously and state all four axes in the delivery message. Override with `--theme=` or `style="--accent:#HEX;--on-accent:#fff"`. |
| 5 | **ASSEMBLE** | **Pick modules by SEARCHING the index first** - run `node tools/index.mjs --find "<keywords from the request>"` (ranks by tag / keyword / intent EN·KO·JA / use-when; returns the top candidates), then `node tools/index.mjs --details <ids>` for the chosen few's full contract (input shape, variants, interaction, related, a11y). If you can't run the tool, skim the ~9KB `index/INDEX.md`. Do **not** read every module file, and do **not** load the 75KB `index/COMPONENTS.md` wholesale. Open `reference/04-module-catalog.md` only when you need a chosen module's full CSS/markup contract. Then, using `templates/base.template.html` as the skeleton, arrange the needed modules under `<main class="container layout-<layout>">` - exactly one `layout-*` class on the page main (`layout-stack` replaces the old page-level `stack-lg`; the `.stack-lg` class itself remains available). In `bento`/`split` give each direct child its `--span`; in `sidebar` group sections by `area`. **Inline the core CSS in the order `reset → tokens → themes → elements → module CSS`, and `interactions.js` just before `</body>`.** |
| 6 | **FILL** | Fill each module's `{{VARIABLES}}` with real data. Match the user's language and the product language the repo declares (its CLAUDE.md/AGENTS.md or i18n config). For diagrams, compute the SVG coordinates and fill them in (`tools/build.mjs` generates them deterministically). For `mobile-app`, use a device frame or the deterministic `type:"device"` section. |
| 7 | **VALIDATE** | The builder's spec check runs first (unknown types / enum typos / missing data / uncovered requirements / leftover blueprint sample data stop the build - fix them, don't work around them). Then run `node tools/render-check.mjs <out.html> --shots=<dir>` (headless browser at 1280px and 390px: horizontal overflow, dead `#anchors`, broken images and console errors FAIL; sub-10px text, colliding/clipped labels, text spill, orphaned grid rows and empty sections WARN - fix warnings unless you can say why they are fine). Check the static contract with `node tools/validate.mjs <out.html>` (zero external dependencies / no leftover `{{ }}` / DOCTYPE, title, charset, viewport, lang / SVG a11y / data-draggable→dragNode / mobile target frame checks). Warnings never fail the gate (`PASS (N warnings)`, exit 0) - they include missing `data-layout`/`data-density`, the `default-sandwich` flag (birchline + stack + standard-only header on a >3-section page: "default look - confirm this is intentional"), and **WCAG AA contrast** of the active theme / custom accent (audit all themes with `node tools/contrast-audit.mjs`; see `reference/03` §2). |
| 7b | **LOOK** | Open the screenshots (`Read` the PNGs) at both widths. Ask: does the first screen answer the user's question? Is every number labelled with its unit and period? Is anything cramped, truncated, or visually louder than its importance? Fix and rebuild - the gates catch defects, not unclear pages. If no browser driver exists (`render-check` exits 3), say the page was not visually checked. |
| 8 | **DELIVER** | Write the file to the user's path if given; else `<project>/.tmp/html-artifacts/<slug>.html` when the repo git-ignores `.tmp/`; else `./<slug>.html`. **Never deliver from the session scratch dir (`$TMPDIR`)** - it is deleted when the session ends. Present the absolute path, the requirement ledger (✓ covered / – waived with reason), **the chosen theme / layout / header / density** (explicit or derived), and anything not verified. Open it with `open <file>`. |

### Scale - pick the path by the size of the job

| Size | Typical request | Path |
|---|---|---|
| **S** - one answer | "this data as a chart", "compare A and B", one diagram, one table | 1–3 sections. No blueprint, no nav. `header: "compact"`, the visual first, one `callout` (tldr) stating the takeaway. A KPI row only if there are ≥ 2 headline numbers. |
| **M** - one document | report, dashboard, proposal, review, spec of one feature (4–10 sections) | Blueprint if the genre matches (`reference/10` §1.1), else compose. Conclusion first (`callout` tldr or `kpi`), then evidence (charts / tables / diagrams), then detail; `prose` for narrative. `brief.requirements` for every ask. |
| **L** - a document set | architecture docs, research reports, multi-team specs, handbooks (≥ 8 titled sections or several chapters) | `layout: "stack"` + `chapter` on the first section of each part → sticky contents rail with scroll tracking (inline contents box below 1100px). Executive summary chapter first. Section `id`s for cross-links (`[see risks](#risks)`), `navTitle` for short contents labels. Keep each chapter a complete argument (claim → evidence → implication). If one page passes ~40 sections, split it into several artifacts that link to each other. |

Whatever the size: every chart has a title that states what it shows (with unit and period),
every number carries its unit, the most important thing on the page is visually the largest,
and nothing the user asked for is missing (the ledger proves it).

### Deterministic build (recommended path)

To assemble reliably from a JSON spec, use the bundled tools. For the 11 common document genres, start from a **blueprint** (`templates/blueprints/<id>.spec.json` - complete working specs with Japanese sample data + `_recipe` adaptation guide; genre table in `reference/10-composition-standards.md` §1.1) and swap in real data instead of writing a spec from zero:

```bash
node tools/build.mjs <spec.json> <out.html>     # spec check → auto-composes core CSS + module + interactions.js
node tools/render-check.mjs <out.html> --shots=<dir>   # browser gate at 1280/390px + screenshots - then look at them
node tools/validate.mjs <out.html>              # static contract validation (PASS/FAIL)
node tools/reachability.mjs                     # selection gate - run after editing index/components.json
```

`build.mjs` has 39 section types - the core `kpi` / `chart` / `table` / `diagram` / `device` /
`screenflow` / `stepper` / `timeline` / `comparison` / `decision` / `tabs` / `collapsible` /
`callout` / `prose` (Markdown body text) / `html` passthrough plus the v2+v7 set incl. `checklist` /
`form` / `arch-explorer` / `pipeline-flow` / `service-catalog` / `request-trace` / `event-catalog` /
`deployment-topology` / `failure-modes` (full list in `reference/07` §2) - and
draws diagrams by **computing coordinates from the data**
 (eliminating hand-assembly errors). `screenflow` renders an app's whole flow as target-aware
lo-fi screens + labeled transition arrows + per-screen captions; `target: "web-app"` uses
browser-window frames, while `mobile-app` uses phone/tablet frames. `decision` renders a weighted
criteria×options matrix with score bars, per-cell rationale, computed totals, and a verdict callout. `interactions.js` is always inlined into every output. When `theme` / `layout` / `header`
are not set in the spec, `build.mjs` derives them from the section mix (the mapping table below)
and logs one line to stdout, e.g. `defaults: theme=midnight layout=bento header=compact (rule 3:
kpi + 2 charts; explicit spec keys override)` - explicit keys always win. For how to write the
spec, see `reference/07-build-spec.md`.

**Nothing fails silently.** Before writing, the builder checks the spec (`reference/07` §4): an
unknown section type, an enum typo (`theme` / `layout` / `header` / `density` / `target` /
`viewport` / `nav`), missing or non-numeric chart data, a dangling diagram edge, an uncovered
requirement or leftover blueprint sample data stops the build with a "did you mean" hint; a key
the renderer never reads is a warning. Read every warning - each one is content that would not
appear on the page.

**Hand-pasted modules in a spec:** put the markup in an `html` section and declare its CSS with
`"cssModules": ["okr-board"]` (or use the module id as the type). Never paste `<style data-module>`
blocks into a spec - the builder always inlines the canonical CSS from `templates/modules/`.

### Current UI / project scan mode

Use this mode whenever fidelity to an existing project matters: "current UI", "existing
screen", "copy this page", "make an HTML mock matching the app", "before/after from the
running app", browser annotations, attached screenshots, or a local URL/route. Read
`reference/08-project-scan.md` before assembling. The scan is evidence, not the deliverable:
temporary notes/screenshots go in a scratch dir (`mktemp -d`), but the final output is
still exactly one self-contained `.html`, delivered per phase 8.

Minimum evidence set:

- **Repo scan:** project instructions, framework, routes/screens, components, CSS variables,
  design tokens, theme config, public assets, icon system, and product language.
- **Running app scan when feasible:** full-page screenshots plus target element screenshots at
  desktop/tablet/mobile, accessibility/ARIA structure, real text/content, computed styles for
  representative containers/text/controls/cards, and local image/video/font usage.
- **State scan:** scroll before clicking; then test click, hover, focus, time-based, and resize
  changes. Record the interaction model and all visible states before rendering controls.
- **Mapping:** map scanned colors/spacing/type/radius to html-artifacts semantic tokens and
  modules. If the built-in themes do not match, choose the closest theme and add semantic
  inline token overrides. Embed required local assets as data URLs or inline SVG/CSS so the
  output remains offline.

If browser automation or the dev server is unavailable, do a repo-only scan and state the
fidelity limitation in the delivery message. Do not silently fall back to the generic
`birchline`/`stack`/`standard` look for an as-is UI copy.

### Page axes - theme / layout / header / density (choose explicitly in phase 4)

Every artifact sets four page-level axes; the builder emits `data-layout` and `data-density`
on `<html>` (alongside `lang` / `data-theme` / `data-target` / `data-viewport`):

- **`layout`**: `stack` / `bento` (12-col grid) / `sidebar` (sticky side rail + main) / `split` (hero + 2-col)
- **`header`**: `standard` / `compact` (one baseline row) / `banner` (full-bleed tinted band) / `split` (title left, meta right) / `none` (floating controls strip only)
- **`density`**: `comfortable` (default) / `compact` / `spacious` - rescales the whole spacing scale via `--sp-unit`
- **`theme`**: one of the 10 themes - explicit always wins

When an axis is not set explicitly, derive it from the section-type mix - **first matching
rule wins; each derived value fills only the axes the spec leaves unset** (`density` always
defaults to `comfortable`):

| # | Condition (section types present) | theme | layout | header |
|---|---|---|---|---|
| 1 | `screenflow` or `device` | `interactive-warm` | `stack` | `compact` |
| 2 | `decision` | `slate` | `stack` | `split` |
| 3 | `kpi` AND ≥2 `chart` | `midnight` | `bento` | `compact` |
| 4 | `chart` or `table` | `nord` | `bento` | `compact` |
| 5 | `diagram` | `dark-focus` | `stack` | `compact` |
| 6 | `stepper` or `timeline` | `forest` | `stack` | `banner` |
| 7 | `comparison` | `rose` | `stack` | `banner` |
| 8 | otherwise | `birchline` | `stack` | `standard` |

**New spec keys** (all optional; old specs without any new key still build and validate PASS):

- Top-level: `layout`, `header`, `density`, `meta` (`[{ "k": "…", "v": "…" }]` - header
  metadata rendered as a property strip in `standard` / `banner` / `split` headers), `nav`
  (`auto` / `rail` / `toc` / `none` - contents navigation, `reference/07` §1.5), `brief` + `covers`
  (requirement ledger, §1.6).
- Per-section navigation: `chapter` (starts a numbered chapter), `id` (anchor), `navTitle`
  (contents label).
- Per-section: `span` (integer 1–12; `bento`/`split` grid column span), `area`
  (`"main"`/`"side"`; `sidebar` layout, default `"main"`), `emphasis`
  (`"hero"`/`"normal"`/`"quiet"`; any layout - `hero` gets an accent-tinted `.section-hero`
  panel, `quiet` demotes the section to `.section-quiet`), `variant` (per-module, below),
  `size` (`chart` bar/line: `"sm"`/`"md"`/`"lg"`), `density` (`table`: `"compact"`).

**Module variants** (full contract in `reference/04-module-catalog.md`):

- `kpi` `variant`: `"cards"` (default) / `"inline"` (one bordered strip of `.metric-inline` cells) / `"hero"` (first metric featured large, rest stacked beside it)
- `chart` `size` (bar/line only): plot heights `sm`=160 / `md`=240 / `lg`=330. Bar/line text is HTML (readable at any width); also `target` (goal line), `highlight` (one bar), multi-series lines (`labels` + `series[{label, values}]`), `filter: true` (click to highlight a category)
- `kpi` items: `dir` (`up`/`down`/`flat` - the arrow) and `tone` (`good`/`bad`/`neutral` - the colour). **A falling latency / churn / cost is `dir:"down", tone:"good"`**; the default colours up green and down red.
- `table` `density:"compact"`: tighter `dt-compact` padding + 13px cells
- `comparison`: columns auto-fit to the option count (`--cmp-cols` = min(options, 4))
- `decision` `variant`: `"detailed"` (default) / `"compact"` (rationale moves from visible `dm-note` text into the cell's `title` tooltip)

**Theme personality**: each theme also carries a structural personality (its own `--radius-*` /
letter-spacing overrides across three silhouettes: warm-editorial `birchline`/`rose`/`forest`/`minimal`,
bold-sans `sunset`/`nord`/`interactive-warm`, technical-compact `slate`/`midnight`/`dark-focus`).
Themes never touch `--sp-*` / `--sp-unit` or `--container-max` - spacing is owned by the
`density` axis, and page width is owned by the layout/artifact so light/dark toggles do not
resize the page. Full table: `reference/03-themes-and-palettes.md`.

### Themes

`birchline` (default) / `dark-focus` / `interactive-warm` / `minimal` / `midnight` /
`slate` / `forest` / `rose` / `nord` / `sunset`. A single `<html data-theme="…">` attribute
restyles every element. Use the `data-theme-toggle` button to toggle to dark. Themes change
corner radii and letter-spacing as well as colors (the structural personality summarized under
"Page axes" above) - but never spacing, which belongs to the `density` axis.

**Precision-engineered foundation** (`tokens.css` + `elements.css`, theme-independent): the
type stacks use clean **offline** OS-resident geometric sans + CJK system fonts (`Hiragino Sans`,
`Apple SD Gothic Neo`, `Noto Sans JP/KR`) and coding mono with fluid `clamp()` sizing (`--type-display`
to `--type-caption`) so headings never overpower CJK/Latin mixed layouts; a **clean solid page
surface** (`--bg-page` with zero SVG noise grain, zero decorative mesh blobs, and zero page-load
bounce animations); and `1px` semantic borders (`color-mix()`) instead of thick left-border rails.
Every theme's text, muted text, and accent pairs clear WCAG AA (`node tools/contrast-audit.mjs`:
60/60 pairs pass, 0 below AA). See `reference/03-themes-and-palettes.md`.

### Modules (`templates/modules/` · 117 of them, 5 families)

**Discover modules via the index, not by reading files.** `index/COMPONENTS.md` is the
canonical, AI-scannable catalog (one block per module: summary · section · *use when* ·
*avoid when* · keywords · *intent* EN·KO·JA · *input* · related); `index/components.json`
is the same data machine-readable. Both are generated from `index/components.json` by
`node tools/index.mjs`, which also validates that every module file has an entry and every
entry maps to a real builder section. Full per-module prop/CSS contracts stay in
`reference/04-module-catalog.md` - open it only for the modules you picked from the index.

- **charts** (35): `kpi-grid` · `stat-trend` · `chart-bar`/`-line`/`-donut` · `chart-stacked` (bar+area) · `gauge` · `radar` · `funnel` · `progress` · `chart-bullet` · `heatmap` · `cal-heatmap` · v3: `chart-scatter` (scatter/bubble) · `chart-waterfall` · `treemap` · `spectrum` (1-D scale) · v4: `slope-chart` (2-point compare) · `dot-plot` (range+gap) · `waffle` (part-of-100) · `boxplot` (distribution) · `chart-area` (stacked composition) · `bump-chart` (rank trajectory) · v5: `histogram` (distribution bins) · `chart-combo` (bar+line dual axis) · `sparkline` (inline metric rows) · `pareto` (80/20 bars+cumulative) · `progress-ring` (circular %) · `chart-bubble` (x/y+size) · v6: `leaderboard` (standings+movement) · `composition-bar` (one-strip 100%) · `diverging-bar` (mirrored series) · `cohort-grid` (retention staircase) · `tag-cloud` (weighted tags) · `pictogram` (icon units)
- **diagrams** (37): `arch-explorer` (interactive topology + scenario filters + component inspector; routes edges around nodes and places every label by collision search) · `pipeline-flow` (multi-stage data/event pipeline) · `request-trace` (latency waterfall - what each hop of one request costs) · `deployment-topology` (region→zone→unit, replicas, DR posture) · `flow-diagram` · `arch-diagram` · `erd` · `node-graph` · `mindmap` · `timeline` · `stepper` · `mockup-frame` · `screen-flow` · `wireframe-block` · v3: `sequence-diagram` (UML lifelines) · `state-diagram` · `swimlane` · `gantt` (roadmap) · `cycle-loop` (PDCA) · `org-chart` · `kpi-tree` (driver tree) · `journey-map` (stages + emotion curve) · v4: `fishbone` (cause→effect) · `sankey` (quantity flow) · `decision-tree` (conditions→outcomes) · `hub-spoke` (center+satellites) · `concentric` (containment rings) · `force-field` (driving vs restraining) · v5: `roadmap` (period×theme bands) · `process-chevron` (linear stage arrows) · `layer-stack` (named layers) · `story-map` (backbone+release rows) · `capability-map` (nested capability tiles) · v6: `okr-board` (objectives+KR progress) · `business-model-canvas` (9-block BMC) · `gap-analysis` (as-is→gap→to-be) · `maturity-ladder` (level staircase)
- **interactive** (7): `data-table` · `tabs` · `collapsible` · `tree` · `slider-control` · `kanban-board` · `form-fields` (themed prototype form; submit wired by `HA.formMock`)
- **document** (30): `service-catalog` (service/component specification directory) · `event-catalog` (producer→event→consumers fan-out with delivery guarantees) · `failure-modes` (component→failure→blast radius→mitigation, severity-sorted) · `callout-box` · `comparison-grid` · `decision-matrix` · `diff-block` · `stat-list` · `activity-feed` · `empty-state` · `checklist` (real themed checkbox/radio/switch list) · v3: `quadrant` (2×2) · `pyramid` · `venn` · `before-after` (as-is/to-be) · `risk-matrix` · v4: `swot` · `pros-cons` · `rating-scale` (Likert rows) · `glossary` (term→definition) · v5: `raci-matrix` (R/A/C/I badges) · `toc` (document nav) · `code-snippet` (syntax-role listing) · `agenda` (time-slot program) · v6: `project-status` (RAG workstream board) · `calendar-month` (month grid+events) · `changelog` (versioned release notes) · `key-takeaways` (numbered TL;DR) · `file-tree` (static dir listing) · `api-endpoint` (REST reference unit)
- **content** (8): `feature-grid` (icon capability/"what's included" cards - capabilities, included-items, release highlights; usable in specs/reports) · v4: `persona-card` (UX archetype profile) · `quote-block` (pull-quote/testimonial) · v5: `faq` (static Q&A) · `pricing-table` (plan selection) · `hero-cta` (landing opener) · v6: `team-grid` (member cards) · `logo-wall` (social-proof strip)

The 17 v3 + 18 v4 + 18 v5 + 18 v6 modules are hand-pasted (`section: (manual)` in the index - not builder
sections); discover them the same way via `node tools/index.mjs --find`, contracts in
`reference/04-module-catalog.md` §"v3 modules" / §"v4 modules" / §"v5 modules" / §"v6 modules".

Intent → composition recipes live in `reference/02-decision-criteria.md` §2. Shapes the
shape catalog maps directly to these modules:

- **architecture** ("시스템 아키텍처 / 전체 흐름 / システム構成 / architecture"): `arch-explorer` is the
  centrepiece - 2D topology + scenario filters + component inspector, with edges routed
  around intervening nodes and every label placed by collision search. Never hand-write
  the SVG: pass `nodes`/`edges`/`zones`/`scenarios` to `section.type: "arch-explorer"`
  and let the builder do the geometry.
  **One topology diagram is not an architecture document.** A reader who cannot follow
  your diagram usually needs a different *question* answered, not a prettier box. Add the
  view that answers the question actually being asked:
  - "what happens end to end, and where does the time go?" → `request-trace`
  - "who emits this event and who reacts to it?" → `event-catalog`
  - "where does this actually run / what about failover?" → `deployment-topology`
  - "what happens when this falls over?" → `failure-modes`
  - "what transforms the data at each stage?" → `pipeline-flow`
  - "what are all the components and where do they live in the repo?" → `service-catalog`
  **Heed the builder's warnings.** `arch-explorer` self-audits and prints a `warn:` line
  when an edge still crosses an unrelated node, a label could not be placed clear, or a
  scenario step points at an edge missing from `edges` (that step then highlights nothing -
  the panel reads fine while the diagram stays dead). Each warning names the offender; fix
  the spec rather than shipping a diagram the reader cannot follow.
- **app-flow** ("앱 전체 흐름 / 화면 흐름 / 画面遷移 / user flow"): `screen-flow` - every screen as a
  target-aware lo-fi wireframe, adjacent screens joined by arrows labeled with the transition
  condition, each screen captioned in plain language. For `web-app`, use browser-window frames
  (`frame:"browser"` or top-level `target:"web-app"`); for `mobile-app`, use phone/tablet frames.
  Editable variant: `wireframe-block`.
- **decision** ("의사결정 / 뭘 선택 / どれを選ぶ / which should we pick"): `decision-matrix` - weighted
  criteria × options with score bars and a one-line rationale per cell, computed weighted totals,
  and a verdict callout stating the pick and why.

### Interactions (`templates/core/interactions.js` · 24 behaviors · auto-wired via data attributes)

`themeToggle / sortable / filter / kanban / copy / switcher / slider / tabs / zoompan /
fitSvgText / dragNode / tree / crossfilter / paginate / tooltip / counter / reveal / reorder /
wfedit / wfflow / designpick / formMock / archExplorer / tocSpy`. Each behavior is isolated with `try/catch`, and is a no-op if the target attributes are absent. (`fitSvgText` automatically clamps overflowing `<text>` labels inside SVG diagram nodes and concentric rings across CJK/Latin fonts; `formMock` intercepts a `[data-form-mock]` form's submit so a prototype form confirms in place and never navigates.)

**Form-control primitives** (`elements.css`, Layer 1 - CSS only, no JS): themed `<input>` / `<textarea>` / `<select>` / checkbox / radio / `.switch` toggle / `.field` / `.option-row` / `.checklist`. A raw control now takes the theme's accent, radius, and dark/light surface instead of the bare OS widget; the unchecked checkbox/radio edge uses `--text-muted` for a ≥3:1 boundary on every theme. Surfaced as the `checklist` and `form` builder sections / the `checklist` and `form-fields` modules.

**wireframe-block is a drag-editable screen-flow editor** (`HA.reorder` + `HA.wfedit` + `HA.wfflow` + `HA.designpick`).
It supports: adding elements from a palette (**16 primitives** + nestable layout containers),
reorder / cross-board moves via drag or keyboard, generating screens from **19 page templates** (18 named screens + blank)
with auto-routed SVG arrows, runtime switching of **4 wireframe skins** (sketch / clean / blueprint / mono)
and the 10 themes, and layout JSON export. It stays completely static if the attributes are absent.
For the `data-*` contract and implementation details, see `reference/05-components-interactions.md` §3.9–§3.12.

### Constraints (must always uphold)

- Never use any external library or CDN (Vanilla only, works offline)
- Colors **only via semantic tokens** (never write raw hex directly)
- Diagrams **only as inline SVG** (no ASCII diagrams; `role="img"`+`aria-label`/`<title>` required)
- The output is always a **single, self-contained** `.html`
- No dead controls in prototypes or UI proposals: every visible `<button>` or link that looks
  clickable must either be wired with an existing `data-*` interaction, a scoped custom inline
  script, or a real destination/action. If it is only illustrative, render it as non-interactive
  markup (`span`, `div`, chip, badge), never as an inert `<button>` or `href="#"`.
- Target-aware rendering is mandatory: if the target is `mobile-app`, the first meaningful
  preview must be phone/app-shaped, not a generic web page, dashboard, or landing hero.
- Language-aware rendering is mandatory: if the prompt/project language is Korean, visible
  artifact labels and explanatory copy should be Korean. Keep only canonical flags and
  implementation identifiers in English.
- Choose structure and visual treatment from the user's purpose, content, interaction and
  project evidence. Record the selected axes in the spec; do not rotate them based on previous
  deliveries or randomness. Reuse a fitting composition for the same conditions.

---

## Reference Files

Consulted during generation (`reference/`). Counts and full listings are owned by these
documents (themes = 03 / modules = 04 / behaviors = 05); other documents only reference them.

- `reference/01-overview-and-flow.md` - Overview, 8 phases, 5-skill integration mapping, 5-layer architecture
- `reference/00-target-surface.md` - Shared target surface detection and rendering contract
- `reference/02-decision-criteria.md` - HTML decision, shape catalog (integration of 7 shapes + 11 types)
- `reference/03-themes-and-palettes.md` - Theme, palette selection, token spec, structural personality, density axis
- `reference/04-module-catalog.md` - Variables, classes, lineage, and builder variants of every module
- `reference/05-components-interactions.md` - Data-attribute contract for every `interactions.js` behavior (§3.9–§3.12 = wireframe-block editor)
- `reference/06-usage-guide.md` - Practical steps: assemble → fill → validate → deliver
- `reference/07-build-spec.md` - JSON spec format for `tools/build.mjs` (sections, target/viewport, layout/header/density axes, content-aware defaults, fallbacks)
- `reference/08-project-scan.md` - Evidence-first scan protocol for copying or redesigning the current project UI
- `reference/09-framework-scan-playbooks.md` - Framework detection and route/component/token scan playbooks, including Next.js App Router
- `reference/10-composition-standards.md` - Document blueprints (genre → template table, `templates/blueprints/`), composition rules (C1–C8), typography rules (T1–T7: the 7 `--type-*` roles, fine-tuning protocol), spacing/color rules, verification gate
- `examples/` - Self-contained samples per shape (report / spec / dashboard / editor / diagram / code-review / app-flow / decision)

## Index (module discovery - search, don't read everything)

1. **Search:** `node tools/index.mjs --find "<keywords>"` → top candidates ranked by tag/keyword/intent (EN·KO·JA)/use-when. Korean & Japanese queries match directly.
2. **Drill in:** `node tools/index.mjs --details <id> [<id>…]` → the chosen modules' full contract only.
3. Fallbacks (no tool): `index/INDEX.md` (~9KB, one line each) → `index/COMPONENTS.md` (full prose index) → `reference/04-module-catalog.md` (full CSS/markup).

- `index/components.json` - single source of truth: rich routing metadata for all 117 modules (`id` · `family` · `section` · `summary` · `useWhen` · `avoidWhen` · `keywords` · `intent{en,ko,ja}` · `inputShape` · `variants` · `interaction` · `relatedTo` · `a11y`). `INDEX.md` / `COMPONENTS.md` are generated from it.

## Tools

- `tools/build.mjs` - Deterministic build of a single `.html` from a JSON spec (runs the spec check first; prints the requirement ledger)
- `tools/lib/spec-check.mjs` - the spec check: enums, section types, required data, unread keys (did-you-mean), requirement ledger, blueprint sample-data leaks
- `tools/render-check.mjs` - **browser gate**: opens the page headless at 1280/390px, audits layout (`tools/lib/render-audit.js`: overflow, dead anchors, tiny / colliding / clipped text, orphan rows, empty sections, console errors) and saves screenshots to look at
- `tools/validate.mjs` - Static validation gate for self-containment, tokens, SVG a11y, and (warn-level) WCAG AA contrast of the active theme / custom accent
- `tools/index.mjs` - `--find "<q>"` search · `--details <id>` drill-in · (no args) regenerate `INDEX.md`+`COMPONENTS.md` from `components.json` · `--check` validate module↔entry↔builder-section sync
- `tools/reachability.mjs` - **Selection gate.** Replays every module's own intent phrases (EN·KO·JA) through the real `--find` scoring and asserts each module (1) wins rank 1 on at least one of its own phrases, (2) never falls below rank 3 on any, and (3) has a documented `relatedTo`/`avoidWhen` link to whatever outranks it. Registering a module makes it *exist*; this is what makes it *findable*. Run it after ANY edit to `index/components.json` - a module nobody retrieves is a module nobody uses.
- `tools/lib/search.mjs` - the retrieval scoring shared by `index.mjs --find` and the gate, so the gate measures the path agents actually walk. Whole-token matching for latin terms, substring for CJK, stopwords dropped, and an IDF weight so a term like "diagram" (which most of the diagram family contains) cannot outrank a distinctive one.
- `tools/contrast-audit.mjs` - WCAG AA contrast audit of every theme in `themes.css` (`--json` / `<theme>` to scope). Advisory; the measurement tool behind the validator's contrast warning. See `reference/03-themes-and-palettes.md` §2.
