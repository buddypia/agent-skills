# 01 - Overview and Flow (Unified HTML System: Overview and Flow)

> **Role of this document**: owner of the system-wide picture - the 8-phase generation flow, the 5-layer architecture, and the unification history.
> For details, defer to the owner docs: themes → `03-themes-and-palettes.md` · modules → `04-module-catalog.md` · interaction behaviors → `05-components-interactions.md`.

This document explains the big picture of the **Unified HTML System**, which consolidates five legacy skills. It describes what the system is for (WHY), the generation flow (8 phases), how the 5 skills were unified and de-duplicated, and the structure of the 5-layer architecture, all grounded in the actual files.

---

## 1. What is this system / why was it built

### 1.1 Purpose

From user input (reports, specs, code reviews, dashboards, diagrams, etc.), generate **a single self-contained `.html` file**. The output satisfies the following.

- **Dependency-free**: no CDN, no external libraries, no `<link href=URL>`, no `<script src=URL>`. Vanilla HTML/CSS/JS only.
- **Offline operation**: no build step required. Opens directly in a browser.
- **Semantic-token driven**: colors always go through meaning tokens such as `--bg-*` / `--text-*` / `--accent`. Never write hardcoded hex values directly.
- **One-attribute theme switching**: changing the value of `<html data-theme="...">` alone restyles every element.
- **Axis-driven page variety**: the page-level silhouette is set by explicit axes - `data-layout` (`stack` / `bento` / `sidebar` / `split` on `<html>` + a `layout-…` class on `<main>`), the header variant (`standard` / `compact` / `banner` / `split` / `none`), and `data-density` (`comfortable` / `compact` / `spacious`) - so the same modules can ship as very different pages instead of one fixed header→single-column→footer sandwich.

The header comment of `base.template.html` states this contract directly - "Produces ONE self-contained .html file: no CDN, no build step, opens offline in any browser."

### 1.2 Why it was unified (WHY)

Before unification, five skills coexisted, each **independently re-declaring** the same UI atoms such as card / badge / table / callout, and the same scale tokens such as spacing / radius / type / font. On top of that, **9 separate JS files** were scattered around for interactions.

This duplication created the following problems.

| Problem | Resolution through unification |
| --- | --- |
| The same tokens (spacing/radius/type/font) duplicated across four theme files | Defined **only once** in `tokens.css`. Themes override colors plus a limited `--type-*`/`--radius-*` personality - never spacing (`--sp-*`/`--sp-unit`, owned by the density axis) |
| card / badge / table / callout declared redundantly across 5 skills | Consolidated into the Primitives in `elements.css` |
| A separate JS file for each interaction (9 files) | Unified into the **single library** `interactions.js`. Auto-attached via data attributes |
| Inconsistent criteria for "when should it be HTML" | Unified into the DECIDE phase described below |
| Diagrams varied between ASCII / external-library dependent, etc. | Unified to all-inline SVG (`role="img"` + `aria-label` / `<title>`) |

The header comment of `tokens.css` also makes this explicit - "This file exists to DE-DUPLICATE: the original 4 theme files each repeated spacing / radius / type / font tokens."

---

## 2. Generation flow: 8 phases

Proceed from input to `.html` output through the following 8 phases. The flow builds on the 5 phases of the legacy `html-artifacts`, explicitly adding decision (DECIDE), target surface detection (TARGET), and validation (VALIDATE).

```
DECIDE → BRIEF → TARGET → (SCAN if current UI) → DETECT → THEME+LAYOUT → ASSEMBLE → FILL → VALIDATE → LOOK → DELIVER
```

The optional SCAN gate (phase 2b) fires when the request references the current/existing
UI: check the spec-preview UI cache first and reuse it when fresh, otherwise follow
`reference/08-project-scan.md` - the owner document for the scan protocol.

