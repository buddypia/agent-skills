# 07 - Build Spec (the `tools/build.mjs` JSON contract)

This document is the **canonical reference for the JSON build spec** - the input format of `tools/build.mjs`. The builder turns one spec file into ONE self-contained, offline, dependency-free `.html` artifact: core CSS is inlined in the correct layer order automatically, charts and diagrams are rendered from **data** (coordinates computed, not guessed), and module CSS is pulled from the canonical module files. The build is deterministic - no `Date`, no `Math.random` - so the same spec always produces byte-identical output.

```
node tools/build.mjs <spec.json> <out.html>      # spec check → build (nothing is written if the spec check fails)
node tools/validate.mjs <out.html>               # static gate: PASS/FAIL + issues, exit 0/1
node tools/render-check.mjs <out.html> --shots=<dir>   # browser gate at 1280/390px + screenshots (§5a)
```

**The spec is checked before anything is built** (§4): unknown section types, enum typos
(`theme` / `layout` / `header` / `density` / `target` / `viewport` / `nav`), missing required
data, non-numeric chart values, mismatched series lengths, dangling diagram edges, keys a
renderer never reads, uncovered requirements and leftover blueprint sample data all stop the
build with a "did you mean …" hint instead of shipping a page that quietly lost content.

A complete working sample lives at `examples/example-spec.json`.

> **Name collision note**: `examples/example-spec.html` is an example *artifact* whose **shape** is "spec" (a specification document rendered as HTML, regenerated deterministically from `examples/specs/example-spec.spec.json` by this builder). It is **not** a JSON build spec and has nothing to do with the input format described here. The build-input sample is `examples/example-spec.json` - same stem, different role.

---

## 1. Top-level fields

| Field | Type | Required | Behavior |
| --- | --- | --- | --- |
| `title` | string | recommended | `<title>` and `<h1>`. Also feeds language inference. |
| `theme` | string | no | `data-theme` on `<html>`. Any of the 10 theme names - see `03-themes-and-palettes.md` for the catalog. If absent, **derived from the section mix** (§1.1) - an explicit value always wins. A name outside the catalog fails the spec check (§4). |
| `layout` | string | no | `"stack"` / `"bento"` / `"sidebar"` / `"split"` - the page layout (§1.2). Sets `data-layout` on `<html>` and the `layout-<name>` class on `<main>`. If absent, derived from the section mix (§1.1). |
| `header` | string | no | `"standard"` / `"compact"` / `"banner"` / `"split"` / `"none"` - the header variant (§1.3). If absent, derived from the section mix (§1.1). |
| `density` | string | no | `"comfortable"` (default - always, never content-derived) / `"compact"` / `"spacious"`. Sets `data-density` on `<html>`; rescales the whole spacing scale via `--sp-unit` (§1.4). |
| `meta` | array | no | `[{ "k": "…", "v": "…" }]` key/value pairs rendered in the header as `<dl class="header-meta">` (e.g. Version / Owner / Status). Shown by the `standard`, `banner`, and `split` header variants (§1.3). No default. |
| `lang` (alias `language` / `locale`) | string | no | Explicit `ko` / `ja` / `en` (only the first 2 chars are read). If absent or unrecognized, the language is **inferred from the spec text** (Hangul → `ko`, kana → `ja`, else `en`). Sets `<html lang>` and localizes the builder-owned UI labels (theme toggle, table search, diagram zoom controls, "Recommended" badge, etc.). |
| `target` (alias `surface`) | string | no | One of `mobile-app` / `tablet-app` / `web-app` / `desktop-app` / `document` / `diagram` (see `00-target-surface.md`). Default `document`. Any other value fails the spec check (§4). |
| `viewport` (alias `defaultViewport`) | string | no | `phone` / `tablet` / `desktop`. If absent or invalid, derived from `target`: `mobile-app` → `phone`, `tablet-app` → `tablet`, else `desktop`. Sets `data-viewport` on `<html>`. |
| `eyebrow` | string | no | The mono uppercase kicker above the `<h1>`. |
| `subtitle` | string | no | The 1-line `.lede` below the `<h1>`. |
| `footer` | string | no | The footer line (source / date / author). |
| `palette` | object | no | Inline accent override on `<html>`: `{ "accent": "#2563EB", "onAccent": "#fff", "colorPrimary": "…", "extra": ";--foo:bar" }`. `accent` is required when `palette` is present; `onAccent` defaults to `#fff`; `extra` is a raw CSS declaration string appended verbatim. |
| `nav` | string | no | `"auto"` (default) / `"rail"` / `"toc"` / `"none"` - in-page navigation for long documents (§1.5). |
| `brief` | object | no | The requirement ledger: `{ "requirements": [{ "id", "text", "must"?, "waived"? }] }` - every explicit ask of the user, one row each (§1.6). |
| `covers` | array | no | Requirement ids satisfied by the page as a whole (theme, language, tone…). Sections carry their own `covers`. |
| `sections` | array | yes (in practice) | Content blocks rendered in order into `<main class="container layout-<layout>">` (the builder emits exactly one `layout-*` class - `layout-stack` instead of the former `stack-lg`; the `.stack-lg` class itself remains in the CSS for manual use). Each entry is an object with a `type` field - see §2–3. |

The builder always emits two additional attributes on `<html>`: `data-layout="<layout>"` and `data-density="<density>"` (alongside the existing `lang` / `data-theme` / `data-target` / `data-viewport`).

For app targets (`mobile-app` / `tablet-app` / `desktop-app`) the builder additionally injects the viewport switcher (Phone / Tablet / Desktop buttons, synced to the `?viewport=` URL param) and the target-surface CSS - no spec field needed.

### 1.1 Content-aware defaults - `deriveDefaults(spec)`

When `theme` / `layout` / `header` are not set explicitly, the builder derives them **deterministically from the section-type mix**. The FIRST matching rule wins; the selected rule fills **only the axes the spec leaves unset** (an explicit key always wins, per axis). `density` is never content-derived - it defaults to `"comfortable"` always.

