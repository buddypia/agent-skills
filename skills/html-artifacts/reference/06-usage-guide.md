# 06  usage guide - steps to assemble a new artifact

> **Role of this document**: the owner document for the **assembly procedure** - both the deterministic build path (Step 0.5) and the manual path (Steps 1–6). Facts owned elsewhere are only referenced here: theme details and WCAG values → `03-themes-and-palettes.md`, the full module catalog → `04-module-catalog.md`, interaction contracts → `05-components-interactions.md`, the build spec format → `07-build-spec.md`.

This document is a recipe for building **a single zero-dependency, self-contained `.html` file** with the html-artifacts system. You copy `base.template.html`, choose a theme and the page axes (layout / header / density), inline the core CSS in the correct order, pour in modules, fill in the `{{variables}}`, and finally pass the self-containment checklist.

All assembly source files are under `templates/`; the deterministic builder and the validator are under `tools/`.

```
templates/
├── base.template.html          ← Layer 4: starting point (copy source)
├── core/                       ← Layer 0–1 + 3
│   ├── reset.css               Layer 0 Foundation (box-model / focus / print)
│   ├── tokens.css              Layer 0 Foundation (spacing / radius / type / font / motion / --cat-*)
│   ├── themes.css              Layer 0 Foundation (color palettes for 10 themes)
│   ├── elements.css            Layer 1 Primitives (.card / .btn / .badge / table …)
│   └── interactions.js         Layer 3 Behaviors (wires behaviors via data attributes)
└── modules/                    ← Layer 2 Modules (117 blocks - catalog owned by reference/04 + index/)
```