| # | Phase | What it does | Assets referenced |
| --- | --- | --- | --- |
| 1 | **DECIDE** | Decide whether it should be HTML in the first place. HTML if visual hierarchy, diagrams, interactivity, or shareability are needed; Markdown if it is for agent self-consumption. | Decision criteria (derived from the legacy html-over-markdown) |
| 1b | **BRIEF** | Size the job (S / M / L, `SKILL.md` "Scale") and record every explicit ask as `brief.requirements`; sections claim them with `covers`, and the build fails while one is uncovered (`07-build-spec.md` §1.6). | the user's request |
| 2 | **TARGET** | Determine whether the artifact represents a mobile app, web app, desktop app, document, or diagram. Browser delivery is not the same as Web UI. | `reference/00-target-surface.md` |
| 3 | **DETECT** | Automatically determine the output **shape** (report / spec / code-review / data-viz / diagram / infographic / prototype / editor, etc.) from the input. | shape list (derived from the legacy html-artifacts) |
| 4 | **THEME+LAYOUT** | Choose the four page axes **explicitly**: one of 10 themes (each with its own structural personality - full list owned by `03-themes-and-palettes.md`), a layout (`stack` / `bento` / `sidebar` / `split`), a header variant (`standard` / `compact` / `banner` / `split` / `none`), and a density (`comfortable` / `compact` / `spacious`). Silent defaults are a contract violation; per-shape recipes are owned by `02-decision-criteria.md`, the content-aware derivation table by `07-build-spec.md` §1.1. If needed, override the custom accent with `style="--accent:#HEX;--on-accent:#fff"`. | `core/themes.css` + `core/tokens.css` + `core/elements.css` |
| 5 | **ASSEMBLE** | Using `base.template.html` as the skeleton, arrange the necessary modules into `{{CONTENT}}` (`<main class="container layout-…">` - one layout class per the chosen axis; per-section `--span` in `bento`/`split`, `area` wrappers in `sidebar`). Core CSS in the order **reset → tokens → themes → elements → module CSS**, and JS inlines `interactions.js` last, just before `</body>`. | `base.template.html` + `modules/*` |
| 6 | **FILL** | Fill each module's `{{VARIABLES}}` with real data. For diagrams, compute and fill the SVG coordinates. For mobile-app, use a device frame. | The VARIABLES section in the module header |
| 7 | **VALIDATE** | Spec check before building (types, enums, required data, requirement ledger, blueprint sample leaks); `render-check.mjs` in a headless browser at 1280 / 390px (overflow, dead anchors, tiny / colliding text, orphan rows, console errors); `validate.mjs` for the static contract (zero external dependencies / colors via tokens / SVG a11y / target surface). | `tools/lib/spec-check.mjs`, `tools/lib/render-audit.js` |
| 7b | **LOOK** | Open the screenshots and judge what no check can: is the answer on the first screen, is every number labelled, is anything cramped or louder than it deserves. Fix and rebuild. | render-check screenshots |
| 8 | **DELIVER** | Finalize `{{TITLE}}` `{{EYEBROW}}` `{{SUBTITLE}}` `{{FOOTER}}` `{{LANG}}` and output as a single `.html`, stating the chosen theme / layout / header / density in the delivery message. | The VARIABLES of `base.template.html` |

### Key points of the flow

- **DECIDE, TARGET, and VALIDATE are newly added gatekeepers**: at the entrance, "is it worth making this HTML" and "which surface does it represent"; at the exit, "are we breaking the contract." The central phases (DETECT→THEME→ASSEMBLE→FILL→DELIVER) correspond to the core generation flow of the legacy html-artifacts.
- **Strict inline ordering**: breaking the order `reset.css → tokens.css → themes.css → elements.css → module CSS` specified by `base.template.html` causes semantic tokens to be referenced while still undefined.

---

## 3. Unification and de-duplication of the 5 skills (mapping table)

The unification sources are the following 5 skills.

- **html-artifacts** - the foundational 5-phase flow + its output shapes + themes
- **html-visual** - the visual / interaction types (re-implemented dependency-free, however)
- **html-over-markdown** - decision criteria for HTML-ification + principles
- **html-artifact2** - clean, human-facing report templates
- **html-flowchart-anthropic** - flowchart styling

### 3.1 Feature → unified home (legacy skill feature → unified home)