| # | condition (section types present) | theme | layout | header |
|---|---|---|---|---|
| 1 | `screenflow` or `device` | `interactive-warm` | `stack` | `compact` |
| 2 | `decision` | `slate` | `stack` | `split` |
| 3 | `kpi` AND ≥2 `chart` | `midnight` | `bento` | `compact` |
| 4 | `chart` or `table` | `nord` | `bento` | `compact` |
| 5 | `diagram` | `dark-focus` | `stack` | `compact` |
| 6 | `stepper` or `timeline` | `forest` | `stack` | `banner` |
| 7 | `comparison` | `rose` | `stack` | `banner` |
| 8 | otherwise | `birchline` | `stack` | `standard` |

**Logging**: the builder always logs one line to stdout stating the resolved axes, the matched rule, and which keys were explicit vs derived, e.g.:

```
defaults: theme=midnight layout=bento header=compact (rule 3: kpi + 2 charts; explicit spec keys override)
```

### 1.2 Layouts (`layout` key)

`<main>` always keeps `container`; the builder adds exactly one `layout-<name>` class.

- **`stack`** - `<main class="container layout-stack">`; children flow vertically as before (`.layout-stack > * + *` gets a `--sp-6` top margin).
- **`bento`** - `<main class="container layout-bento">`; a 12-column grid (gap `--sp-5`, items top-aligned). The builder **always** emits `style="--span:N"` on each direct child: the section's explicit `span` key if given, else the **default span map** `{ kpi: 12, chart: 6, callout: 6 (a `tldr` callout: 12), collapsible: 6, timeline: 6, stepper: 6, radar / funnel / stacked charts / feed: 6, everything else: 12 }`. A row that default-span sections leave part-empty (e.g. a third chart alone) is filled by widening its last default-span section; explicit spans are never changed. Below 960px everything collapses to full width.
- **`sidebar`** - the builder groups sections by their `area` key into two wrappers:

  ```html
  <main class="container layout-sidebar">
    <aside class="layout-side">…area:"side" sections…</aside>
    <div class="layout-main">…area:"main" sections…</div>
  </main>
  ```

  The side rail is `minmax(230px, 300px)` wide and sticky (`.layout-side`); the main column stacks (`.layout-main`). Below 900px it collapses to a single column and the rail unsticks. **Fallback**: if `layout: "sidebar"` is requested but **no** section has `area: "side"`, the builder downgrades to `stack` and logs a warning line.
- **`split`** - `<main class="container layout-split">`; a 12-column grid whose **hero section** (the first section with `emphasis: "hero"`, else the first section) gets `--span:12` plus the class `section-hero`; the remaining children default to `--span:6` unless `span` is given.

### 1.3 Header variants (`header` key)

The theme-toggle button and (for app targets) the viewport controls are emitted in **every** variant, same as before.

- **`standard`** - unchanged: `<header class="page-header container">` with eyebrow / `<h1>` / lede. If `meta` is present, a `<dl class="header-meta">` is appended under the lede.
- **`compact`** - `<header class="page-header header-compact container">`; one baseline flex row in the order eyebrow (if any) → `<h1>` (at `--type-h2` size) → lede (small, muted).
- **`banner`** - a full-bleed tinted band: `<header class="page-header header-banner">` wrapping `<div class="container header-banner-inner">` with eyebrow / `<h1>` (at `--type-display`, max 24ch) / lede / meta. The accent gradient comes from semantic tokens (`color-mix` of `--accent` into `--bg-page`); the controls sit inside `.header-banner-inner`.
- **`split`** - `<header class="page-header header-split container">`: title block left, `<dl class="header-meta">` right (uppercase `dt` captions, mono `dd` values), grid-aligned to the baseline; single column below 720px.
- **`none`** - no title header at all (the title lives only in `<title>`); the builder emits just a floating controls strip `<header class="page-controls no-print">` (absolute, top/right `--sp-4`) holding the theme-toggle / viewport buttons.

### 1.4 Density (`density` key)

Sets `data-density` on `<html>`. The whole spacing scale derives from `--sp-unit` (4px), so one attribute rescales every gap/padding: `compact` = `--sp-unit: 3.25px` plus slightly smaller body/small type, `spacious` = `--sp-unit: 4.75px`, `comfortable` (default) = unchanged. Token details are owned by `03-themes-and-palettes.md` §1. Independent of the per-section `density: "compact"` key of `table` (§3), which only tightens that one table.

### 1.5 Navigation for long documents (`nav`, section `chapter` / `id` / `navTitle`)

A reader of a 15-section document needs to know where they are and jump. The builder adds
navigation from the section titles:

- **`rail`** - a sticky contents rail left of the content (`.ha-doc` > `nav.ha-rail` + `.ha-doc-main`),
  with the current section highlighted while scrolling (`HA.tocSpy`). Below 1100px the rail is
  replaced by a collapsible inline contents box at the top. Needs `layout: "stack"`; with any other
  layout the builder logs a note and uses `toc`.
- **`toc`** - only the collapsible inline contents box (`details.ha-toc-inline`) at the top of `<main>`.
- **`none`** - no navigation.
- **`auto`** (default) - `rail` when the page is a `document` / `diagram` target on `stack` **and**
  has ≥ 8 titled sections or ≥ 2 chapters; otherwise `none`. Dashboards and app previews get no rail.

Section keys that feed it: `chapter: "<name>"` on the first section of a chapter emits a numbered
chapter heading (`h2.ha-chapter`, `id="chN"`) before it and groups the contents; `navTitle` overrides
the label shown in the contents (default: the section `title`); `id` sets the section's anchor
(default `s<N>`), so prose can link to it with `[see risks](#risks)`. The render check fails on any
`href="#x"` with no matching id.

### 1.6 Requirement ledger (`brief`, `covers`)

Instructions get lost when a long request is turned into a spec. Write each explicit ask of the user
as one requirement and claim it from the section that satisfies it:

```json
{ "brief": { "requirements": [
    { "id": "R1", "text": "Q3 revenue by region as a chart" },
    { "id": "R2", "text": "Japanese labels" },
    { "id": "R3", "text": "Competitor pricing table", "waived": "no pricing data was provided - asked the user" },
    { "id": "R4", "text": "Appendix with raw numbers", "must": false }
  ] },
  "covers": ["R2"],
  "sections": [ { "type": "chart", "title": "地域別売上（Q3）", "covers": ["R1"], "series": [] } ] }
```

The builder prints the ledger (`✓ R1 … → §1 chart`) and **fails** when a requirement is covered by
nothing - unless it is `waived` (with the reason, which you must tell the user) or `must: false`.
A `covers` id that names no requirement is an error too. Report the ledger in the delivery message.

---

## 2. Sections - common shape

Each `sections[]` entry is `{ "type": "…", …type-specific fields… }`. Text fields are HTML-escaped by the renderers; only the fields explicitly documented as **raw HTML** below are injected verbatim (`html` of `html`/`device`, `tabs[].body`, `collapsible.items[].body`). The builder emits a `<!-- section N: type -->` marker before each rendered section, which is the quickest way to audit the output against the spec.

Raw HTML is also where most prototype defects happen. If raw HTML contains a visible
`<button>` or link that looks clickable, it must be wired to an existing `data-*`
interaction, a scoped custom inline script, or a real destination/action. Use non-interactive
markup for decorative chips and static affordances. Do not ship `href="#"` CTAs or inert
mock buttons.

The section types - **39 total**: **15 core** (`kpi` / `chart` / `table` / `diagram` / `device` / `screenflow` / `stepper` / `timeline` / `comparison` / `decision` / `tabs` / `collapsible` / `callout` / `prose` / `html`) + **17 added in v2** (§3a: `stattrend` / `barstacked` / `areastacked` / `gauge` / `radar` / `funnel` / `progress` / `bullet` / `heatmap` / `calendar` / `tree` / `statlist` / `feed` / `empty` / `features` / `checklist` / `form`) + **7 added in v7 architecture pass** (`arch-explorer` / `pipeline-flow` / `service-catalog` / `request-trace` / `event-catalog` / `deployment-topology` / `failure-modes` - see `04-module-catalog.md`). Pick the right one via `index/COMPONENTS.md` (the discovery index); see also `04-module-catalog.md` for full module contracts.

**Layout keys every section accepts** (all optional, on the section object alongside `type`):

| key | values | applies to | behavior |
| --- | --- | --- | --- |
| `span` | integer 1–12 | layouts `bento` / `split` | Grid column span - emitted as `style="--span:N"` on the section. Unset: the default span map (`bento`, §1.2) or 6 (`split`, hero = 12). |
| `area` | `"main"` / `"side"` (default `"main"`) | layout `sidebar` | Which wrapper the section is grouped into (§1.2). |
| `emphasis` | `"hero"` / `"normal"` (default) / `"quiet"` | any layout | `hero` adds the class `section-hero` (accent-tinted, bordered, padded panel; in `split` it also marks the full-width hero); `quiet` adds `section-quiet` (secondary text color, `h2` demoted to `--type-h3`); `normal` adds no class. |
| `id` | `[A-Za-z][\w-]*` | any | Anchor id of the section (default `s<N>`); must be unique. |
| `chapter` | string | any | Starts a numbered chapter before this section (§1.5). |
| `navTitle` | string | any | Label in the contents rail / box (default: `title`). |
| `covers` | array of ids | any | Requirements this section satisfies (§1.6). |
| `cssModules` / `module` | array / string | any (mainly `html`) | Module ids whose canonical CSS to inline (§3 `html`). |

Every other key must be one the section's renderer reads - anything else is reported as
`key "x" is not read by type "y" and is ignored - did you mean "z"?`.

Four section types additionally take a module-variant key - `kpi` and `decision` take `variant`, `chart` takes `size`, and `table` takes `density` - documented in their own tables in §3 (full rendering contracts in `04-module-catalog.md`).

---

## 3. Section types

### `kpi` - metric card row

| Field | Required | Notes |
| --- | --- | --- |
| `items` | yes | Array of metric cards. |
| `items[].label` | yes | Metric name. |
| `items[].value` | yes | Displayed value (string, e.g. `"99.97%"`). |
| `items[].valueNum` | no | Numeric target - adds `data-counter data-to` (count-up animation on reveal). |
| `items[].suffix` | no | Appended after the counted number (use with `valueNum`). |
| `items[].delta` | no | Change figure shown next to the arrow. |
| `items[].dir` | no | `"up"` (default) ▲ / `"down"` ▼ / `"flat"` →. The arrow only states direction; don't repeat it in `delta` (a leading arrow there is stripped). |
| `items[].tone` | no | `"good"` / `"bad"` / `"neutral"` - the delta's colour, i.e. what the change **means**. Default: up = good, down = bad, flat = neutral. **Set it for lower-is-better metrics** (latency, churn, cost, errors, incidents…): a falling churn rate is `dir:"down", tone:"good"`. The spec check warns when a metric that looks lower-is-better relies on the default. |
| `items[].note` | no | One muted line under the value (period, definition, source). |
| `items[].prefix` | no | Kept before the counted number (`"¥"`); inferred from `value` when omitted. |
| `title` | no | Section heading. |
| `variant` | no | `cards` (default - balanced columns: 5 → one row of 5, 6 → 3 + 3, never 4 + 1; fewer columns as the container narrows) / `inline` (one bordered `.kpi-strip` of `.metric-inline` cells) / `hero` (first item featured large in `.kpi-hero`, rest stacked beside it). See `04-module-catalog.md`. |
| `label` | no | Section aria-label (default `Key metrics`). |

```json
{ "type": "kpi", "items": [
  { "label": "Uptime", "value": "99.97%", "delta": "0.02pt" },
  { "label": "p95 latency", "value": "184ms", "valueNum": 184, "suffix": "ms", "delta": "12ms", "dir": "down", "tone": "good" }
] }
```