The flow of the 5-layer architecture is **Foundation (reset/tokens/themes) → Primitives (elements.css) → Modules (modules/*) → Behaviors (interactions.js) → Shapes (base.template + combinations)**. The inline order reflects this layer order directly.

---

## Step 0 - Decide whether to output (HTML over Markdown)

For short output that the agent itself reads, or where the diff is clear at a glance, keep it **as Markdown**. Make it HTML when it is intended to be read by a human and includes elements like the following.

| Make it HTML | Keep it as Markdown |
| --- | --- |
| Needs visual hierarchy / diagrams / charts / interactivity | Short output whose diff fits in 1 sentence |
| Over 100 lines / multi-dimensional / spatial / for sharing | An intermediate artifact the agent consumes in the next step |
| report / plan / explainer / spec | Mere logs or command output |

---

## Step 0.5 - Deterministic build path (recommended)

Before assembling by hand, consider the deterministic builder. It produces the same kind of single-file artifact from a JSON spec, with the core CSS inlined in the correct order automatically and every chart/diagram coordinate computed from data (no `Date`, no `Math.random` - the same spec yields byte-identical output):

```
node tools/build.mjs spec.json out.html      # spec check → ONE self-contained .html
node tools/render-check.mjs out.html --shots=<dir>   # browser check at 1280/390px + screenshots
node tools/validate.mjs out.html             # static contract check → PASS/FAIL, exit 0/1
```

When to use which path:

| Use `tools/build.mjs` | Assemble by hand (Steps 1–6) |
| --- | --- |
| Data-driven charts (bar / line / donut) - bar heights, line points, donut dasharray math are computed for you | Free-form layout that no spec section type covers |
| Diagrams that need auto-layout (layered / grid / radial / vertical) - no overlapping nodes, no guessed coordinates | Bespoke composition or custom markup inside modules |
| Standard report / dashboard shapes raised from structured data | One-off experimental shapes |

How to write the spec (section types, fields, `target` / `theme` / `layout` / `header` / `density` values) is documented in `reference/07-build-spec.md`. Set the page axes **explicitly** in the spec; when `theme` / `layout` / `header` are omitted, the builder derives them deterministically from the section mix and logs one line, e.g. `defaults: theme=midnight layout=bento header=compact (rule 3: kpi + 2 charts; explicit spec keys override)` - read that line and confirm the derived look is what you want. The builder checks the spec first: an unknown section `type`, an invalid `target` / `theme` / `layout` value, missing chart data or an uncovered requirement stops the build with a "did you mean" hint, and keys a renderer never reads are reported as warnings (07 §4). Whichever path you take, finish with `tools/render-check.mjs` + `tools/validate.mjs` (Step 6) and look at the screenshots.

---

## Step 1 - Copy `base.template.html`

Copy `templates/base.template.html` to a new file name. This is the only entry point (Layer 4 / Shape skeleton). Its internal structure is as follows.

- `<html lang="{{LANG}}" data-theme="{{THEME}}" data-target="{{TARGET}}" data-viewport="{{VIEWPORT}}" data-layout="{{LAYOUT}}" data-density="{{DENSITY}}">`
- One `<style>` inside `<head>` (inline the core CSS and module CSS here)
- In `<body>`: `.page-header` (theme toggle button + viewport controls + eyebrow + h1 + lede; header variants `header-compact` / `header-banner` / `header-split` / `page-controls` available per Step 2), `<main class="container layout-{{LAYOUT}}">` (modules here - `layout-stack` replaces the former page-level `stack-lg`), `.page-footer`
- One `<script>` just before `</body>` (inline `interactions.js` here)

The template's header comment documents the 4 layouts, 5 header variants, 3 densities, the emphasis classes (`.section-hero` / `.section-quiet`), and the fact that `--span` is set per section in the `bento` / `split` layouts.

The list of `{{VARIABLES}}` to fill:

| Variable | Use | Example |
| --- | --- | --- |
| `{{LANG}}` | Document language | `ja` / `en` / `ko` |
| `{{THEME}}` | Theme name | `birchline` / `dark-focus` / `interactive-warm` / `minimal` / `midnight` / `slate` / `forest` / `rose` / `nord` / `sunset` |
| `{{TARGET}}` | `data-target` attribute value on `<html>` - the target surface | `mobile-app` / `web-app` / `desktop-app` / `document` / `diagram` |
| `{{VIEWPORT}}` | `data-viewport` attribute value on `<html>` - the initial viewport | `phone` / `tablet` / `desktop` |
| `{{LAYOUT}}` | `data-layout` on `<html>` **and** the `layout-…` class on `<main>` - the page layout | `stack` / `bento` / `sidebar` / `split` |
| `{{DENSITY}}` | `data-density` on `<html>` - the spacing density | `comfortable` / `compact` / `spacious` |
| `{{TITLE}}` | `<title>` and `<h1>` | `Q2 Sales Report` |
| `{{EYEBROW}}` | The mono uppercase kicker above the title (optional) | `QUARTERLY REPORT` |
| `{{SUBTITLE}}` | The 1-line lede below the title (optional) | `Performance summary for April–June 2026` |
| `{{CONTENT}}` | Combine modules inside `<main>` | (Step 4) |
| `{{FOOTER}}` | The footer line (source / date / author) | `Source: internal BI / 2026-06-07` |
| `{{LABEL_THEME}}` | Visible text of the theme toggle button (`[data-theme-toggle]`) | `Theme` / `テーマ` |
| `{{LABEL_TOGGLE_THEME}}` | `aria-label` of the theme toggle button | `Toggle dark mode` |
| `{{LABEL_VIEWPORT_CONTROLS}}` | `aria-label` of the viewport control group (`[data-target-controls]`) | `Viewport controls` |
| `{{LABEL_PHONE}}` | Visible label of the `data-viewport-target="phone"` button | `Phone` / `スマホ` |
| `{{LABEL_TABLET}}` | Visible label of the `data-viewport-target="tablet"` button | `Tablet` |
| `{{LABEL_DESKTOP}}` | Visible label of the `data-viewport-target="desktop"` button | `Desktop` |

All `{{LABEL_*}}` values are visible UI label strings - localize them to the same display language as `{{LANG}}` (the user/product language). Note: any `{{ }}` left unfilled makes `tools/validate.mjs` FAIL on its leftover-placeholder check (Step 6a).

The placeholders `{{CORE_CSS}}` / `{{MODULE_CSS}}` inside `<style>` and `{{INTERACTIONS_JS}}` inside `<script>` are replaced with the contents of the actual files in later steps.

---

## Step 2 - Choose a theme and the page axes (layout / header / density)

The theme switches via the single `<html data-theme="…">` attribute. The mechanism is that `themes.css` overrides colors - plus each theme's structural personality (`--type-*` / `--radius-*`) - in the `[data-theme="…"]` scope.

Alongside the theme, choose the three page axes **explicitly** (never let all of them fall to the defaults unexamined - the validator flags the all-defaults "default sandwich" look, Step 6a):

| Axis | Where it goes | Values |
| --- | --- | --- |
| layout | `data-layout` on `<html>` + `layout-…` class on `<main>` | `stack` (vertical flow) / `bento` (12-col grid, per-section `style="--span:N"`) / `sidebar` (`.layout-side` rail + `.layout-main`) / `split` (full-width `.section-hero` + 2-col grid) |
| header | the `.page-header` markup variant | `standard` / `compact` (one baseline row) / `banner` (full-bleed tinted band via `.header-banner-inner`) / `split` (title left + `<dl class="header-meta">` right) / `none` (floating `.page-controls` strip only) |
| density | `data-density` on `<html>` | `comfortable` (default) / `compact` / `spacious` - rescales `--sp-unit`, hence the whole `--sp-*` scale |

Per-shape recommendations live in `02-decision-criteria.md` §2.2–2.4; the builder's content-aware derivation table in `07-build-spec.md` §1.1; the theme personality + density tokens in `03-themes-and-palettes.md`. Choose the combination from the current requirements and project evidence, record it in the spec, and reuse it for the same conditions.

| Theme | Mood | accent | Suited for |
| --- | --- | --- | --- |
| `birchline` (default) | Warm, earthy, professional | clay `#D97757` | report / spec / long-form |
| `dark-focus` | Dark background, inner glow | blue `#64B5F6` | data-viz / diagram / code |
| `interactive-warm` | White base, strong shadows | blue `#5B8DEF` | prototype / editor |
| `minimal` | Serif headings, calm reading tone, ample whitespace | gray `#555555` | essay / long-form document |
| `midnight` | Deep violet dark, soft glow highlights | violet `#A78BFA` | dashboard / data-viz / diagram |
| `slate` | Light professional blue-gray, crisp and corporate | blue `#3B6FB0` | report / spec / dashboard |
| `forest` | Light green-earth tones, calm and organic | green `#3F7D5A` | report / documentation / long-form |
| `rose` | Light warm magenta, soft and approachable | magenta `#C2496D` | product pages / lighter reports |
| `nord` | Arctic dark (Nord palette), cool frost accent | frost `#88C0D0` | code / diagram / data-viz |
| `sunset` | Warm amber dark, cozy ember glow | amber `#F2994A` | dashboard / data-viz |

Palette details (raw colors, shadows, `--on-accent` pairs) and the measured WCAG contrast values are owned by `03-themes-and-palettes.md`; this table is only a picker.

Points:

- `birchline` also applies to `:root`, so it doubles as the default values.
- Every theme carries a structural personality - its own `--type-*` / `--radius-*` overrides (three silhouettes: serif-editorial `birchline`/`rose`/`forest`/`minimal`, bold-sans `sunset`/`nord`/`interactive-warm`, technical-compact `slate`/`midnight`/`dark-focus`; exact values in `03-themes-and-palettes.md` §2). Themes never override `--sp-*` / `--sp-unit` or `--container-max` - spacing belongs to the density axis, and page width belongs to the layout/artifact.
- **Custom palette**: You can inline-override the accent like `<html data-theme="birchline" style="--accent:#2563EB;--on-accent:#fff">`. Because `--cat-1` references `--accent`, the chart base color follows along too.
- **Dark toggle**: The `[data-theme-toggle]` button in `base.template.html` is wired by `interactions.js`'s `HA.themeToggle`, and clicking it ping-pongs between `dark-focus` and the original theme (the original theme is saved to `dataset.prevTheme`).

---

## Step 3 - Inline core CSS in the correct order

Paste the contents of each file into the single `<style>` in `<head>`, **in this order**. The order is exactly the layer order, and since later parts are expected to override earlier ones, swapping them is strictly prohibited.

```
1. core/reset.css      ← first. box-model / focus-visible / print / .sr-only / .hidden
2. core/tokens.css     ← spacing (--sp-unit + density axis) / radius / type / font / motion / --cat-* (color-independent scale)
3. core/themes.css     ← colors + structural personality (--type-*/--radius-*) for 10 themes (defines semantic aliases)
4. core/elements.css   ← Primitives (.card / .btn / table … that reference semantic aliases)
5. The <style data-module="…"> block of the modules used (added in Step 4)
```

Why this order:

- `tokens.css` **references colors that themes.css defines later**, like `--cat-2: var(--color-info, …)` (CSS variables are evaluated at use time, so the order itself is lenient, but keep the layer order for readability and override rules).
- `elements.css` **references semantic aliases** like `--bg-*` / `--text-*` / `--accent`. These are defined by `themes.css`, so always place it after themes.css.
- `reset.css`'s `:focus-visible { outline: 2px solid var(--accent) }` also depends on accent, so even if placed first, variable resolution happens at runtime.

Inline `interactions.js` **last** into the `<script>` just before `</body>` (the Behaviors layer). It auto-initializes on `DOMContentLoaded`, so no extra startup code is needed.

---

## Step 4 - Pour in modules

Inside `<main>` (`{{CONTENT}}`), paste the contents of the module files you need. Each module file begins with a fixed-format header comment specifying `REQUIRES` (required core) / `MODULE CSS` (whether there is a `<style>` to inline) / `INTERACTION` (required data attributes) / `VARIABLES` / `USAGE`. **Always read the header before pasting.**

Layout hooks while placing sections: in the `bento` / `split` layouts give each direct child of `<main>` a `style="--span:N"` (1–12 columns; in `split` the hero is 12 and the rest default to 6); in `sidebar` wrap side sections in `<aside class="layout-side">` and the rest in `<div class="layout-main">`. In any layout you can emphasize a section with the class `section-hero` (accent-tinted panel) or de-emphasize it with `section-quiet`. Module variants (kpi `inline`/`hero`, chart `size`, table `dt-compact`, comparison `--cmp-cols`, decision `compact`) are catalogued in `04-module-catalog.md`.

Each module's `<style data-module="…">` block may be gathered **exactly once per kind** at the "5. module CSS" position above, or placed right before the module body (the same `<head>` `<style>` is recommended).

Wiring contracts of the 23 original modules (the 16 v2 additions - `stat-trend`,
`chart-stacked`, `gauge`, `radar`, `funnel`, `progress`, `chart-bullet`, `heatmap`,
`cal-heatmap`, `tree`, `form-fields`, `stat-list`, `activity-feed`, `empty-state`,
`checklist`, `feature-grid` - follow the same header-comment contract; discover them
via `index/INDEX.md` and see `04-module-catalog.md` for their full contracts):

| Module file | Type | MODULE CSS | INTERACTION (required data attributes / wiring) |
| --- | --- | --- | --- |
| `kpi-grid.html` | KPI metric card row | none (pure primitives) | optional count-up: `[data-counter][data-to]` (+ `data-suffix` for units) |
| `data-table.html` | sortable + filterable + paginated table | yes | `table[data-sortable]` + `input[data-filter][data-filter-in=".dt-row"]`; optional `[data-paginate][data-page-size]` + sibling `[data-pager]`, `[data-row-select]` |
| `comparison-grid.html` | side-by-side option comparison | yes | none |
| `decision-matrix.html` | weighted decision matrix (score bars + per-cell rationale + verdict callout) | yes (+ `callout-box` CSS for the verdict) | none |
| `callout-box.html` | callout box (4 variants) | yes | none |
| `diff-block.html` | code-review diff hunk | yes | none |
| `collapsible.html` | collapsible / FAQ (native `<details>`) | yes | none (no JS) |
| `tabs.html` | tab panel | yes | `[data-tabs]` + `.tab[data-tab=x]` + `[data-panel=x]` |
| `timeline.html` | vertical timeline (pure CSS) | yes | none |
| `stepper.html` | numbered vertical stepper (pure CSS, level-coloured badges + branch chips) | yes | none; optional `[data-reveal]` (+ `[data-reveal-delay]`) per `.step` for a staggered scroll-in |
| `kanban-board.html` | drag-and-drop kanban | yes | `[data-kanban]` + `[data-col]` > `.kanban-cards` > `.kanban-card` |
| `slider-control.html` | prototype tuner (range → CSS var) | yes | `input[data-slider="--var"][data-out][data-unit]` + `[data-copy-text]` |
| `chart-bar.html` | SVG bar chart | yes | CSS hover + `[data-chart-tip]` on the figure with `data-tip` per bar (floating tooltip) |
| `chart-line.html` | SVG line / area | yes | CSS hover + `[data-chart-tip]` with `data-tip` per dot |
| `chart-donut.html` | SVG donut + legend | yes | `[data-chart-tip]` with `data-tip` per segment |
| `flow-diagram.html` | SVG flowchart | yes | draggable nodes: `svg[data-draggable]` + `g[data-node]`; edges `[data-edge][data-from][data-to]` auto-track; `[data-drag-reset]` |
| `arch-diagram.html` | SVG layered architecture diagram | yes | drag (`svg[data-draggable]` + `g[data-node]` + `[data-drag-reset]`) + zoom/pan `.stage[data-zoompan]` |
| `erd.html` | ER diagram (cards + SVG connector lines) | yes | draggable nodes + `text[data-edge-label]` cardinality, wrapped in `[data-zoompan]` `g[data-viewport]`; `[data-drag-reset]` |
| `mindmap.html` | SVG radial mindmap | yes | zoom/pan stage + draggable nodes (`[data-edge]` connectors re-route live) |
| `node-graph.html` | interactive node-edge graph (zoom/pan + drag + group filter) | yes | `.stage[data-zoompan]` + `svg[data-draggable]` (`g[data-node]`, `line[data-edge][data-from][data-to]`, `[data-drag-reset]`) + `[data-crossfilter]` legend chips `[data-filter-key="g-N"]` |
| `mockup-frame.html` | CSS mobile device mockup (live screen switcher) | yes | `[data-tabs]` wraps the device; `.mock-switcher` `.tab[data-tab=x]` swaps `[data-panel=x]` screens |
| `wireframe-block.html` | low-fidelity screen-flow wireframe (grayscale) | yes | opt-in `HA.reorder` + `HA.wfedit` + `HA.wfflow` + `HA.designpick`: `[data-wf-flow]` / `[data-reorder]` pages, `[data-wf-board]` element boards, `[data-wf-palette]`; design switching via `[data-theme-pick]` / `[data-wf-skin-pick]` |
| `screen-flow.html` | static app screen-flow map (phone-framed lo-fi screens + labeled transition arrows + captions) | yes | none (fully static; builder section `screenflow`) |

The data-visualization family (chart-* / flow / arch / erd / mindmap / node-graph) are all **inline SVG** and have either `role="img" + aria-label` or `<title>`. ASCII diagrams are not used.

---

## Step 5 - Fill in the `{{variables}}`

Replace the document variables of `base.template.html` (the table in Step 1) and the `VARIABLES` of each module header with real values. Charts require coordinate calculation (the formulas are in the header's `SCALING` / `DASHARRAY MATH` / `GEOMETRY`). Examples:

- `chart-bar`: Decide `MAX`, then per bar `H = round(value / MAX * 240)`, `Y = 280 - H`, baseline `y=280`.
- `chart-line`: `y = 280 - value / MAX * 240`, x evenly spaced from 40→700.
- `chart-donut`: radius `r=80` → circumference `C = 502.65`. Each segment `seg = pct/100 * 502.65`, `gap = 502.65 - seg`, `dasharray = "seg gap"`, `offset[i] = offset[i-1] - seg[i-1]`.

Colors are **semantic tokens only** (hard-coded hex prohibited). For bg use `--bg-page/-surface/-muted/-card`, for text `--text-primary/-secondary/-muted`, for border `--border-default/-subtle`, for accent `--accent/--on-accent`, for status `--color-success/-warning/-danger/-info`, and for series `--cat-1..--cat-5`.

Reuse the available primitive classes (elements.css) instead of reinventing them: `.container` `.grid` `.grid-2/3/4/auto` `.stack` `.stack-lg` `.cluster` `.card` `.card-flat/-outlined/-elevated/-accent/-inset/-horizontal` `.btn` `.btn-ghost` `.btn-sm` `.badge(-success/-warning/-danger/-info/-accent)` `.chip` `.pro` `.con` `.sev-high/-med/-low` `.callout` `.callout-title` `.metric` `.metric-value/-label` `.metric-delta-up/-down` `.eyebrow` `.lede` `.muted` `.small` `.diff-add` `.diff-remove` `.divider-label` `.hidden` `.sr-only` `.no-print`.

---

## Step 6 - self-containment checklist

The final gate has 3 parts: the static validator (6a), the browser render check (6a′), then your own eyes on the screenshots and the live page (6b).

### 6a. What `tools/validate.mjs` checks automatically

Run `node tools/validate.mjs <file.html>` - it prints PASS/FAIL with the issues found and exits 0/1. It **fails** on:

| Check | What it catches |
| --- | --- |
| Zero external dependencies | `src` pointing at `http(s)://`, `href` to `http(s)://` on anything but an outbound `<a>` link, external `url(…)` in CSS, external `<script>`/`<link>` references - no CDN, no font, no lib, no framework |
| Zero `{{…}}` residue | any leftover `{{ }}` template placeholders |
| Document structure | missing `<!DOCTYPE html>` / `<title>` / `charset` / `viewport` / `<html lang>` |
| Target surface contract | `data-target="mobile-app"` without `data-viewport="phone"` or without a device/app frame (`.ha-device` / `data-device-frame` / `.device-frame`); `tablet-app` without `data-viewport="tablet"` |
| No protruding accent bars | rendered `ng-bar` / `node-bar` rects that are not `display:none` (the AI-slop guard) |
| Interactions actually wired | `data-draggable` present but `interactions.js`'s `dragNode` not inlined; `[data-zoompan]` without a `data-viewport` group |