| Legacy skill / feature | Unified home | De-duplication point |
| --- | --- | --- |
| html-artifacts: 5-phase flow | 8-phase flow (DECIDE/TARGET/VALIDATE added) | Kept the 5 core generation stages, made decision, target detection, and validation explicit |
| html-artifacts: shapes | Layer 4 `base.template.html` + module composition | A shape is expressed as a "theme + module combination" |
| html-artifacts: original theme files | Layer 0 `core/themes.css` (now 10 themes - see `03-themes-and-palettes.md`) | The original theme files' spacing/radius/type/font duplication consolidated into `tokens.css` |
| html-artifacts: card/badge/table/callout atoms | Layer 1 `core/elements.css` | The atoms that 5 skills redundantly declared, into one place |
| html-visual: visual types | Layer 2 `modules/*` (chart-bar/line/donut, flow-diagram, erd, mindmap, kanban-board, mockup-frame, wireframe-block, data-table, timeline, arch-diagram) | External-library dependencies (Mermaid/D3, etc.) re-implemented with inline SVG / vanilla JS |
| html-visual: 9 separate JS files | Layer 3 `core/interactions.js` (one library) | Auto-attached via data attributes. Per-component scripts abolished |
| html-over-markdown: decision criteria / principles | Phase 1 **DECIDE** + callout-box / comparison-grid / tabs module | The "should it be HTML" criteria embedded at the head of the flow |
| html-artifact2: human-facing report templates | Layer 1 primitives (metric/KPI, pro/con, sev-*) + kpi-grid / callout-box / comparison-grid module | Clean report elements decomposed into atoms + modules |
| html-flowchart-anthropic: flow styling | Layer 2 `modules/flow-diagram.html` (lineage noted) | Warm background, pastel nodes, and orthogonal connectors absorbed into flow-diagram |
| (legacy) demo2's self-contained patterns | data-table / kanban-board / mockup-frame / wireframe-block / mindmap | Implementations such as HTML5 DnD, tables, and mobile mockups modularized |

> Term note: **demo2** is a local demo collection that predates this unified system; its self-contained implementation patterns (HTML5 DnD, tables, mobile mockups) were absorbed into the modules above, and the name now survives only as a lineage label in module headers.

### 3.2 The 3 principles of de-duplication

1. **Tokens only once**: structural scales (spacing/radius/type/font/motion) are consolidated into `tokens.css`. Themes override **colors plus a bounded structural personality** (`--type-*` / `--radius-*` / letter-spacing - the per-theme table is owned by `03-themes-and-palettes.md`); spacing (`--sp-*` / `--sp-unit`) is never theme-owned - it belongs to the density axis.
2. **Atoms only once**: card / badge / table / callout / metric / pro-con / sev are consolidated into `elements.css`, and every module / shape references them.
3. **Behavior is one library**: the 9 JS files are unified into `interactions.js`, auto-initialized via the data-attribute markup contract (`HA.init` on `DOMContentLoaded`).

---

## 4. The 5-layer architecture (with file paths)

The unified system stacks into 5 layers from bottom to top. Each layer depends only on the layers below it.

```
Layer 4  Shapes        base.template.html + compositions
Layer 3  Behaviors     core/interactions.js
Layer 2  Modules       templates/modules/*
Layer 1  Primitives    core/elements.css
Layer 0  Foundation    core/reset.css + core/tokens.css + core/themes.css
```

> Note: In the self-labels of the file header comments, reset / tokens / themes / base.template are marked as "Layer 0 / Foundation" and "Layer 4 / Shape skeleton," elements as "Layer 1 / Primitives," and interactions as "Layer 3 / Behaviors." In this document, following the task definition, they are organized as 5 layers: Foundation→Primitives→Modules→Behaviors→Shapes. Modules are treated as an independent layer between Behaviors (interactions.js) and Shapes (base.template).

### Layer 0 - Foundation (reset / tokens / themes)

The theme-independent base, plus the color palettes.