### `chart` - bar / line / donut (geometry and axis computed by the builder)

Bar and line charts are **HTML-hybrid**: axis labels, values and legends are HTML text, so they
stay readable at every width (an SVG `viewBox` shrank them to 6–8px in a half-width card on a
phone); bars are percentage-positioned boxes and lines a stretched SVG with non-scaling strokes.
The y-axis gets "nice" ticks (0 / 5 / 10 / 15…) with the unit inferred from `display`
(`"¥4.2M"` → ticks `¥0M … ¥5M`).

| Field | Required | Notes |
| --- | --- | --- |
| `variant` | no | `bar` (default) / `line` / `donut`. |
| `size` | no | `sm` / `md` (default) / `lg` - plot heights 160 / 240 / 330 px (**bar/line only**). |
| `title` | no | Figcaption + aria-label (the aria-label also lists every value for screen readers). |
| `series` | bar: yes | `{ "label", "value", "display"?, "highlight"?, "cat"?, "key"? }` - `value` (number, may be negative) drives geometry; `display` overrides the printed text (e.g. `"¥4.2M"`); `highlight: true` accents one bar. Up to 14 bars print their value; > 6 bars thin out the x labels on narrow screens. |
| `points` | line (one series): yes | `{ "label", "value", "display"? }` - one line with a soft area fill. |
| `labels` + `series` | line (several series) | `labels: ["Q1", …]` + `series: [{ "label", "values": [..], "cat"?, "display"? }]` - one line per series with a legend and end labels. Each `values` array must match `labels` in length. |
| `segments` | donut: yes | `{ "label", "value", "cat"?, "display"?, "key"? }` - percentages are computed from the value sum; `display` adds the absolute value to the legend. |
| `total` / `totalLabel` | donut: no | Centre text (shrunk to fit the hole) and its caption (default: a localized "Total"). |
| `target` | bar/line: no | `{ "value", "label"?, "display"? }` - a dashed goal line with its label. |
| `yMin` / `yMax` / `zero` | bar/line: no | Force the axis range; `zero: false` lets a line chart start near its data (default: start at 0 unless the data sits far above it). |
| `yPrefix` / `ySuffix` | bar/line: no | Axis tick unit when it cannot be inferred from `display`. |
| `cat` | no | Colour `1`–`5` for a single-colour chart. |
| `filter` | bar/donut: no | `true` makes every category a toggle that dims the others (chips above a bar chart, the legend rows of a donut; `HA.crossfilter`). `key` on an item sets its filter key (default: its `label`). |

All charts emit hover tooltips (`data-chart-tip` / `data-tip`) wired by `interactions.js`.

```json
{ "type": "chart", "variant": "bar", "title": "Deployments per month",
  "series": [ { "label": "Apr", "value": 18 }, { "label": "May", "value": 24, "highlight": true } ],
  "target": { "value": 20, "label": "Goal" } }
```

```json
{ "type": "chart", "variant": "line", "title": "Revenue by region (¥M)",
  "labels": ["Q1", "Q2", "Q3", "Q4"],
  "series": [ { "label": "East", "values": [42, 48, 51, 60] }, { "label": "West", "values": [38, 37, 44, 47] } ] }
```

### `table` - sortable / filterable data table

| Field | Required | Notes |
| --- | --- | --- |
| `columns` | yes | Array of header strings. Sorting (`data-sortable`) is always wired. |
| `rows` | yes | Array of rows (arrays). Each cell is a string, or `{ "badge": "success\|warning\|danger\|info\|accent", "text": "…" }` to render a badge. |
| `paginate` | no | Page size (number) - adds `data-paginate` + a pager. |
| `select` | no | `true` adds row selection (`data-row-select`). |
| `search` | no | `false` removes the filter input (rendered by default). |
| `placeholder` | no | Filter input placeholder. |
| `density` | no | `"compact"` adds the class `dt-compact` to the `<table>` - tighter header/cell padding + 13px cells. Local to this table; independent of the page-level `density` axis (§1.4). |
| `label` | no | Section aria-label (default localized "Table"). |

```json
{ "type": "table", "columns": ["Date", "Severity", "Status"], "paginate": 5,
  "rows": [ ["2026-04-08", { "badge": "danger", "text": "SEV-1" }, "Resolved"] ] }
```

### `diagram` - auto-laid-out node/edge diagram (zoom/pan + draggable)

| Field | Required | Notes |
| --- | --- | --- |
| `nodes` | yes | `{ "id", "label", "sub"?, "group"? (1–5, series color + legend filter), "zone"? (layered), "root"? (radial) }`. |
| `edges` | no | `{ "from", "to", "label"?, "async"?, "proto"? }` - `async: true` or `proto: "pub-sub"` draws a dashed edge. `from`/`to` reference node `id`s. |
| `layout` | no | `layered` / `grid` (default) / `radial` / `vertical` - see below. |
| `zones` | layered: no | Ordered band names; defaults to first-appearance order of the node `zone` values. |
| `cols` | grid: no | Column count; defaults to `ceil(sqrt(n))`. |
| `legend` | no | `false` suppresses the group-filter legend (auto-rendered when any node has `group`). |
| `groupLabels` | no | `{ "1": "Stateless", … }` names the legend chips (default "Group n"). |
| `title` | no | Figcaption + SVG aria-label. |

Layouts (all deterministic, no overlap):

- **`layered`** - nodes binned into horizontal zone bands by `zone`; one band per zone, nodes centered per band. For architecture tiers (Edge / Services / Data).
- **`grid`** (default) - rows × cols left-to-right. For flat node sets.
- **`radial`** - the node with `root: true` (else the first node) at center, others evenly on a circle. For mindmap / hub-and-spoke.
- **`vertical`** - one centered column, top to bottom. For pipelines.

The output is a zoom/pan stage (`data-zoompan` + zoom buttons) with draggable nodes (`data-draggable`) and a reset button, all wired by the inlined `interactions.js`.