It also **warns** (without failing - when warnings exist the result line reads `PASS (N warnings)`, exit code still 0) on:

- missing `data-target` / `data-viewport` on `<html>`;
- any `<svg>` lacking `role` / `aria-label` / `aria-hidden` - treat this one as a must-fix: each diagram needs either `role="img" + aria-label` or `<title>`;
- missing `data-layout` / `data-density` on `<html>`;
- the **default sandwich**: `data-theme="birchline"` + `data-layout="stack"` + none of `header-compact` / `header-banner` / `header-split` / `page-controls` + more than 3 `<!-- section` markers → "default look - confirm this is intentional". If you chose the defaults deliberately (Step 2), the warning is acceptable; if not, revisit the axes.

### 6a′. What `tools/render-check.mjs` checks in a browser

`node tools/render-check.mjs <file.html> --shots=<dir>` opens the page headless at 1280px and 390px
and **fails** on horizontal page overflow (it names the widest element), `href="#x"` with no
`id="x"`, broken images and console errors; it **warns** on text rendered below 10px (SVG text
measured after scaling), overlapping or clipped SVG labels, text spilling out of its box, a
≥ 3-column card grid whose last row holds one item, a bordered card whose text touches its border,
and empty sections. Fix every warning or say why it is acceptable. Exit 3 = no browser driver:
then check by eye and say so when delivering.