| File | Role | Main contents |
| --- | --- | --- |
| `templates/core/reset.css` | Normalization of box model, motion, focus, and print | `*{box-sizing}`, `@media (prefers-reduced-motion)`, `.no-print` in `@media print`, `:focus-visible` ring, `.sr-only` / `.hidden` |
| `templates/core/tokens.css` | Structural tokens common across themes + the **density axis** | spacing `--sp-1..--sp-8` derived from the unit `--sp-unit` (4px; `[data-density="compact"]` = 3.25px, `[data-density="spacious"]` = 4.75px), radius `--radius-xs/sm/md/lg/pill`, font `--font-sans/mono/serif`, type `--type-display/h1/h2/h3/body/small/caption`, `--container-max`, motion `--ease`/`--dur-*`, categorical `--cat-1..--cat-5` |
| `templates/core/themes.css` | The colors **and structural personality** of the 10 themes (scoped by `[data-theme="..."]`) | `birchline` (default) / `dark-focus` / `interactive-warm` / `minimal` are the four representative themes; the full list of all 10, how to choose, and each theme's `--type-*`/`--radius-*` personality overrides are owned by `03-themes-and-palettes.md`. Each theme provides raw colors → semantic aliases (`--bg-*`/`--text-*`/`--border-*`/`--accent`/`--on-accent`) + `--shadow-sm/md/lg`; themes never override `--sp-*`/`--sp-unit` (spacing is owned by the density axis) |

The full picture of semantic tokens (**components must reference these aliases and never reference raw values**):

- Background: `--bg-page` / `--bg-surface` / `--bg-muted` / `--bg-card`
- Text: `--text-primary` / `--text-secondary` / `--text-muted`
- Border: `--border-default` / `--border-subtle`
- Accent: `--accent` / `--on-accent`
- Status: `--color-success` / `--color-warning` / `--color-danger` / `--color-info`
- Series (data-viz): `--cat-1..--cat-5` (reuses accent + status colors)

### Layer 1 - Primitives (elements.css)

Theme-aware UI atoms. Because they reference only semantic aliases, the single `data-theme` attribute restyles every module / shape.

File: `templates/core/elements.css`

Main primitive classes:

- Layout: `.container` `.stack` `.stack-lg` `.cluster` `.grid` `.grid-2/3/4/auto`
- **Page-layout axis**: `.layout-stack` `.layout-bento` `.layout-sidebar` (+ `.layout-side` / `.layout-main`) `.layout-split` - exactly one on `<main>` per the `layout` axis (`--span` per child in bento/split)
- **Header variants**: `.header-compact` `.header-banner` (+ `.header-banner-inner`) `.header-split` (+ `.header-meta`) `.page-controls` - per the `header` axis
- **Section emphasis**: `.section-hero` `.section-quiet`
- **KPI variants**: `.kpi-strip` / `.metric-inline`, `.kpi-hero` / `.metric-hero` / `.kpi-hero-rest`
- Page chrome: `.page-header` `.page-footer`, `section`
- Typography: `.eyebrow` `.lede` `.muted` `.small` (+ `h1/h2/h3`)
- Cards (7 kinds): `.card` `.card-flat` `.card-outlined` `.card-elevated` `.card-accent` `.card-inset` `.card-horizontal`
- Buttons: `.btn` `.btn-ghost` `.btn-sm`
- Badges / chips: `.badge` (`.badge-success/-warning/-danger/-info/-accent`) `.chip`
- Evaluation set: `.pro` `.con` `.sev-high/-med/-low`
- Annotation: `.callout` `.callout-title`
- Metrics: `.metric` `.metric-value` `.metric-label` `.metric-delta-up/-down`
- Tables / code: `table` `thead th` `tbody td`, `code` `pre` `kbd`, `.diff-add` `.diff-remove`
- Other: `.divider-label`

### Layer 2 - Modules (modules/*)

Composable parts. The header comment of each file carries `MODULE` / `lineage` / `PURPOSE` / `VARIABLES` / `REQUIRES` / `MODULE CSS` / `INTERACTION` / `USAGE` (exemplars: `kpi-grid.html`, `chart-bar.html`). 39 modules in total.

Directory: `templates/modules/`