```json
{ "type": "diagram", "title": "Request path", "layout": "vertical",
  "nodes": [ { "id": "gw", "label": "Gateway" }, { "id": "api", "label": "API" } ],
  "edges": [ { "from": "gw", "to": "api", "label": "HTTP" } ] }
```

### `device` - app-frame preview (copy column + device stage)

| Field | Required | Notes |
| --- | --- | --- |
| `html` | yes (in practice) | **Raw HTML** for the device screen. |
| `title` | no | Heading in the copy column; also the appbar fallback title. |
| `appTitle` | no | Appbar title (falls back to `title`, then a localized "App"). |
| `eyebrow` / `desc` | no | Copy column kicker / paragraph. |
| `notes` | no | Array of strings rendered as a bullet card. |
| `icon` | no | Appbar app icon glyph (default `◆`). |
| `statusBar` | no | Status-bar text (default `9:41`). |
| `badge` | no | Appbar badge text. |
| `input` | no | Bottom-bar input placeholder text. |
| `cta` | no | Bottom-bar button label. |
| `label` | no | Section aria-label (default localized "App preview"). |

The frame size follows the document-level `viewport` / viewport switcher. Required for `mobile-app` targets - `validate.mjs` fails a `mobile-app` artifact without a device frame.

### `screenflow` - app screen-flow map (target-aware lo-fi screens + labeled arrows)

Renders the **whole app flow**: one target-aware lo-fi wireframe per screen, adjacent screens
connected by an arrow whose label states the transition condition, and a numbered caption under
each frame explaining the screen's role in plain language. Fully static (print/screenshot safe).
For `target: "web-app"`, the builder uses browser-window frames by default. For `mobile-app`,
it uses phone frames and the section root carries `data-device-frame`, satisfying the mobile
validator contract. Branching flows (login failure, empty states, …): add a second `screenflow`
section per branch - the arrows are strictly linear.

| Field | Required | Notes |
| --- | --- | --- |
| `screens` | yes | One entry per screen, in flow order. |
| `screens[].name` | yes | Screen name (numbered automatically in the caption). |
| `screens[].caption` | recommended | One/two human-readable sentences: what the screen does, where it branches. |
| `screens[].appbar` | no | App-bar title (defaults to `name`; `false` removes the bar). |
| `screens[].elements` | yes | Lo-fi body elements, top to bottom - see element table below. |
| `screens[].tabbar` | no | Array of tab labels renders a bottom tab bar (omit on screens outside the app shell). |
| `screens[].activeTab` | no | Index of the active tab (default `0`). |
| `flows` | no | `flows[i]` sits between screens `i` and `i+1`: `{ "label": "transition condition" }`. |
| `frame` | no | `"browser"` forces browser/window frames; `"phone"` forces mobile phone frames. Top-level `target:"web-app"` defaults to browser. |
| `device` | no | `"tablet"` widens mobile frames; `"desktop"` is an alias for `frame:"browser"`. |
| `title` / `desc` | no | Section heading + lede. |

Element types (`elements[].t`) - labels are **real UI text**, never lorem:

| `t` | Fields | Renders |
| --- | --- | --- |
| `heading` | `label` | Bold screen heading text. |
| `text` | `label` or `lines` | Real caption text, or `lines` (default 2) gray placeholder bars. |
| `image` | `label`? | X-crossed image box (+ corner label). |
| `input` | `label` | Form field with placeholder text. |
| `button` | `label`, `variant`? | Button; `variant: "primary"` renders it filled (CTA). |
| `search` | `label`? | Search pill with icon. |
| `list` | `items` | Avatar + label rows (one per item). |
| `chips` | `items` | Chip/tag row. |
| `card` | `label`?, `lines`? | Bordered panel with title + placeholder bars. |
| `divider` | - | Dashed separator. |

```json
{ "type": "screenflow", "title": "메인 플로우",
  "screens": [
    { "name": "로그인", "caption": "이메일 또는 소셜 계정으로 시작합니다.",
      "elements": [ { "t": "input", "label": "이메일" }, { "t": "button", "label": "로그인", "variant": "primary" } ] },
    { "name": "홈", "caption": "저장된 여행이 카드로 표시됩니다.", "tabbar": ["홈", "검색", "마이"],
      "elements": [ { "t": "card", "label": "도쿄 3박 4일", "lines": 2 } ] }
  ],
  "flows": [ { "label": "로그인 성공" } ] }
```

A complete working sample: `examples/specs/example-app-flow.spec.json`.

### `stepper` - numbered flow steps with branch chips

| Field | Required | Notes |
| --- | --- | --- |
| `steps` | yes | `{ "n", "title", "desc", "event"?, "fn"? (rendered as <code>), "level"?, "branches"? }`. |
| `steps[].level` | no | `critical` / `block` / `soft` / `info` (default) / `neutral` - badge color. |
| `steps[].branches` | no | `{ "label", "desc", "kind"? }` - `kind`: `go` (default) / `stop` / `warn`. |
| `title` / `desc` | no | Section heading + lede. |

### `timeline` - vertical timeline

| Field | Required | Notes |
| --- | --- | --- |
| `events` | yes | `{ "date", "title", "body", "status"? }`. |
| `events[].status` | no | `done` / `active` / `todo` (default) - marker style. |
| `label` | no | aria-label (default `Timeline`). |

### `comparison` - side-by-side option cards

| Field | Required | Notes |
| --- | --- | --- |
| `options` | yes | `{ "name", "recommended"?, "pros"?, "cons"?, "metrics"?, "cta"? }`. |
| `options[].recommended` | no | `true` adds the accent card style + localized "Recommended" badge. |
| `options[].pros` / `cons` | no | Arrays of strings. |
| `options[].metrics` | no | Array of `{ "k", "v" }` definition pairs. |
| `label` | no | aria-label (default localized "Comparison"). |

Columns auto-fit the option count: the builder emits `<div class="grid cmp-grid" style="--cmp-cols:N">` with `N = min(options.length, 4)` (no hardcoded `grid-3`), collapsing to one column below 900px.