### 6b. What a human confirms by eye

Open the two screenshots first: the conclusion on the first screen, every number with its unit,
nothing cramped, truncated or louder than its importance - at both widths.

| Check | How to confirm |
| --- | --- |
| **Inline order is correct** | inside `<style>`: reset → tokens → themes → elements → module CSS, and `interactions.js` last in the `<script>` just before `</body>` (the validator does not check order) |
| **All MODULE CSS of the modules used is inlined** | every module marked "yes" in the Step 4 table has its `<style data-module="…">` pasted exactly once per kind, without omission |
| **Data attributes of interactive modules are present** | for data-table, `[data-sortable]` and `[data-filter]/[data-filter-in]`; for tabs, `[data-tabs]/[data-tab]/[data-panel]`; likewise for kanban / slider / node-graph / wireframe per the Step 4 table |
| **Colors are semantic tokens only** | no raw hex mixed into charts / diagrams (except the inline override of a custom accent) |
| **Semantic HTML / heading order** | `h1 → h2 → h3` does not skip |
| **Touch targets / AA contrast** | comfortable `.btn` and form fields are ≥40px and rise to **44px under `@media (pointer: coarse)`** (touch devices); compact utility controls (`.btn-sm` 28px, zoom/wireframe ✕ buttons 24–32px) stay smaller **by design** - keep them out of primary touch flows. Text meets AA (mind the `--text-muted` and accent-on-base caveats in `03-themes-and-palettes.md`) |
| **All features work offline** | open with the network cut: theme toggle / sort / filter / tabs / DnD all work without the net |