| module file | Kind | INTERACTION | lineage (excerpt) |
| --- | --- | --- | --- |
| `kpi-grid.html` | Metrics row | counter (count-up via `[data-counter]`) | html-visual(dashboard) + html-artifacts(report) |
| `callout-box.html` | Annotation box | None | html-artifacts(report) + html-over-markdown |
| `comparison-grid.html` | Side-by-side comparison | None | html-artifacts(spec) + html-over-markdown |
| `decision-matrix.html` | Weighted decision matrix (score bars + rationale + verdict) | None | comparison-grid + html-over-markdown(comparison) |
| `diff-block.html` | Code-review diff | None | html-artifacts(code-review) + html-over-markdown |
| `data-table.html` | Sortable + live-filter table | sort + filter + paginate + row-select | html-visual(table) + demo2 |
| `kanban-board.html` | Drag-and-drop kanban | kanban drag-and-drop | html-visual(kanban) + demo2(HTML5 DnD) |
| `slider-control.html` | Prototype tuner | slider (live CSS var) + copy | html-visual(prototype) + html-artifacts(editor) |
| `tabs.html` | Tab panel | tabs | html-over-markdown(spec) + html-artifacts(report) |
| `collapsible.html` | Expand/collapse / FAQ | Native `<details>` (no JS) | html-artifacts(report/spec) + html-visual |
| `chart-bar.html` | SVG bar chart | tooltips (`[data-chart-tip]`) + CSS hover | html-visual(chart/dashboard) |
| `chart-line.html` | SVG line / area | tooltips (`[data-chart-tip]`) + CSS hover | html-visual(chart/dashboard) |
| `chart-donut.html` | SVG donut | tooltips (`[data-chart-tip]`) | html-visual(chart/dashboard) |
| `flow-diagram.html` | SVG flowchart | draggable (nodes + auto-routed edges) | html-visual(diagram) + html-flowchart-anthropic |
| `erd.html` | ER diagram | zoompan + draggable | html-visual(diagram) + html-artifacts(spec) |
| `mindmap.html` | Radial mindmap | zoompan + draggable | html-visual(diagram/mindmap) + demo2 |
| `arch-diagram.html` | Layered architecture diagram | draggable (nodes only; zones static) | html-visual(diagram/architecture) |
| `node-graph.html` | Interactive node-edge graph (zoom/pan, drag, cross-filter) | zoompan + draggable + crossfilter | html-visual(diagram/graph) + demo2(arch/erd interactive) |
| `timeline.html` | Vertical timeline (pure CSS) | None | html-visual(diagram) + html-artifacts(report) |
| `stepper.html` | Numbered vertical stepper (pure CSS) | None (optional `[data-reveal]` scroll-in) | staged-enforcement-stepper.template.html (tokenised) |
| `mockup-frame.html` | Mobile-device mockup | tabs (screen switcher) | html-visual(mockup) + demo2 |
| `wireframe-block.html` | Low-fi wireframe | reorder + wfedit + wfflow + designpick (opt-in) | html-visual(wireframe) + demo2 |
| `screen-flow.html` | Static app screen-flow map (phone frames + labeled arrows + captions) | None | mockup-frame(chrome) + wireframe-block(lo-fi) |

Per-module interaction contracts are owned by `04-module-catalog.md` and `05-components-interactions.md`; this column is a summary only.

> Every diagram (chart / flow / erd / mindmap / arch) is **inline SVG** and carries `role="img"` + `aria-label` or `<title>` (ASCII diagrams are not used). Each module that has a `<style data-module="...">` block inlines it only once.

### Layer 3 - Behaviors (interactions.js)