### `decision` - weighted decision matrix (totals & winner computed)

For "help me decide" content: criteria × options with explicit weights, a score **bar + number +
one-line rationale per cell**, a weighted-total footer, and a closing verdict callout that states
the recommendation and why. The builder computes the weighted totals and the winner from the data
- the spec never hand-computes a sum.

| Field | Required | Notes |
| --- | --- | --- |
| `options` | yes | Option names, in column order (2–5). |
| `criteria` | yes | One row per criterion. |
| `criteria[].name` | yes | Criterion label. |
| `criteria[].weight` | no | Multiplier shown as `×N` (default `1`). |
| `criteria[].scores` | yes | One score per option, same order as `options` (0–`scale`). |
| `criteria[].notes` | recommended | One short human-readable rationale per option cell. |
| `scale` | no | Score ceiling (default `5`); drives the bar widths. |
| `variant` | no | `"detailed"` (default - current rendering with visible `dm-note` rationale paragraphs) / `"compact"` (omits the `<p class="dm-note">` paragraphs; each note moves into a `title="…"` attribute on its `<td class="dm-cell …">`). |
| `verdict.pick` | no | Forces the recommended option (must match an `options` entry); default = highest weighted total. **Use `rationale` to justify any override.** |
| `verdict.rationale` | recommended | Plain-language WHY for the verdict callout (falls back to a localized "highest weighted total" sentence). |
| `title` / `desc` | no | Section heading + lede. |

```json
{ "type": "decision", "title": "평가 매트릭스",
  "options": ["Riverpod", "Bloc"],
  "criteria": [
    { "name": "타입 안전성", "weight": 3, "scores": [5, 4],
      "notes": ["컴파일 타임 검증", "이벤트/상태 클래스로 안전"] } ],
  "verdict": { "pick": "Riverpod", "rationale": "가중 합계 1위. 테스트 용이성에서 만점." } }
```

A complete working sample: `examples/specs/example-decision.spec.json`.

### `tabs` - tab panel

| Field | Required | Notes |
| --- | --- | --- |
| `tabs` | yes | `{ "label", "body", "id"? }` - `body` is **raw HTML**; `id` defaults to `t1`, `t2`, …; the first tab starts active. If `body` contains buttons or links, wire them or render them as non-interactive chips. |
| `label` | no | aria-label (default `Tabs`). |

### `collapsible` - native `<details>` list / FAQ

| Field | Required | Notes |
| --- | --- | --- |
| `items` | yes | `{ "summary", "body", "open"? }` - `body` is **raw HTML**; `open: true` starts expanded. |
| `label` | no | aria-label (default localized "FAQ"). |

### `callout` - highlighted box with glyph

| Field | Required | Notes |
| --- | --- | --- |
| `variant` | no | `tldr` / `note` (default) / `warning` / `success`. An unknown variant keeps its class but falls back to the note glyph. |
| `title` | one of the two | Callout heading. |
| `body` | one of the two | Callout text - Markdown subset (see `prose`): paragraphs, lists, **bold**, links. |

```json
{ "type": "callout", "variant": "warning", "title": "Action required",
  "body": "Error budget on track to exhaust by mid-July." }
```

### `prose` - body text (Markdown subset)

For the narrative parts of a document - background, analysis, recommendations, method - instead
of hand-written `<p>` soup in an `html` section.

| Field | Required | Notes |
| --- | --- | --- |
| `md` | yes | Markdown as a string or an array of lines. Supported: `##`/`###` headings (rendered as h3/h4 - the section `title` is the h2), paragraphs (a single newline is a line break), `-` / `1.` lists, `>` quotes, fenced code blocks, `| tables |` (horizontally scrollable), `---`, and inline `**bold**`, `*em*`, `` `code` ``, `[text](https://… | #anchor | mailto:…)`. Everything else is escaped text. |
| `title` | no | Section heading. |
| `card` | no | `true` puts the text in an outlined card. |
| `wide` | no | `true` lifts the ~70-character measure (for tables or code). |

```json
{ "type": "prose", "title": "背景", "md": [
  "移行の主な理由は **運用コスト** と *可用性* です。",
  "",
  "- 年間保守費が 40% 増加",
  "- 2025 年に 3 回の長時間停止（[障害一覧](#incidents)）"
] }
```

### `html` - raw passthrough (and hand-pasted modules)

| Field | Required | Notes |
| --- | --- | --- |
| `html` | yes | **Raw HTML** injected verbatim. Escape hatch for anything the typed sections don't cover - mostly the hand-pasted v3–v6 modules; you own the markup contract (use semantic tokens + primitives per `06-usage-guide.md`). Visible controls must be functional, not illustrative no-ops. |
| `cssModules` / `module` | no | Module ids whose CSS the markup needs (`["okr-board"]`). |

**Module CSS always comes from the canonical module file**, never from the spec. Declare it with
`cssModules`, or write the module id as the type (`{ "type": "okr-board", "html": "…" }` is an
`html` section that pulls in `okr-board` CSS). The module's root class in the markup
(`class="okr …"`) also pulls its CSS in. Do **not** paste `<style data-module>` blocks into the
spec: if you do, the builder lifts them out, uses the canonical CSS instead and prints a note
(stale or header-corrupted copies used to ship broken grids).

---

## 3a. v2 section types (17 added)

All accept the same layout keys (`span` / `area` / `emphasis`) and `title` / optional `desc`
as §2–3. Colors are token-only; SVG carries `role`/`aria`; geometry is computed deterministically.
Discover the right one via `index/COMPONENTS.md`; full contracts in `04-module-catalog.md`.

### charts family