---

## Appendix - worked example (mini report)

A minimal example making "a KPI card row + a TL;DR callout + a sortable table" into a single file with the `birchline` theme and explicitly chosen axes (`stack` / `standard` / `comfortable` - a deliberate default look for a 3-section mini report). It is a skeleton to show **how the inline order actually lines up** (`/* … contents … */` is replaced with the actual content of each file).

```html
<!DOCTYPE html>
<html lang="en" data-theme="birchline" data-layout="stack" data-density="comfortable">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>Q2 Sales Report</title>
  <style>
    /* 1 */ /* … contents of core/reset.css … */
    /* 2 */ /* … contents of core/tokens.css … */
    /* 3 */ /* … contents of core/themes.css … */
    /* 4 */ /* … contents of core/elements.css … */
    /* 5 */ /* … the <style data-module> of data-table.html / callout-box.html … */
  </style>
</head>
<body>
  <header class="page-header container">
    <div class="page-header-top">
      <p class="eyebrow">QUARTERLY REPORT</p>
      <div class="page-header-actions no-print">
        <button class="btn-ghost btn-sm no-print" data-theme-toggle aria-label="Toggle dark mode">◐ Theme</button>
      </div>
    </div>
    <h1>Q2 Sales Report</h1>
    <p class="lede">Performance summary for April–June 2026</p>
  </header>

  <main class="container layout-stack">

    <!-- module: kpi-grid (no MODULE CSS, pure primitives) -->
    <section aria-label="Key metrics">
      <div class="grid grid-auto">
        <article class="card-outlined metric">
          <span class="metric-label">Sales</span>
          <span class="metric-value">¥4.2M</span>
          <span class="metric-delta-up">▲ 12%</span>
        </article>
        <article class="card-outlined metric">
          <span class="metric-label">New customers</span>
          <span class="metric-value">318</span>
          <span class="metric-delta-down">▼ 4%</span>
        </article>
      </div>
    </section>

    <!-- module: callout-box (TL;DR variant, MODULE CSS already inlined in head) -->
    <div class="callout callout-box callout-tldr">
      <svg class="callout-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.8" role="img" aria-label="Summary">
        <path d="M5 4h14v16l-7-3-7 3z"/>
      </svg>
      <div>
        <p class="callout-title">Key points</p>
        <div class="callout-body"><p>Sales were +12% over the previous quarter. New customers dipped slightly, so the next quarter will strengthen acquisition efforts.</p></div>
      </div>
    </div>

    <!-- module: data-table ([data-sortable] + [data-filter] wired by interactions.js) -->
    <input type="text" data-filter data-filter-in=".dt-row" placeholder="Filter by customer name…">
    <table data-sortable>
      <thead><tr><th>Customer</th><th>Sales</th><th>Status</th></tr></thead>
      <tbody>
        <tr class="dt-row"><td>Acme</td><td>¥1.8M</td><td><span class="badge badge-success">Active</span></td></tr>
        <tr class="dt-row"><td>Globex</td><td>¥0.9M</td><td><span class="badge badge-warning">At risk</span></td></tr>
      </tbody>
    </table>

  </main>

  <footer class="page-footer container">Source: internal BI / 2026-06-07</footer>

  <script>
    /* last */ /* … contents of core/interactions.js … */
  </script>
</body>
</html>
```

Self-containment points of this example:

- The order inside `<style>` is the **5 stages** reset → tokens → themes → elements → module.
- `kpi-grid` has no MODULE CSS, so it is markup only. `data-table` / `callout-box` have their `<style data-module="…">` already inlined in `<head>` (the "5" position).
- The theme toggle / filter / sort are auto-wired by `interactions.js` on `DOMContentLoaded`, so no extra startup JS is needed.
- Zero external references, colors are semantic tokens only, and the SVG glyph has `role="img"`.