A single, dependency-free interaction library. It unifies the 9 separate JS files and auto-attaches via the data-attribute markup contract. `HA.init` starts on `DOMContentLoaded`, and errors inside each handler are isolated (one module's failure does not break others).

File: `templates/core/interactions.js`

> This table shows 7 representative behaviors. `interactions.js` wires **23 behaviors** in total (the `HA.*` handlers) - the complete data-attribute contract is owned by `05-components-interactions.md`.

| data-attribute contract | Behavior |
| --- | --- |
| `[data-theme-toggle]` | Toggle the theme back and forth between `dark-focus` and the previous theme |
| `table[data-sortable]` | Column sort on `<th>` click (asc/desc toggle, automatic numeric/string detection) |
| `[data-filter]` + `[data-filter-in]` | Live-filter by toggling `.hidden` on target elements as you type |
| `[data-kanban]` + `[data-col]` + `.kanban-card` | Drag and drop cards between columns (states `.dragging` / `.drop-target`, the destination is `.kanban-cards`) |
| `[data-copy]` / `[data-copy-text]` | Copy the target's text / literal to the clipboard |
| `[data-slider]` (`input[type=range]`) + `[data-out]` | Reflect the value live into a CSS var and update the readout (`data-unit` supported) |
| `[data-tabs]` | A `.tab` button shows the corresponding `[data-panel]` |

> `[data-collapsible] > summary` works via native `<details>`, so no JS is needed (the contract is left only as an a11y hook).

### Layer 4 - Shapes (base.template + compositions)

The single entry point for all artifacts. Fill the `{{VARIABLES}}`, inline the core CSS/JS, and compose modules into `{{CONTENT}}` to build a shape.

File: `templates/base.template.html`

Variables to fill:

| Variable | Content |
| --- | --- |
| `{{LANG}}` | Document language (`ja` / `en` / `ko`) |
| `{{THEME}}` | One of the 10 theme names (default `birchline`) - full list owned by `03-themes-and-palettes.md` |
| `{{TARGET}}` | Target surface on `<html data-target>`: `mobile-app` / `web-app` / `desktop-app` / `document` / `diagram` |
| `{{VIEWPORT}}` | Initial viewport on `<html data-viewport>`: `phone` / `tablet` / `desktop` |
| `{{LAYOUT}}` | Page layout on `<html data-layout>` + the `layout-…` class on `<main>`: `stack` / `bento` / `sidebar` / `split` |
| `{{DENSITY}}` | Spacing density on `<html data-density>`: `comfortable` / `compact` / `spacious` |
| `{{TITLE}}` | `<title>` + H1 |
| `{{EYEBROW}}` | Mono uppercase kicker above the title (optional) |
| `{{SUBTITLE}}` | One-line lede below the title (optional) |
| `{{CONTENT}}` | Modules from `templates/modules/` are composed here |
| `{{FOOTER}}` | Footer line (source, date, author, etc.) |
| `{{LABEL_THEME}}` | Visible text of the theme-toggle button (all `{{LABEL_*}}` are localized to the user/product language) |
| `{{LABEL_TOGGLE_THEME}}` | `aria-label` of the theme-toggle button |
| `{{LABEL_VIEWPORT_CONTROLS}}` | `aria-label` of the viewport-switcher control group (`[data-target-controls]`) |
| `{{LABEL_PHONE}}` / `{{LABEL_TABLET}}` / `{{LABEL_DESKTOP}}` | Visible text of the three viewport-switcher buttons (`[data-viewport-target]`) |
| `{{CORE_CSS}}` / `{{MODULE_CSS}}` | Inline placeholders inside `<style>`: core CSS (reset → tokens → themes → elements), then the CSS of the modules used |
| `{{INTERACTIONS_JS}}` | Inline placeholder inside `<script>` just before `</body>`: paste `interactions.js` here |

Inline order (strict):

1. Inside `<style>`: `reset.css` → `tokens.css` → `themes.css` → `elements.css` → the CSS of the modules used
2. Inside `<script>` (just before `</body>`): `interactions.js`

For a custom palette, override by adding `style="--accent:#HEX;--on-accent:#fff"` to `<html>`. The theme toggle is the `[data-theme-toggle]` button, which cycles to and from `dark-focus`.

---

## 5. Dependency direction and the boundaries you "must not break"

```
Shapes (base.template)
   └─ uses → Modules (modules/*)
                 └─ require → Primitives (elements.css)
                                  └─ reference → Foundation semantic tokens (tokens/themes)
   └─ wires → Behaviors (interactions.js) ── via data-attributes only
                                  └─ resets/print/focus ← Foundation (reset.css)
```

- Upper layers depend only on lower layers. Primitives and Modules **never write raw colors directly**; they always reference Foundation's semantic aliases.
- Interactions are **via data attributes only** (do not write per-component `<script>`).
- Diagrams are **inline SVG only** (ASCII / external libraries forbidden), with `role="img"` + `aria-label` / `<title>` required.
- The output is always a **single, self-contained, offline-working** `.html`.