| type | key fields | notes |
| --- | --- | --- |
| `stattrend` | `items[].{label,value,valueNum?,delta?,dir?,suffix?,series[],trend?}`, `columns?` (1–4) | KPI card + inline sparkline. `series` = recent numbers; `trend:"up"/"down"` tints the sparkline (success/danger). `valueNum` drives count-up. |
| `barstacked` | `categories[]`, `series[].{label,cat?,values[]}`, `mode?`, `size?` | `mode`: `stacked` (default) / `grouped` / `percent` (100%). `cat` 1–5 picks the series color. `size` sm/md/lg. |
| `areastacked` | `xLabels[]`, `series[].{label,cat?,values[]}`, `mode?`, `size?` | `mode`: `stacked` (default) / `single` (overlapping) / `percent`. Filled-area time series. |
| `gauge` | `items[].{label,value,max?,display?,tone?}` | Grid of radial rings. `max` default 100; `display` overrides center text; `tone` success/warning/danger/info. |
| `radar` | `axes[]`, `series[].{label,cat?,values[]}`, `max?` | Spider chart; one polygon per series. `max` default = data max. |
| `funnel` | `stages[].{label,value,display?}` | Bars taper by value/first; conversion % computed vs the top stage. |
| `progress` | `items[].{label,value,max?,display?,suffix?,tone?}` | Linear meter bars. `tone` success/warning/danger/info recolors the fill. |
| `bullet` | `rows[].{label,value,target,max?,bands?,valueText?}` | Goal-vs-actual. `bands:[a,b]` shades poor/ok/good zones; a tick marks `target`. |
| `heatmap` | `xLabels[]`, `yLabels[]`, `rows[][]`, `min?`, `max?` | Labeled value matrix; cell intensity = `color-mix(--accent …)` normalized over [min,max]. |
| `calendar` | `weeks[][]{value,bucket?,date?}`, `legend?` | GitHub-style calendar; 7 cells/week (top=Sun). `bucket` 0–4 sets intensity (else derived from value/max). `legend:false` hides Less→More. |

### document / content family

| type | key fields | notes |
| --- | --- | --- |
| `tree` | `nodes[].{label,meta?,badge?,badgeTone?,children[]}` (recursive) | Collapsible hierarchy (reuses `HA.tree`). Branches collapse on click/Enter/Space. |
| `statlist` | `items[].{k,v,note?,badge?}`, `columns?` (1–3) | Key→value spec sheet. `badge` (success/warning/danger/info/accent) renders the value as a status badge. |
| `feed` | `items[].{icon?,actor?,text,time,tone?}` | Activity stream with connector line. `icon` from the built-in set (commit/comment/merge/alert/add/edit…); `tone` colors the marker. |
| `empty` | `{icon?,title,body?,action?:{label},tone?}` | Centered zero-state. `tone` neutral/success/danger. |
| `features` | `items[].{icon?,title,body,tag?}`, `columns?` (1–4) | Icon feature cards. `icon` from the built-in line-icon set (bolt/shield/chart/lock/gear/globe/check/rocket/layers/clock/users/code/star…). |

```json
{ "type": "stattrend", "items": [
  { "label": "MRR", "value": "$48.2k", "valueNum": 48200, "delta": "8%", "dir": "up", "trend": "up", "series": [30,35,40,44,48] } ] }
{ "type": "barstacked", "mode": "stacked", "categories": ["Q1","Q2"],
  "series": [ { "label": "Ent", "cat": 1, "values": [20,24] }, { "label": "SMB", "cat": 2, "values": [12,14] } ] }
{ "type": "statlist", "items": [ { "k": "Status", "v": "Live", "badge": "success" }, { "k": "Owner", "v": "platform-team" } ] }
{ "type": "bullet", "rows": [ { "label": "Revenue", "value": 88, "target": 100, "max": 120, "bands": [60,100], "valueText": "$88k" } ] }
```

### form-control family

Real, themed `<input>`/`<select>`/`<textarea>`/checkbox/radio/switch - styled by the
`elements.css` form-control primitives, so they take the active theme's accent, radius, and
dark/light surface (no bare OS widgets). The unchecked checkbox/radio edge uses `--text-muted`
for a ≥3:1 boundary on every theme. Every control gets an explicit `<label for>`.

| type | key fields | notes |
| --- | --- | --- |
| `checklist` | `items[].{label,desc?,checked?,disabled?,state?}`, `control?`, `name?`, `variant?`, `count?` | Themed checkbox/radio/switch list. `control`: `checkbox` (default) / `radio` (grouped by `name`) / `switch`. `state` done\|pending\|blocked\|todo drives a status badge (and `done` pre-checks). `variant` boxed (default) / plain. `count:false` hides the header `n/total`. Controls toggle natively (no JS). |
| `form` | `fields[].{label,name?,kind?,placeholder?,options?,help?,required?,optional?,checked?,full?}`, `columns?` (1–2), `submit?`, `title?`, `desc?` | Themed prototype form. `kind`: text/email/password/number/tel/url/date/select/textarea/checkbox (default text). `options[]` for select; `help` adds a hint (+`aria-describedby`); `required` adds `*`+`aria-required`; `full` spans both columns (textarea/checkbox span automatically). `submit:{label}` or `submit:false`. The submit is wired by `HA.formMock` (`[data-form-mock]`) - it confirms in place and never navigates, so it is **not a dead control**. |

```json
{ "type": "checklist", "title": "Launch readiness", "control": "checkbox", "items": [
  { "label": "DNS cutover verified", "state": "done" },
  { "label": "Load test at 2x peak", "state": "pending" } ] }
{ "type": "checklist", "title": "Feature flags", "control": "switch", "variant": "plain", "items": [
  { "label": "New onboarding", "checked": true }, { "label": "Beta dashboard" } ] }
{ "type": "form", "title": "Request access", "columns": 2, "fields": [
  { "label": "Full name", "kind": "text", "required": true },
  { "label": "Email", "kind": "email", "required": true },
  { "label": "Team", "kind": "select", "options": ["Platform","Growth","Data"] },
  { "label": "Notes", "kind": "textarea", "help": "Optional context." },
  { "label": "I agree to the policy", "kind": "checkbox", "required": true } ],
  "submit": { "label": "Send request" } }
```

---

## 4. Spec check - mistakes fail loudly (`tools/lib/spec-check.mjs`)

`build.mjs` runs the spec check first and writes **nothing** when it reports an error:

| Errors (build stops) | Warnings (build continues - read them) |
| --- | --- |
| invalid JSON (with line / column) | unknown top-level key |
| unknown section `type` (with "did you mean") | a key the section's renderer never reads |
| enum typo: `theme` / `layout` / `header` / `density` / `target` / `viewport` / `nav` | table row with the wrong number of cells |
| missing required data (`kpi.items`, `chart.series` / `points` / `segments`, `table.columns`+`rows`, `prose.md`, …) | radar / stacked / heatmap series that don't match their axes |
| non-numeric chart value; line series length ≠ `labels` | lower-is-better KPI (latency, churn, cost…) with no `tone` |
| decision scores count ≠ options; `verdict.pick` not an option | |
| diagram / arch-explorer edge to an unknown node id | |
| duplicate or malformed section `id` | |
| requirement not covered (§1.6); `covers` id with no requirement | |
| blueprint sample data left in the spec (another blueprint's title, company, footer or `_recipe.sampleMarkers`) - set `"_allowSample": true` only for a deliberate demo | |

A module id used as the type with `html` (`"type": "okr-board"`) is accepted as an `html`
section plus that module's CSS (§3 `html`). `layout: "sidebar"` with no `area: "side"` section
downgrades to `stack` with a logged note (§1.2).

---

## 5. What `validate.mjs` checks

`node tools/validate.mjs <file.html>` prints `PASS` (or `PASS (N warnings)` when warnings exist) / `FAIL` plus issues, and exits `0` / `1` (`2` on usage error). Hard failures:

1. **No external dependencies** - no `http(s)://` in `src`, nor in `href` on anything but an outbound `<a>` link; no external `url(…)`, no external `<script>` / `<link>`.
2. **No leftover `{{ }}` placeholders.**
3. **Document structure** - `<!DOCTYPE html>`, `<title>`, `charset`, viewport meta, `<html lang>` all present.
4. **Target surface contract** - `mobile-app` must default to `data-viewport="phone"` and contain a device/app frame (`.ha-device`, `data-device-frame`, or `.device-frame`); `tablet-app` must default to `data-viewport="tablet"`.
5. **No AI-slop / layout regressions** - no protruding accent-bar rects (`ng-bar` / `node-bar` not hidden), no `feTurbulence` SVG noise grain, no `writing-mode: vertical-rl` combined with `rotate(180deg)` (flips CJK characters upside-down), no thick `border-left: [3-9]px solid` rails on callout/card/takeaway/quote elements, and no raw hex colors inside `<style data-module="...">` blocks (Rule S2).
6. **Interaction & SVG text-fit wiring** - `data-draggable` requires `HA.dragNode` inlined; `data-zoompan` requires `data-viewport`; documents with SVG diagram node classes (`.dg-box`, `.node-box`, `.arch-box`, `.mm-box`, `.sw-box`, `.sd-state`, `.dt-box`, `.oc-box`, `.kt-box`, `.fb-cat`, `.node-card`) require `HA.fitSvgText` inlined.

Warnings (do not fail the gate - exit code stays `0`):

- missing `data-target` / `data-viewport` on `<html>`;
- `<svg>` elements without `role` / `aria-label` / `aria-hidden`;
- **low contrast** - a key token pair of the active theme (or an inline `--accent` override) below WCAG AA for its context (normal text 4.5:1 · large/UI 3:1). Advisory only; audit every theme with `node tools/contrast-audit.mjs` (see `reference/03-themes-and-palettes.md` §2);
- missing `data-layout` or `data-density` on `<html>`;
- **`default-sandwich`** - `data-theme="birchline"` AND `data-layout="stack"` AND no `header-compact` / `header-banner` / `header-split` / `page-controls` class anywhere in the file AND more than 3 `<!-- section` markers. Message: "default look - confirm this is intentional". It flags an artifact that fell back to the all-defaults silhouette; pick the axes deliberately (§1.1) or accept the look consciously.
- **dead controls** - `href="#"` anchors and buttons with no visible wiring (`data-*`, `onclick`, form submit/reset, or `aria-controls`) are flagged. For real prototypes, click-test the intended controls with Playwright after `validate.mjs`.

When warnings exist the result line reads `PASS (N warnings)` (still exit `0`).

## 5a. What `render-check.mjs` checks (the browser gate)

`validate.mjs` reads text; overflow, unreadable labels and orphaned grid rows only exist after
layout. `node tools/render-check.mjs <out.html> [--widths=1280,390] [--shots=<dir>]` opens the
page in a locally installed Chromium-based browser (headless, driven over CDP; Node 22+, no npm
packages; override the binary with `HTML_ARTIFACTS_BROWSER`), runs `tools/lib/render-audit.js` at each width,
saves full-page screenshots and collects console errors. Exit `0` PASS / `1` FAIL / `3` SKIPPED
(no browser found - then review the page by eye and say so when delivering).

| FAIL | WARN |
| --- | --- |
| page scrolls sideways (names the widest offender) | text rendered below 10px (SVG text measured after scaling; zoomable diagrams exempt) |
| `href="#x"` with no element `id="x"` | SVG labels overlapping each other / cut off by their `<svg>` |
| broken image | text spilling out of its box |
| console error | a ≥ 3-column card grid whose last row holds one item |
| | a top-level section that renders nothing |

**Then open the screenshots and look.** The audit finds measurable defects; whether the page
answers the user's question at a glance - order, emphasis, labelling - is a judgement only a
look gives.

---

## 6. Worked sample

`examples/example-spec.json` exercises the main section types (kpi + bar chart + donut chart + table + layered diagram + callout) on the `slate` theme:

```
out=$(mktemp -d)
node tools/build.mjs examples/example-spec.json $out/out.html
node tools/validate.mjs $out/out.html                       # → PASS
node tools/render-check.mjs $out/out.html --shots=$out      # → PASS + screenshots
```
