# 05 - Components & Interactions (the `interactions.js` behavior reference)

> **Canonical contract**: this document is the **single source of truth for the data-attribute contracts of all 24 behaviors** in `templates/core/interactions.js` (`themeToggle / sortable / filter / kanban / copy / switcher / slider / tabs / zoompan / dragNode / tree / crossfilter / paginate / tooltip / counter / reveal / reorder / wfedit / wfflow / designpick / formMock / archExplorer / fitSvgText / tocSpy`). Other documents (`SKILL.md`, `reference/01`, `reference/04`) only point here - when a contract here and a summary elsewhere disagree, this document (verified against `interactions.js`) wins.

This document explains the behavior library of `templates/core/interactions.js`, which is **Layer 3 / Behaviors** of the 5-layer architecture.

```
Foundation (reset / tokens / themes)
  -> Primitives (elements.css)
    -> Modules (modules/*)
      -> Behaviors (interactions.js)   ← this document
        -> Shapes (base.template + compositions)
```

`interactions.js` is a **single, zero-dependency library** that integrates and de-duplicates the multiple per-component scripts that were scattered across the 5 source skills into a single file. Each behavior fires from a **data-attribute markup contract**. Just by adding the attribute to the HTML, the JS side automatically attaches the behavior (no individual initialization code is needed).

---

## 1. Loading Method and Startup Sequence

| Item | Content |
| --- | --- |
| Global | All functions are stored in the `window.HA` namespace (`window.HA = window.HA \|\| {}`) |
| Startup | If `document.readyState !== "loading"`, call `HA.init()` immediately; otherwise call `HA.init()` on `DOMContentLoaded` |
| Init targets | `HA.init(root)` runs `themeToggle / sortable / filter / kanban / copy / switcher / slider / tabs / zoompan / fitSvgText / dragNode / tree / crossfilter / paginate / tooltip / counter / reveal / reorder / wfedit / wfflow / designpick / formMock / archExplorer / tocSpy` in order (`wfedit` is after `reorder` = after each board has `c._wireItem`; `wfflow` is after `wfedit` = `HA.wfedit.factory` exists when pages are seeded; `fitSvgText` also re-runs on `document.fonts.ready`, tab switches, and `<details>` toggle) |
| Default root | Calling `HA.init()` with no argument targets the entire `document` |
| Fault isolation | Each behavior is wrapped in its own `try/catch`, so one failing does not stop the others |
| Re-initialization | If you inject DOM later, you can manually call `HA.init(inserted element)` to partially re-wire |

> **Inline position**: Per the convention of `base.template.html`, inline `interactions.js` **last** (just before `</body>`) inside a `<script>`. See the position of the `{{INTERACTIONS_JS}}` placeholder.

Caveat: The internal lookups of `filter` and `kanban` partly use `document.querySelectorAll` directly, so design selectors to be **unique across the whole document** (described below).

---

## 2. Behavior List (quick reference)

| Behavior | Trigger attribute | Related class / child element | JS needed | Keyboard support |
| --- | --- | --- | --- | --- |
| Theme toggle | `[data-theme-toggle]` | - | Yes | Click only (Enter/Space via button) |
| Sortable table | `table[data-sortable]` | `<th>` in `<thead>` | Yes | (described below / needs enhancement) |
| Live filter | `[data-filter]` + `[data-filter-in="selector"]` | toggles `.hidden` on targets inside the input's own `[data-filter-scope]` / `.data-table` (else the document) | Yes | `input` event |
| Kanban DnD | `[data-kanban]` | `[data-col]` > `.kanban-cards` > `.kanban-card` (`.dragging` / `.drop-target`) | Yes | (described below / pointer only) |
| Page-wide switcher | `[data-switch-group]` + `[data-switch]` | `[data-switch-for]` + `[data-switch-case]`, optional `data-switch-only` | Yes | via native button |
| Copy | `[data-copy]` / `[data-copy-text]` | - | Yes | via button |
| Slider | `[data-slider="--var"]` | `[data-out]` / `data-unit` | Yes | range standard key operation |
| Tabs | `[data-tabs]` | `.tab(.active)[data-tab]` / `[data-panel]` | Yes | via button |
| Collapsible | `[data-collapsible]` (optional) | native `<details>`/`<summary>` | **No** | native support |
| Zoom + pan | `[data-zoompan]` (stage wrapping `svg > g[data-viewport]`) | `[data-zoom-in]` / `[data-zoom-out]` / `[data-zoom-reset]` / `[data-zoom-readout]`, opts `data-zoom-min` / `data-zoom-max` (`.panning`) | Yes | `+` `-` `0` on the focused stage (give the stage `tabindex="0"`) |
| Drag nodes | `svg[data-draggable]` + `g[data-node="id"]` | edges `[data-edge][data-from][data-to]` / labels `[data-edge-label="FROM-TO"]` / `[data-drag-reset]` (`.dragging`) | Yes | **Full support** (JS adds `tabindex="0"`; arrows move 8px, Shift = 24px) |
| Tree collapse | `[data-tree]` + `[data-tree-toggle]` | `[data-tree-node]` > `[data-children]` (`.collapsed` / `.is-collapsed`, `.tw-caret`) | Yes | Enter/Space (JS adds `role="button"` + `tabindex="0"` + `aria-expanded`) |
| Cross-filter | `[data-crossfilter]` + `[data-filter-key="k"]` | dims `[data-series="k"]` (`.dimmed` / `.active`, `aria-pressed`) | Yes | Enter/Space (JS adds `role="button"` + `tabindex="0"`) |
| Pagination | `table[data-paginate]` + `data-page-size` | `[data-pager]` next to the table or its `.dt-scroll` wrapper / optional `data-row-select` (`.page-hidden` / `.selected`) | Yes | via generated `<button>` pager |
| Chart tooltip | `[data-chart-tip]` + `[data-tip="text"]` | injected `.ha-tooltip` | Yes | None (pointer hover only - keep `role="img"` + `<title>` for a11y) |
| Count-up | `[data-counter]` | `data-to` / `data-dur` / `data-prefix` / `data-suffix` | Yes | N/A (display only; reduced-motion shows the final value at once) |
| Scroll reveal | `[data-reveal]` | `data-reveal-delay` (`.in`) | Yes | N/A (display only; reduced-motion / no IntersectionObserver shows immediately) |
| **Reorder** | `[data-reorder][data-reorder-scope][data-reorder-mode]` | `[data-reorder-item][data-rid]` / `[data-reorder-handle]` / `[data-reorder-reset]` / `[data-reorder-export]` (`.is-grabbed` / `.wf-placeholder` / `.is-swap-target` / `.just-dropped`) | Yes | **Full support** (Tab→Space to grab / arrows to move / Space to confirm / Esc to cancel) |
| **Element editor** | `[data-wf-palette]` + `[data-wf-board]` | `[data-wf-add=type]`(16 types, click & drag placement) / `[data-wf-el][data-el-type]` / `.wf-el-del`(✕) / `[data-wf-editable]` / `[data-wf-target-readout]` (`.wf-active` / `.wf-drop-hot` / `.wf-drag-ghost`) | Yes | **Full support** (click to add / drag to place / Delete to delete / move inherited from reorder) |
| **Screen flow** | `[data-wf-flow]` + `[data-wf-flow-track]` | `[data-wf-page][data-rid]` / `[data-wf-add-page]` / `[data-wf-page-template]` / `[data-wf-del-page]` / `svg.wf-arrows`(`.wf-arrow`/`#wf-ah`) | Yes | **Full support** (page reorder inherited from reorder / arrows are decorative `aria-hidden` / add/delete announced) |
| **Design picker** | `[data-theme-pick]` / `[data-wf-skin-pick]` | `<select>`(sets `data-wf-skin` / `data-wf-flat` on `[data-wf-flow]`) | - | native `<select>` (with `aria-label`). Switches theme + skin at runtime |
| Contents scroll-spy | `[data-toc-spy]` (a `nav` / `details` of `a[href="#id"]`) | sets `aria-current="true"` on the link of the section being read | Yes | N/A (links stay normal anchors) |
| Form mock | `[data-form-mock]` | `<form>` + `button[type=submit]` + optional `.form-status` | Yes | native form submit (Enter / button) - intercepts, confirms in place, never navigates |
| **Arch explorer** | `[data-arch-explorer]` | `[data-arch-node]` / `[data-arch-filter]` / `[data-arch-drawer]` / `[data-arch-close]` (`.is-selected` / `.is-dimmed` / `.is-highlighted`) | Yes | Enter/Space on `[data-arch-node]` and filter buttons |
| **SVG text fit** | automatic on `svg g` | measures `<text>` `getComputedTextLength()` against enclosing `<rect>`/`<ellipse>`/`<polygon>`/`<circle>` bounds and clamps overflowing labels (`textLength` + `lengthAdjust="spacingAndGlyphs"`) | Yes | N/A (layout safety net; re-runs on `document.fonts.ready`, tab switch, and `<details>` open) |

> Every behavior is detailed in §3: the basics in §3.1–§3.8, the wireframe editor family in §3.9–§3.12 (`reorder` / `wfedit` / `wfflow` / `designpick`), the visual/interactive family in §3.13–§3.17 (`zoompan` §3.13, `dragNode` §3.14, `crossfilter` §3.15, `reveal` §3.16, and `tree` / `paginate` / `tooltip` / `counter` together in §3.17), and the form-control / diagram helpers in §3.18 (`formMock`, `archExplorer`, `fitSvgText`).

---

## 3. Details of Each Behavior

### 3.1 Theme toggle - `HA.themeToggle`

Clicking toggles `<html data-theme>` to `dark-focus`. The original theme is saved to `html.dataset.prevTheme` and restored on a second click (falling back to `birchline` if unset).

**Markup contract**

```html
<button class="btn-ghost btn-sm no-print" data-theme-toggle aria-label="Toggle dark mode">◐ Theme</button>
```

| Behavior | Detail |
| --- | --- |
| Target | A click on any element with `[data-theme-toggle]` |
| ON | Save the current theme to `prevTheme` → `data-theme="dark-focus"` |
| OFF | Return `data-theme` to `prevTheme` (or `birchline` if absent) |
| Theme definition source | `[data-theme="…"]` in `themes.css` - 10 themes, `birchline` is the default and `dark-focus` is the toggle target (full palette details in `reference/03`) |

**Accessibility**
- Always apply it to a `<button>` (to get native focus / Enter·Space activation).
- Add an `aria-label` (the glyph `◐` alone cannot be read aloud).
- It is conventional to also use `no-print` so it disappears when printing (as is the default in `base.template.html`).
- The focus ring is guaranteed by `reset.css`.

---

### 3.2 Sortable table - `HA.sortable`

Makes each `<th>` of the first row of `table[data-sortable]`'s `<thead>` clickable, sorting the `<tbody>` rows ascending/descending by column content.

| Behavior | Detail |
| --- | --- |
| Click target | `table.tHead.rows[0].cells` (= the cells of the header's first row) |
| Numeric detection | Strip `[^0-9.\-]` from the cell string and `parseFloat`. If both cells are numeric, compare numerically; otherwise `localeCompare` |
| Direction toggle | Each click alternates `th.dataset.sort` between `asc`/`desc`. The `data-sort` of other `<th>`s is removed |
| Reorder | Re-place the sorted rows with `tbody.appendChild` |
| Attributes added | `role="button"`, `style.cursor="pointer"`, `data-sort` on `th` |

**Markup contract** (conforming to the `data-table` module)

```html
<table data-sortable>
  <thead><tr><th>Name</th><th>Role</th><th>Status</th></tr></thead>
  <tbody>
    <tr class="dt-row"><td>…</td><td>…</td><td>…</td></tr>
  </tbody>
</table>
```

The sort-direction caret is drawn by the `data-table` module's CSS:

```css
.data-table th[data-sort="asc"]::after  { content: " \25B2"; color: var(--accent); }
.data-table th[data-sort="desc"]::after { content: " \25BC"; color: var(--accent); }
```

**Accessibility**
- The JS adds `role="button"`, but the `<th>` itself is not focusable. If you require full keyboard operation, there is room to additionally add
  `tabindex="0"` and Enter/Space on `keydown` (currently it assumes pointer use).
- Always use `<thead>` for the header (because `table.tHead` is referenced; without `<thead>` sorting is impossible).
- To convey the sort state to assistive technology, also using `aria-sort` is desirable (currently only the visual caret).

---

### 3.3 Live filter - `HA.filter`

As the user types into an input, it shows/hides elements matching the selector specified by `data-filter-in` in real time by text match.

| Behavior | Detail |
| --- | --- |
| Event | `input` (incremental) |
| Query | `input.value.toLowerCase()` |
| Match test | If the target element's `textContent.toLowerCase().indexOf(q) === -1`, add `.hidden` |
| Empty query | If `q` is empty, re-show all elements (remove `.hidden`) |
| Target resolution | inside the input's closest `[data-filter-scope]` or `.data-table` when the selector matches there; otherwise the whole document |

**Markup contract**

```html
<input type="search" data-filter data-filter-in=".dt-row"
       placeholder="Search…" aria-label="Search">
<!-- The set of elements matching the data-filter-in selector is the filter target -->
```

**Accessibility**
- Use `<input type="search">` and always add an `aria-label` (or a corresponding `<label>`).
- `.hidden` is a utility from `reset.css`. Visibility control is done solely by toggling this class.

**Scope**
- Two `data-table` blocks on one page both use `.dt-row`; each search box only filters its own table
  (the closest `.data-table`). For a search box outside its table, wrap both in an element with
  `data-filter-scope`, or give the rows a unique class like `.dt-row--users`.

---

### 3.4 Kanban drag & drop - `HA.kanban`

Moves `.kanban-card` between `[data-col]`s with native HTML5 Drag and Drop. No external library.

| Behavior | Detail |
| --- | --- |
| Make draggable | Add `draggable="true"` to each `.kanban-card` |
| `dragstart` | Remember the target and add `.dragging` on the next frame (`setTimeout 0` to avoid the ghost afterimage) |
| `dragend` | Remove `.dragging` |
| `dragover` | `preventDefault()` to allow drop, add `.drop-target` to the column |
| `dragleave` | Remove the column's `.drop-target` |
| `drop` | Remove `.drop-target` and `appendChild` the card to `col.querySelector(".kanban-cards")` (or the column itself if absent) |

**Markup contract** (conforming to the `kanban-board` module)

```html
<div class="kanban" data-kanban>
  <div class="kanban-col" data-col="To Do">
    <header class="kanban-col-head">…<span class="badge">3</span></header>
    <div class="kanban-cards">
      <article class="kanban-card card-outlined" tabindex="0"
               aria-roledescription="Draggable card">…</article>
    </div>
  </div>
  <!-- Repeat the column -->
</div>
```

State classes (appearance applied by the module CSS):
- `.kanban-card.dragging { opacity: .5; }`
- `.kanban-col.drop-target { outline: 2px dashed var(--accent); }`

**Accessibility**
- Give cards `tabindex="0"` and `aria-roledescription="Draggable card"` to indicate their existence to assistive technology.
- Drag-and-drop itself assumes pointer operation (keyboard card movement is not implemented). For important flows,
  also provide an alternative (e.g. a status-change button).
- The column header count `.badge` is updated manually (it does not auto-link with DnD).

---

### 3.5 Copy to clipboard - `HA.copy`

On click, copies text to the clipboard. Feedback follows the page's JA/KO/EN language and restores the original label after 1.6 seconds. A rejected or unavailable Clipboard API falls back to the browser's copy command; failure is reported without showing a success state.

| Attribute | Copy target |
| --- | --- |
| `data-copy-text="literal"` | The string itself (highest priority) |
| `data-copy="#selector"` | The target element's `value` (input, etc.) or `textContent` |
| `data-copy-done="…"` / `data-copy-failed="…"` | Optional localized success / failure feedback overrides |

| Behavior | Detail |
| --- | --- |
| API | `navigator.clipboard.writeText(text)`; `document.execCommand("copy")` fallback, including `file://` |
| Feedback | Show localized success only after confirmed copy; otherwise localized failure. Restore after 1600ms |
| Target resolution | `data-copy` is one element via `document.querySelector` |
| Empty / missing target | An explicit empty `data-copy-text` copies an empty string; missing or invalid selectors report failure |

**Markup contract**

```html
<!-- Copy a literal (example from the slider-control module) -->
<button class="btn btn-ghost btn-sm"
        data-copy-text=".preview { border-radius: var(--demo-x); }">Copy as CSS</button>

<!-- Copy the content of another element -->
<button class="btn btn-sm" data-copy="#snippet">Copy</button>
<pre id="snippet"><code>…</code></pre>
```

### 3.5b Page-wide switcher - `HA.switcher`

Native buttons inside `[data-switch-group="G"]` carry `data-switch="value"`. A click synchronizes all bars with that group and sets `aria-pressed`. Matching `[data-switch-for="G"]` content is shown when `data-switch-case` contains the selected value (space- or comma-separated); the other cases receive `.hidden`.

`value="all"` shows every case except content marked `data-switch-only`. A case containing `all` stays visible for every selection. Initial visibility follows the authored markup; mark the intended initial buttons with `aria-pressed="true"`. Use unique group names and real `<button type="button">` controls for native keyboard operation.

**Accessibility**
- Use a `<button>`. Since the label changes temporarily, also using `aria-live="polite"` lets the change be read aloud.
- `navigator.clipboard` requires a **secure context (https / localhost / depends on the file: environment)**.
  In unsupported environments `.then()` does not run and the label does not change, so for important operations consider also presenting an alternative.

---

### 3.6 Slider (CSS variable live binding) - `HA.slider`

Reflects an `input[type=range]` value into a `:root` CSS variable in real time, and also displays the value on a readout element.
For prototype tuner purposes.

| Attribute | Role |
| --- | --- |
| `data-slider="--var"` | The CSS variable name to write to (`document.documentElement.style.setProperty`) |
| `data-out="#selector"` | The element that displays the value (optional. writes to `textContent`) |
| `data-unit="px"` | The unit appended to the value (optional. attached to both the variable value and the display) |

| Behavior | Detail |
| --- | --- |
| Event | `input` (continuous). Also runs `sync()` once at initialization |
| Write target | The specified variable on `:root` (`documentElement`) → all `var(--var)` references on the page update |
| Unit | `input.dataset.unit` (= `data-unit`) is concatenated to the value |

**Markup contract** (conforming to the `slider-control` module)

```html
<input type="range" id="slider-x" min="0" max="48" value="12" step="1"
       data-slider="--demo-x" data-out="#xval" data-unit="px" aria-label="Border radius">
<output class="slider-out" id="xval" for="slider-x">12px</output>

<!-- A preview that reads the bound variable -->
<div class="preview-box" style="border-radius: var(--demo-x, 12px);"></div>
```

**Accessibility**
- Give the range an `aria-label` (or `<label for>`). Associating it with `<output for>` improves screen-reader output.
- The `data-out` element is display-only. Since `--var` is `:root` global, name them so **variable names do not collide** across multiple sliders.

---

### 3.7 Tabs - `HA.tabs`

Clicking a button in the tab bar shows exactly one corresponding `[data-panel]`.

| Behavior | Detail |
| --- | --- |
| Button set | `group.querySelectorAll(".tab")` |
| On click | Remove `.active` + `aria-selected="false"` from all `.tab`, add `.hidden` to all `[data-panel]` |
| Activation | Add `.active` + `aria-selected="true"` to the clicked `.tab`, remove `.hidden` from the `[data-panel]` matching the `data-tab` value |
| Linking key | `button[data-tab="X"]` ↔ `[data-panel="X"]` (matched by the same ID string) |

**Markup contract** (conforming to the `tabs` module)

```html
<section class="tabs" data-tabs aria-label="Sections">
  <div class="tab-bar" role="tablist">
    <button class="tab active" data-tab="a" role="tab" aria-selected="true"  aria-controls="panel-a">A</button>
    <button class="tab"        data-tab="b" role="tab" aria-selected="false" aria-controls="panel-b">B</button>
  </div>
  <div class="stack"        data-panel="a" id="panel-a" role="tabpanel">…</div>
  <div class="stack hidden" data-panel="b" id="panel-b" role="tabpanel">…</div>
</section>
```

**Accessibility**
- The initial state has **only one** `.tab.active` + `aria-selected="true"`, and panels other than the corresponding one are `.hidden`.
- Add `role="tablist" / tab / tabpanel`, `aria-controls`, and `aria-selected` (the JS updates `aria-selected`).
- Using `<button>` secures keyboard activation (Enter/Space). Left/right arrow tab movement is not implemented, so
  if you need the full WAI-ARIA tab pattern, there is room to add a separate key handler.

---

### 3.8 Collapsible - no JS needed (native `<details>`)

`[data-collapsible]` remains in the contract but is **not** in `HA.init`'s loop targets.
Open/close is handled by native `<details>/<summary>`, and JS is unnecessary (the attribute is kept only as room to add a11y hooks in the future).

| Behavior | Detail |
| --- | --- |
| Open/close | Native. Keyboard support is also obtained by default |
| Default expanded | `<details open>` for the open state |
| Chevron rotation | The `collapsible` module CSS rotates `.chevron` `rotate(180deg)` on `[open]` |

```html
<details class="collapsible">
  <summary>{{SUMMARY}}<svg class="chevron" aria-hidden="true">…</svg></summary>
  <div class="collapsible-body">{{BODY}}</div>
</details>
```

**Accessibility**
- Being a native element, focus and Enter/Space open/close are supported by default. The `<summary>` touch target is
  secured by `min-height: 44px` (module CSS). Give the decorative chevron `aria-hidden="true"`.

---

### 3.9 Reorder (drag / keyboard reorder) - `HA.reorder`

Reorders the `[data-reorder-item]`s directly under a `[data-reorder]` container by **pointer drag** or
**keyboard**. It uses **Pointer Events** rather than native HTML5 DnD
(it does not add `draggable="true"`/`data-draggable` = validate.mjs rule 5 does not fire) and
animates smoothly with **FLIP**. It was added so `wireframe-block` could "drag a card to swap its position,"
but being general-purpose it can be used to reorder any block. **It is a complete no-op without `[data-reorder]`**
(it does not even inject a live region = zero side effects on static pages).

| Behavior | Detail |
| --- | --- |
| Wire only direct children | `:scope > [data-reorder-item]` targets **only direct children** (no crosstalk with nested containers) |
| Pointer capture | `pointerdown` fires on `[data-reorder-handle]` (or the whole item if absent), and `setPointerCapture` plus `pointermove/up/cancel` are **all attached to the same element `item`** (house pattern. drag continues across edges) |
| Threshold | Drag does not start until movement of 4px (misfire prevention. a press under the threshold is treated as a click) |
| insert mode | `data-reorder-mode="insert"` (default). A `.wf-placeholder` ("↓ drop here") shows the insertion position and splices on drop. For **regions/elements**. The floating element is set to `position:fixed` and **moved to `<body>` only during the drag** (because an ancestor with a `transform` = the rotation of `.wf-card` would make `fixed` use that ancestor as the basis and the ghost would shift to the lower right). Because `appendChild` breaks the pointer capture, `setPointerCapture` is re-acquired immediately after. On drop it returns to the placeholder position of the original board. |
| swap mode | `data-reorder-mode="swap"`. Shows `.is-swap-target` (dashed ring + `⇄`) on the target and swaps the 2 nodes on drop. For **cards** = literal "drag to swap positions" |
| FLIP + rotation compositing | First/Last/Invert/Play. In the order `transform: translate(dx,dy) rotate(baseDeg)`, **composited onto each block's resting rotation** (cards recompute odd/even from order, regions use the fixed `data-rest-rot`). On `transitionend`, the inline transform is removed and it returns to CSS |
| reset | `[data-reorder-reset]` restores all containers to their wire-time order (FLIP, immediate under reduced-motion) |
| export | `[data-reorder-export]` formats `{version:1,scopes:{<scope>:[rid,…]}}` as JSON to the clipboard. Like `HA.copy`, it shows "Copied ✓" for 1200ms. If the clipboard is unavailable, it displays in `[data-reorder-sink]` as a fallback |

**Markup contract** (conforming to the `wireframe-block` module)

```html
<!-- Controls go outside the figure (not a reorder target). The live region goes first -->
<div class="wf-controls no-print">
  <button class="btn btn-ghost btn-sm wf-tool" type="button" data-reorder-reset>↺ Reset</button>
  <button class="btn btn-ghost btn-sm wf-tool" type="button" data-reorder-export>⧉ Copy layout JSON</button>
</div>
<div class="sr-only" data-reorder-live aria-live="polite" aria-atomic="true"></div>

<!-- Region (insert): header/sidebar/content are flat siblings -->
<div class="wf-body" data-reorder data-reorder-scope="regions" data-reorder-noun="region">
  <header class="wf-region -full" data-reorder-item data-rid="header" data-rest-rot="-0.4">
    <span class="wf-handle" data-reorder-handle aria-hidden="true"></span> …
  </header>
  <aside class="wf-region -rail" data-reorder-item data-rid="sidebar" data-rest-rot="0.3"> … </aside>
  <section class="wf-region -main" data-reorder-item data-rid="content" data-rest-rot="0">
    <!-- Card (swap): a nested container -->
    <div class="wf-grid" data-reorder data-reorder-scope="cards" data-reorder-mode="swap">
      <div class="wf-card" data-reorder-item data-rid="cardA"> <span class="wf-handle" data-reorder-handle></span> … </div>
      <div class="wf-card" data-reorder-item data-rid="cardB"> … </div>
    </div>
  </section>
</div>
<pre class="wf-sink no-print" data-reorder-sink hidden></pre>
```

| Attribute | Role |
| --- | --- |
| `[data-reorder]` | The reorder container (**required**). Wires only the direct `[data-reorder-item]` |
| `data-reorder-scope="pages\|regions\|cards\|elements"` | Use identifier. Becomes the announce noun and export key (extensible) |
| `data-reorder-mode="insert\|swap"` | Strategy. insert = insertion (default), swap = 2-node exchange |
| `data-reorder-noun="…"` | Override for the announce noun (optional) |
| `[data-reorder-item][data-rid]` | The movable unit. `rid` is the stable ID for export and reset (**required, unique within the container**) |
| `[data-reorder-handle]` | Optional grab handle (the item's first child). `touch-action:none` is limited to the handle, ≥44px. **Non-focusable** (`aria-hidden`); keyboard is handled by the item's roving tabindex |
| `data-rest-rot="…"` | The item's resting rotation angle (for regions. cards omit it and compute from order) |
| `[data-reorder-reset]` / `[data-reorder-export]` / `[data-reorder-sink]` | Controls (place outside the figure) |

**Keyboard operation** (roving tabindex: only one item per container has `tabindex=0`)

| Key | Action |
| --- | --- |
| `Tab` | Enter / exit the container (move focus between items with arrows) |
| `Space` / `Enter` | Grab (`aria-grabbed=true`) ↔ confirm |
| `← ↑ → ↓` | Move 1 slot while grabbed; move focus only while not grabbed |
| `Esc` | Cancel (identity-restore to the pre-grab position) |

**Accessibility**
- At wire time the engine adds `role="list"` (container) / `role="listitem"` + `aria-roledescription` + roving `tabindex` + `aria-grabbed` (no hand-writing needed).
- It announces grab, move, confirm, cancel, reset, and export to `[data-reorder-live]` (`.sr-only` / `aria-live="polite"` / `aria-atomic`). To re-fire even for identical consecutive wording, it does **clear→set on the next frame** (`requestAnimationFrame`).
- Do not rely on color alone: insert uses the "↓ drop here" wording, swap uses the `⇄` symbol, and drop confirmation uses a color pulse + announcement.
- `--accent` is **only the transient display** of focus/swap/drop; at rest it keeps a grayscale low-fi look.
- `prefers-reduced-motion`: FLIP snaps immediately, drop effects stop, and resting rotation is 0 (`restRot()=0` matches CSS's `transform:none`). A mid-session OS setting change is also re-evaluated each time via `matchMedia`.
- Because the handle limits `touch-action:none` to `[data-reorder-handle]`, **page flick scroll stays alive** in card/region bodies. A `pointerId` guard prevents a second finger from stealing the drag.

**Drag robustness (important)** - Pointer drag does not depend on `setPointerCapture`; on `pointerdown` it **registers `pointermove`/`pointerup`/`pointercancel` on document and `blur` on window** to drive it. The insert-mode ghost is temporarily moved to `<body>` to make `position:fixed` **viewport-relative**, but even if the move breaks capture, the document listeners are guaranteed to observe `pointerup`, so **`finish()` always runs and the item is never left floating** (a permanent fix for the "can't D&D, item floats" bug). `finish()` calls `detach()` at the start to prevent double-fire, listener leaks, and a lingering `is-wf-dragging`. A press under the threshold is treated as a click with focus only.

**Cross-board move (D&D across boards)** - insert boards with `data-reorder-cross="<group>"` can **drag-move an element to another board** (the body of another page, a container's sub-board, etc.; the wireframe has all element boards as `cross="el"`). `onMove` detects the **same-group board under the pointer** with `elementFromPoint` (the ghost is `pointer-events:none`) and transfers the placeholder (`!it.contains(b)` excludes its own descendant boards = self-nesting prevention). `finish` returns `it` to `ph.parentNode` (= destination board), runs FLIP and announces, and roving arranges `tabindex=0` to one each on **both the destination and source boards**. `curBoard()` (`it.closest("[data-reorder]")`) makes keyboard operation follow the post-move board too. Boards without `data-reorder-cross` stay board-internal as before.

**window blur is NON-capture (an important pitfall)** - As "insurance against being left behind when the pointer is released outside the window," it subscribes to window's `blur`, but **always registers it non-capture**. With capture (`true`), blur does not bubble, but instead it **captures every element's blur at the capture phase**, mis-detecting the element blur the instant `begin()` moves the focused element to `<body>` → `finish()` re-enters mid-drag → the element is left behind in `<body>` (this was the cause of the "element disappears" bug when reordering inside a nested board). In addition, `onWinBlur` acts only when `capId!=null && dragging`, `finish()` is split into `finish()` + `finishInner()` with a **re-entrancy guard** on `it._finishing` (try/finally), and `onMove` does nothing when `!dragging` / for insert when `!curC`.

**Pitfalls**
- Place the controls (reset/export) and the live region **outside `[data-reorder]`** (placing them inside makes them reorder targets themselves).
- Make `data-rid` unique within the container (since export and reset reference the ID).
- For nested containers (cards within a region), separating scope/mode keeps `.wf-placeholder` (insert) and `.is-swap-target` (swap) from mixing, which is safe.

---

### 3.10 Element editor (add / delete elements) - `HA.wfedit`

A **sibling behavior composed onto `HA.reorder`**. For the card body (`[data-wf-board]`) of `[data-reorder-scope="elements"]`, it **ADD**s typed low-fi elements from a palette and **DELETE**s the focused element. **MOVE reuses `HA.reorder` (insert mode) as-is**, so an added element can be moved by drag/keyboard from the start. It is a **complete no-op** without both `[data-wf-palette]` and `[data-wf-board]` (it injects neither a live region nor `.wf-active`).

**Keystone: `wireItem(c, it)`** - The per-item wiring inside `HA.reorder` is factored out into a reusable function and made idempotent with `if (it._wired) return;`. Because both the boot-time loop and runtime additions go through the **same code path**, only the new element can become a first-class reorder item without re-wiring the whole container (double-binding structurally cannot happen). The board grows a `c._wireItem(el)`. `HA.reorder` exposes `items / flip / roveTo / announce / nextItem / prevItem` on the function object, which `HA.wfedit` uses.

| Behavior | Detail |
| --- | --- |
| Active card tracking | A single delegated `focusin` traces `e.target.closest('[data-wf-board]')` and updates `.wf-active`(dashed --accent) + `aria-current="true"` + `[data-wf-target-readout]` "Add target: <card>". On change, a polite announcement. At boot, the first board is activated (additions are possible even before focus). |
| ADD (click) | Click `[data-wf-add=type]` → `factory(type)` generates DOM via `createElement` (**no innerHTML** = no XSS, no template residue) → insert into the active board right after the focused element (or at the end if absent) with `flip()` → `c._wireItem(el)` → `roveTo`+`focus` → announce. |
| ADD (drag placement) | **Pointer-dragging** a palette button makes a `.wf-drag-ghost` chip follow, determines **any card** via `elementFromPoint`→`closest('[data-wf-board]')`, highlights with `.wf-drop-hot` + shows the insertion position with a slim `.wf-placeholder`. On `pointerup` it places **at that position on that card** via `add(type, board, before)` (document-listener driven = same robustness as reorder). Only the immediately following synthetic click is suppressed via `setTimeout(0)`, without swallowing subsequent real clicks. |
| DELETE | ✕(`.wf-el-del`, pointer) or Delete/Backspace (limited to `data-wf-el` and `e.target===the element body` = does not fire on ✕/handle/page) → compute the next focus target **before deletion** via `nextItem → prevItem → board` → remove with `flip()` → focus the next. Deleting the last one focuses the empty board (`tabindex=-1`), and the `:not(:has(.wf-card-el))::after` hint appears. |
| Label editing | `makeEditable()` turns `[data-wf-editable]`(button names `.wf-btn`, options `.wf-opt-label`, each `.wf-label`, page names `.wf-page-title`, etc.) into `contenteditable`+`role=textbox`. It `stopPropagation`s `keydown`/`pointerdown` (does not steal reorder/drag) + blurs on Enter/Esc (no line break), and the reorder side also passes through via `e.target.isContentEditable`. On blur, it normalizes `textContent` (paste is plain-texted) + announces. Each export element includes `label`(= the editing span of the body → `.wf-label` if absent). |
| Element types (16, industry standard) | `heading` / `text` / `button` / `link` / `badge` / `image`(X-cross SVG, `aria-hidden`) / `avatar` / `input` / `textarea` / `select` / `checkbox` / `radio` / `toggle` / `search` / `list` / `divider`. All are dashed, gray-bar low-fi expressions. For tilt, it does not add `data-rest-rot` and unifies on **position parity** (`restRot()`'s `i%2`), matching CSS `.wf-card-el:nth-child` (no shift even after reorder/delete). |
| Layout containers / composite (nested) | `cols2` / `cols3` / `card` / `dashboard`(`CONTAINER`) are elements that themselves **enclose a drop-target sub-board** (`subboard()` = `[data-wf-board][data-reorder][data-reorder-cross="el"]`), and **all can be placed by click or drag**. `dashboard` is a composite block where `body("dashboard")` creates 3 sub-boards and **pre-places** `factory("heading")`+`factory("text")` in each (real child elements = movable/deletable). When a container is added, `add()` wires the internal sub-boards + pre-placed child elements all at once via `HA.reorder(el)`, so elements can be **drag-placed into a column / card**, and the container itself can move to another page = **a complex 2D layout** can be built. For heading-type labels, `headLabel(type)` = an appropriate name for containers/composites ("2 Columns", "3 Columns", "Card", "Dashboard"), and the 16 primitives are lo-fi uppercase English. `elementsOf` recurses with `own = [data-wf-board].filter(b => b.closest('[data-wf-el]')===it)` over **only its own direct sub-boards** and adds `cols:[[...],...]` to the export (descending one level at a time even for deep nesting). `ownLabel(it)` judges whether a label is **its own** (`closest('[data-wf-el]')===it`) to prevent child-element labels from mixing in. |
| State (single instance) | The `el-<n>` running counter (`S._seq`) and active board (`S._active`) are held as a **single instance** on `HA.wfedit`. Even if a different closure is created by re-`HA.init()`, the palette/`focusin` stay bound to the first closure, but since state is shared it structurally prevents **rid collisions, misplaced add targets, and additions to a detached board after deletion**. No `Date`/`random` = deterministic. |
| RESET / EXPORT | `[data-reorder-reset]` is a **factory reset** that returns to `c._seed` (the boot-time children) (discarding runtime additions). `[data-reorder-export]` outputs `scopes`(pages/…), and if `HA.wfflow` exists, also `pages`(each page's `title` + element tree) + `flow`(arrow links); otherwise, for backward compatibility, `elements`(per-card-rid tree). Elements are `{type, rid, label}`. |

**Markup (key points)** - The palette is inside `.wf-controls` (outside the figure), the card body is `[data-reorder][data-reorder-scope="elements"][data-reorder-mode="insert"][data-wf-board][tabindex="-1"]`, and children are `.wf-card-el[data-reorder-item][data-wf-el][data-el-type][data-rid="el-N"]` (✕ is injected by wireItem. authored seed and runtime add are the same shape).

**Accessibility**
- Add: The palette is `<button type=button>`(role=toolbar). The added element is `tabindex=0`(roving updated) + focus + announces "Added TYPE. i/n."
- Delete: ✕ is `tabindex=-1`(pointer only), keyboard is Delete/Backspace on the element body. Focus is never orphaned (next → empty board).
- The active-card change is conveyed to SR via `.wf-active` + `aria-current` + readout plus a polite announcement.
- reduced-motion: With `flip()` immediate + `restRot()=0` + `transform:none` on `.wf-card-el`, add/delete/move are instant and elements are flat. `--accent` is only the transient display of focus/active/swap/drop (grayscale at rest).
- Isolation: A try/catch entry after `reorder` in `HA.init`. A `wfedit` failure does not break the others.

---

### 3.11 Screen flow (multiple pages + arrow linking) - `HA.wfflow`

A **third behavior composed** on top of `HA.reorder` + `HA.wfedit`. It **automatically links adjacent pages with SVG arrows** for multiple `[data-wf-page]`s (= reorder insert items, scope=`pages`) within `[data-wf-flow]`, and follows page add/delete/reorder. **A complete no-op** without `[data-wf-flow]` (neither the rAF loop nor the arrow SVG run).

**Keystone: dirty-check rAF re-routing** - A `requestAnimationFrame` loop compares `signature(flow)` (a fingerprint of each page's content coordinates + rid) every frame and re-draws the arrows with `reroute(flow)` **only when it changes**. This lets it follow dragging, FLIP settling, element add/delete, label editing, resize, and horizontal scroll, all without coupling to the reorder engine at all. The loop self-terminates when `flow` leaves the DOM and pauses while `document.hidden`.

| Attribute / structure | Role |
| --- | --- |
| `[data-wf-flow]` | The flow container (**required**). Without it, no-op |
| `[data-wf-flow-track]` | The track where pages line up. **Simultaneously** `[data-reorder][data-reorder-scope="pages"][data-reorder-mode="insert"]`. Supports horizontal scroll |
| `[data-wf-page][data-rid="page-N"][data-rest-rot="0"]` | One page (a reorder item). `.wf-page-head`(handle + dots + `.wf-page-title[data-wf-editable]` + ✕) and `.wf-page-body[data-wf-board]`(the element-editor board) |
| `svg.wf-arrows`(`aria-hidden`) | The arrow overlay. The track's first child, `<defs><marker id="wf-ah">` + `<g class="wf-arrow-layer">`. With `z-index:0` it sits behind the pages(`z-index:1`), visible only in the gaps. To be **clearly visible**, `.wf-arrow` is `stroke:var(--text-secondary)`/`stroke-width:2.5`/`opacity:.9` and `#wf-ah` is `markerWidth/Height:9` (the connection between pages reads at a glance). The rAF dirty-check **follows reorder, drag, add/delete, element move, resize, and horizontal scroll** and re-routes, so it always connects adjacent pages even after auto-move |
| `[data-wf-add-page]` | Add a page (`addPage`→`buildPage`→`HA.init()`. the new page is seeded with heading/text/button). `[data-wf-del-page]` deletes via delegated click (the last one cannot be deleted) |

**Arrow geometry** - `reroute()` converts each page's rect to the track's content coordinates and, for each adjacent pair, uses the points where the center line **crosses the frame** (`edgePoint`: intersection of direction (dx,dy) and half-width + pad) as the start/end to draw `<path class="wf-arrow" marker-end="url(#wf-ah)">`. The SVG is sized to `scrollWidth×scrollHeight` and placed inside the track, so it syncs with horizontal scroll (coordinates are scroll-independent and `signature` matches too = no wasted re-drawing).

**Accessibility / robustness**
- The arrow SVG is decorative, so `aria-hidden`. Page add/delete/move is announced via the reorder live region ("Page added. Page N." etc.).
- `addPage` wires the new page via an idempotent `HA.init()` (the `_wfflowSetup`/`_wfBound`/`_wired` guards prevent doubling of the rAF loop, listeners, and ✕). `reset()` restores only the seed pages, and the arrow SVG is preserved because it is not a target of `:scope > [data-reorder-item]`.
- Arrows are drawn even with reduced-motion (re-routing is motion-independent). Export outputs `pages`(title + nested element tree) + `flow`(linked pairs).
- **Page templates (19 kinds - 18 named screens + blank, declarative)** - A `TEMPLATES` map declares each template as an **ops array** (a string = add an element, `["cols2"|"cols3"|"card", col0[], col1[], …]` = generate a nested container and seed each sub-board). `buildOps`/`fillCols` (selecting **only its own direct sub-boards** via `closest('[data-wf-el]')===container` = safe for arbitrary nesting) interprets it, and `addPage` reads `[data-wf-page-template]` and wires via `HA.init()`. Included: blank / login / signup / dashboard / analytics / form / list+detail / settings / profile / pricing plan / checkout / data list / chat / feed / kanban / onboarding / search results / empty state / error. A new template can be added by appending just 1 line to `TEMPLATES`. Each entry can optionally declare a **width tier `w`** (`buildPage` adds `data-wf-width`: omitted = narrow 300px / `md` 420 / `lg` 560 / `xl` 700), so cols2-family = md, cols3 / dense dashboard = lg, kanban-class = xl, meaning **the more complex the layout, the wider the page stretches so columns are not cramped**. The attribute selector is (0,2,0), so it beats the mobile `@media` shrink (`.wf-page` = (0,1,0)), and a wide page does not shrink while the track scrolls horizontally.

---

### 3.12 Design picker (switching between multiple UI designs) - `HA.designpick`

`[data-theme-pick]`(`<select>`) swaps `<html data-theme>` to switch the **overall theme** (10 types). `[data-wf-skin-pick]`(`<select>`) sets `data-wf-skin`(`sketch`/`clean`/`blueprint`/`mono`) on the nearest / first `[data-wf-flow]` and also adds `data-wf-flat` for non-sketch. **The skin is CSS-only** (overriding borders, radii, and colors with `[data-wf-skin="…"] .wf-…`), and under `data-wf-flat`, `HA.reorder`'s `restRot()` returns 0 so **the tilt disappears and FLIP stays consistent as flat** (`[data-wf-flat] .wf-card-el{transform:none}` cancels the resting tilt. **Do not add `!important`** - adding it would also kill FLIP's inline `transform`. Inline style beats the author's non-important declaration, so both coexist). If neither `<select>` exists, no-op.

The default **sketch skin reproduces a hand-drawn wireframe look** by layering 3 hand-drawn elements: (1) a **sketch font** for in-page content (`--wf-content-font`. chrome text stays `--font-mono`), (2) the canvas **paper grain** (a subtle radial-gradient of dots on `.wf-flow-track`), and (3) **line wobble** on each page frame (`#wf-roughpaper` = `feTurbulence`+`feDisplacementMap` applied to `.wf-page`'s `filter`). The filter is **drawing only** and leaves `getBoundingClientRect`/`elementFromPoint`/layout unchanged - so FLIP and the document-driven drag coordinate calculations are kept strict (`begin()` moves the fixed ghost to `<body>`, so it is also unaffected by the containing block the filter creates). The flat skin (`[data-wf-flat]`) cancels these three with `--wf-content-font:var(--font-mono)` / `background-image:none` / `filter:none`. Furthermore, it automatically stops the wobble for **reduced-motion** (wobble stopped via `@media`) and **while editing a label** (`.wf-page:has([data-wf-editable]:focus){filter:none}` keeps the typed characters sharp. During keyboard reorder, focus is on `[data-reorder-item]` so the hand-drawn expression is maintained).

---

### 3.13 Zoom + pan (SVG stage) - `HA.zoompan`

Adds wheel-zoom, drag-pan, and fit controls to any inline SVG. Wrap the SVG content in `<g data-viewport>`; the behavior applies `transform="translate(tx,ty) scale(s)"` to that group only (the SVG element itself never moves, so controls overlaid on the stage stay put).

| Behavior | Detail |
| --- | --- |
| Resolution | For each `[data-zoompan]` stage: `svg` = the stage itself if it `matches("svg")`, else `stage.querySelector("svg")`; viewport = `svg.querySelector("[data-viewport]")`. **No-op if either is missing** |
| Wheel zoom | `wheel` (with `preventDefault`, `passive:false`) zooms ×1.12 per notch, **anchored at the cursor position** |
| Limits | `data-zoom-min` (default `0.4`) / `data-zoom-max` (default `2.6`) clamp the scale |
| Pan | `pointerdown` + move pans (adds `.panning`, best-effort `setPointerCapture`). A press on `[data-node]` is **skipped** so node dragging (§3.14) wins inside a zoomable stage |
| Controls | Inside the stage: `[data-zoom-in]` (×1.2) / `[data-zoom-out]` (÷1.2) / `[data-zoom-reset]` (scale 1, origin) / `[data-zoom-readout]` (shows `Math.round(s*100)%`) |
| Keys | `keydown` on the stage: `+`/`=` zoom in, `-`/`_` zoom out, `0` reset |
| Touch | `touch-action: none` is set on the SVG so pointer pan/zoom is not stolen by scrolling |

**Markup contract** (conforming to the `node-graph` / `arch-diagram` modules)

```html
<div class="stage" data-zoompan data-zoom-min="0.4" data-zoom-max="2.6" tabindex="0">
  <div class="zoom-controls no-print">
    <button class="btn btn-ghost btn-sm" data-zoom-in aria-label="Zoom in">+</button>
    <button class="btn btn-ghost btn-sm" data-zoom-out aria-label="Zoom out">&minus;</button>
    <button class="btn btn-ghost btn-sm" data-zoom-reset aria-label="Reset view">&#10530;</button>
    <span class="zoom-readout" data-zoom-readout>100%</span>
  </div>
  <svg viewBox="0 0 1000 600" role="img" aria-label="{{TITLE}}">
    <g data-viewport> <!-- all zoomable content here --> </g>
  </svg>
</div>
```

**Accessibility**
- Give the stage `tabindex="0"` so the `+` / `-` / `0` keys work (the listener is on the stage, which is not focusable by default).
- The `.stage` / `.zoom-controls` / `.zoom-readout` appearance comes from `elements.css`; the control buttons are real `<button>`s with `aria-label`s.
- The readout is visual; the SVG keeps `role="img"` + `aria-label` for the content itself.

---

### 3.14 Draggable diagram nodes (auto-tracking edges) - `HA.dragNode`

Makes every `g[data-node="id"]` inside `svg[data-draggable]` draggable by pointer **and** keyboard, while `[data-edge]` connectors re-route live to follow the nodes. Coordinates go through `getScreenCTM().inverse()`, so dragging stays exact at any zoom level (composes with §3.13) and any rendered size.

| Behavior | Detail |
| --- | --- |
| Wire | Each `g[data-node]` gets `cursor: grab` + `tabindex="0"`; its wire-time `translate(x,y)` is recorded for reset |
| Drag | `pointerdown` grabs (adds `.dragging`, re-`appendChild`s the node so it renders on top), `pointermove` sets `transform="translate(…)"` in **SVG user coordinates** (`createSVGPoint` + screen-CTM inverse) |
| Edges | `line[data-edge][data-from][data-to]` gets its `x1/y1/x2/y2` re-pointed (a non-`<line>` edge gets a `d="M… L…"` path). Endpoints land on the **node bounding-box border**, not the centre, so `marker-end` arrowheads stay visible |
| Edge labels | `text[data-edge-label="FROM-TO"]` (the literal `data-from` + `-` + `data-to` string) follows the edge midpoint (6px above) |
| Keys | On a focused node: arrow keys move 8px, **Shift+arrow 24px**; edges re-route per step |
| Reset | `[data-drag-reset]` (looked up in **`svg.parentNode`** - place the button as a sibling of the SVG) restores every node to its wire-time transform and re-routes |
| `foreignObject` auto-fit | At wire time, every `<foreignObject>` (and its sibling `.erd-hit` rect) is grown to the rendered height of its HTML card - HTML-in-SVG cannot auto-size, so this keeps ERD rows from clipping across themes/fonts/row-counts. Runs **before** the first `routeEdges()` |

**Markup contract** (conforming to the `flow-diagram` / `erd` / `mindmap` / `node-graph` / `arch-diagram` modules)

```html
<svg viewBox="0 0 520 470" data-draggable role="img" aria-label="{{TITLE}}">
  <!-- EDGES FIRST (so connectors render behind the node boxes) -->
  <line class="edge" data-edge data-from="start" data-to="process" marker-end="url(#flow-arrow)"/>
  <text class="edge-label" data-edge-label="start-process">{{EDGE_LABEL}}</text>

  <!-- one g[data-node] per box; shapes are LOCAL to the translate -->
  <g data-node="start" transform="translate(180,20)" role="group" aria-label="{{LABEL}} draggable" tabindex="0">
    <ellipse class="node-shape" cx="80" cy="32" rx="80" ry="32"/>
    <text class="node-label" x="80" y="32">{{LABEL}}</text><title>{{LABEL}}</title>
  </g>
</svg>
<button class="btn btn-ghost btn-sm no-print" data-drag-reset>&#8634; Reset layout</button>
```

**Accessibility**
- The JS adds `tabindex="0"`; the focus ring on the node shape comes from `elements.css` (`[data-node]:focus-visible rect/ellipse/polygon`). Keyboard arrows give full drag parity.
- Give each node `role="group"` + `aria-label`, and the SVG `role="img"` + `aria-label`/`<title>`.
- `data-node` IDs must be **unique within the SVG** and exactly match `data-from`/`data-to` (and the `FROM-TO` of any `data-edge-label`).

---

### 3.15 Cross-filter (legend → series dimming) - `HA.crossfilter`

Click (or key) a legend chip to highlight its series and dim everything else - **multi-select**: any number of keys can be active; with none active, everything shows.

| Behavior | Detail |
| --- | --- |
| Scope | One `[data-crossfilter]` container; chips and series are looked up **within it** (multiple instances stay independent) |
| Chips | Each `[data-filter-key="k"]` gets `role="button"` + `tabindex="0"`; click / Enter / Space toggles the key in the active set, and sets `.active` + `aria-pressed` |
| Series | When at least one key is active, every `[data-series]` whose key is **not** active gets `.dimmed` (`opacity: .18` via `elements.css`); otherwise `.dimmed` is removed from all |
| Pairing | `data-filter-key` value ↔ `data-series` value (the same literal string, e.g. `g-1`) |

**Markup contract** (conforming to the `node-graph` module)

```html
<section class="node-graph stack" data-crossfilter aria-label="{{TITLE}}">
  <div class="cluster ng-legend no-print" role="group" aria-label="Filter nodes by group">
    <span class="chip g-1" data-filter-key="g-1"><span class="ng-dot"></span>Group A</span>
    <span class="chip g-2" data-filter-key="g-2"><span class="ng-dot"></span>Group B</span>
  </div>
  <!-- any element carrying data-series participates -->
  <svg …><g data-viewport>
    <g data-node="ingest" data-series="g-1">…</g>
    <g data-node="worker" data-series="g-2">…</g>
  </g></svg>
</section>
```

**Accessibility**
- The JS supplies `role="button"`, `tabindex="0"`, and `aria-pressed` on chips - no hand-writing needed; wrap the legend in `role="group"` + `aria-label`.
- Dimming is opacity-only (`.dimmed`), so do not rely on it as the sole carrier of meaning; the `.active` outline marks the selected chips.

---

### 3.16 Scroll reveal - `HA.reveal`

Fades/slides an element in the first time it scrolls into view. Appearance lives in `elements.css`: `[data-reveal]` starts at `opacity: 0; translateY(14px)` and `.in` clears it.

| Behavior | Detail |
| --- | --- |
| Trigger | `IntersectionObserver` at threshold `0.2` (via the `el_observe` helper shared with `counter`); on first intersection the element gets `.in` and is **unobserved** (fires once) |
| Stagger | `data-reveal-delay="ms"` defers the `.in` by `setTimeout` (e.g. 0 / 120 / 240 for a cascade) |
| Fallbacks | `prefers-reduced-motion` **or** no `IntersectionObserver` → `.in` is added to all immediately (and the `elements.css` `@media` rule also forces the resting state visible) |

**Markup contract** (the `stepper` module documents this as its optional enhancement)

```html
<div class="step lvl-1" data-n="1" data-reveal>…</div>
<div class="step lvl-2" data-n="2" data-reveal data-reveal-delay="120">…</div>
```

**Accessibility / pitfalls**
- Content is hidden (`opacity: 0`) until revealed - never put **print-critical** content behind `data-reveal` alone; printing happens without scrolling. Use sparingly on decorative entrances.
- Reduced-motion users see everything at once with no transition (handled in both JS and CSS).

---

### 3.17 Tree / Pagination / Chart tooltip / Count-up (compact contracts)

Four small behaviors that need no more than their attribute contract.

**Tree collapse - `HA.tree`** - within `[data-tree]`, each `[data-tree-toggle]` gets `role="button"` + `tabindex="0"` + `aria-expanded="true"`. Click / Enter / Space finds the nearest `[data-tree-node]` ancestor (falling back to the toggle's parent), toggles `.collapsed` on its `[data-children]` (hidden via `elements.css`), and flips `aria-expanded` + `.is-collapsed` (which rotates the `.tw-caret` glyph −90°).

```html
<ul data-tree>
  <li data-tree-node>
    <span data-tree-toggle><span class="tw-caret">▾</span> Branch</span>
    <ul data-children> <li>Leaf</li> </ul>
  </li>
</ul>
```

**Pagination - `HA.paginate`** - `table[data-paginate]` pages its `<tbody>` rows by `data-page-size` (default `10`) and renders `‹ Prev` / `1 / n (m rows)` / `Next ›` into the sibling `[data-pager]` (looked up via `table.parentNode`). Hidden pages use `.page-hidden`; rows already hidden by `HA.filter` (`.hidden`) are excluded from the count. The behavior exposes `table._repage()`, which `HA.sortable` calls after a sort and `HA.filter` after a keystroke - **sort + filter + paginate coexist on one table**. Optional `data-row-select`: clicking a row toggles `.selected` (clicks on `a`/`button`/`input` are ignored). Pager buttons are real `<button>`s (keyboard for free).

```html
<table data-sortable data-paginate data-page-size="8" data-row-select> … </table>
<div data-pager class="no-print"></div>
```

**Chart tooltip - `HA.tooltip`** - for each `[data-chart-tip]` container, a single `.ha-tooltip` `<div>` is injected into `<body>`; hovering any descendant `[data-tip="text"]` shows the text at the pointer (+12px offset, following `pointermove`), and `pointerleave` hides it. **Pointer-only and decorative** - keep the values readable without it (`role="img"` + `<title>` on the SVG, as the chart modules do).

```html
<figure class="chart card-outlined" data-chart-tip>
  <svg role="img"><title>{{TITLE}}</title>
    <rect class="bar" data-tip="Q1: 48"/>
  </svg>
</figure>
```

**Count-up - `HA.counter`** - `[data-counter]` counts its number up when first revealed (same shared `IntersectionObserver`, threshold `0.2`, runs once). Target value = `data-to` (falls back to parsing the element's text); duration = `data-dur` ms (default `900`, cubic ease-out); `data-suffix` appends a unit (`%`, `pt`, …). Decimal places are inferred from `data-to` and thousands separators are added. Under `prefers-reduced-motion` (or no `IntersectionObserver`) the final value is written immediately. Author the **final value as the text content** so the number is correct before JS runs.

```html
<span class="metric-value" data-counter data-to="1284" data-suffix="%">1,284%</span>
```

### 3.18 Form mock (prototype submit) - `HA.formMock`

For each `[data-form-mock]` `<form>` (the `form-fields` module / builder `form` section), the **submit is intercepted** (`preventDefault`) so a prototype form never navigates or reloads. On submit the form gains `.is-submitted` (which reveals the `.form-status` confirmation, e.g. "Submitted ✓") and the status node's `aria-hidden` flips to `false`. Idempotent (`form.__haFormMock` guard) and a **complete no-op** without `[data-form-mock]`. The submit button stays a real `button[type="submit"]` (so keyboard / Enter work and the validator does not flag it as a dead control), and native constraint validation still runs first - required fields block submit until filled. This is the one piece that makes a themed form a *real* interactive prototype rather than a dead mock.

```html
<form class="form-fields" data-form-mock>
  <div class="field"><label for="n">Name</label><input id="n" type="text"></div>
  <div class="form-actions">
    <button class="btn" type="submit">Send</button>
    <span class="form-status" role="status" aria-hidden="true">Submitted ✓</span>
  </div>
</form>
```

> **Form-control primitives** (the themed `<input>`/`<select>`/`<textarea>`/checkbox/radio/`.switch`, `.field`, `.option-row`, `.checklist`) are **CSS, not a behavior** - they live in `templates/core/elements.css` (Layer 1) and need no JS. `formMock` is the only behavior in the form-control tier; the controls themselves toggle natively. See `reference/04` (`form-fields` / `checklist` modules) and `reference/03` §"Form controls".

---

### 3.19 Contents scroll-spy - `HA.tocSpy`

For each `[data-toc-spy]` element (the builder's contents rail `nav.ha-rail` and inline contents box
`details.ha-toc-inline`), the link whose target section is being read gets `aria-current="true"`
(styled as the active entry). "Being read" = the last target whose top has passed a reading line
`min(30% of the viewport, 140px)` from the top; at the very bottom of the page, the last target.
Scroll handling is `requestAnimationFrame`-throttled and passive. Links stay ordinary in-page
anchors, so navigation works without JS; sections need `scroll-margin-top` (set on `[id]` in
`elements.css`) so a jump does not hide the heading.

```html
<nav class="ha-rail ha-toc" aria-label="Contents" data-toc-spy>
  <ol><li><a href="#s1">Summary</a></li><li><a href="#s2">Risks</a></li></ol>
</nav>
```

---

## 4. Module × Behavior Correspondence Table

Which behavior each module needs (based on the `INTERACTION` line of the actual file).

| Module (file) | Required behavior | Trigger attribute |
| --- | --- | --- |
| `data-table.html` | sortable + filter + paginate | `table[data-sortable]`, `[data-filter][data-filter-in=".dt-row"]`, `table[data-paginate][data-page-size="8"][data-row-select]` + sibling `[data-pager]` |
| `kanban-board.html` | kanban | `[data-kanban]` |
| `slider-control.html` | slider + copy | `[data-slider]`, `[data-copy-text]` |
| `tabs.html` | tabs | `[data-tabs]` |
| `collapsible.html` | (none / native) | `<details>` |
| `kpi-grid.html` | counter | `[data-counter][data-to]` (+ `data-suffix` for units; wrap in a `[data-filter-in]` target to make it filterable) |
| `chart-bar.html` / `chart-line.html` / `chart-donut.html` | tooltip (+ CSS-only hover) | `[data-chart-tip]` on the figure + `data-tip="…"` per bar / point / slice |
| `diff-block.html` | (none. can be made copyable by adding `[data-copy]`) | - |
| `timeline.html` / `comparison-grid.html` / `callout-box.html` | (none) | - |
| `stepper.html` | (none. optional reveal) | `[data-reveal]` (+ `[data-reveal-delay]`) per `.step` for a staggered scroll-in |
| `flow-diagram.html` | dragNode | `svg[data-draggable]` + `g[data-node]` + `[data-edge][data-from][data-to]` (+ `[data-edge-label]`), `[data-drag-reset]` |
| `arch-diagram.html` / `erd.html` / `mindmap.html` | zoompan + dragNode | `.stage[data-zoompan]` (+ zoom controls) wrapping `svg[data-draggable]` + `g[data-node]` + `[data-edge]`, `[data-drag-reset]` |
| `node-graph.html` | zoompan + dragNode + crossfilter | the same stage/SVG contract as above, plus `[data-crossfilter]` + legend `[data-filter-key="g-N"]` ↔ node `[data-series="g-N"]` |
| `mockup-frame.html` | tabs | `[data-tabs]` wrapping the device; `.mock-switcher .tab[data-tab]` ↔ `[data-panel]` screens |
| `wireframe-block.html` | **reorder + wfedit + wfflow + designpick** (opt-in. static without the attributes) | reorder (cross-board capable): `[data-reorder][data-reorder-scope=pages\|regions\|cards\|elements][data-reorder-mode][data-reorder-cross]` + `[data-reorder-item][data-rid]` + `[data-reorder-handle]` + `[data-reorder-reset]`/`[data-reorder-export]` / element editor (16 primitives + containers cols2/cols3/card + composite dashboard, click & drag placement): `[data-wf-palette]` `[data-wf-add=type]` `[data-wf-board]` `[data-wf-el][data-el-type]` `[data-wf-editable]` / screen flow + arrows + templates: `[data-wf-flow]` `[data-wf-flow-track]` `[data-wf-page]` `[data-wf-add-page]` `[data-wf-page-template]` `[data-wf-del-page]` `svg.wf-arrows` / design switching: `[data-theme-pick]` `[data-wf-skin-pick]` |

> For any interactive module, the CSS appearance (`.dragging`, `.drop-target`,
> `.active`, the `data-sort` caret, etc.) is defined by the **module-side `<style data-module="…">`**, and
> `interactions.js` handles only the state transitions - that is the division of responsibility.

---

## 5. Composition Guide (combinations that work well)

Behaviors do not collide, so you can freely coexist them. Representative "works well" configurations:

| Shape (use) | Recommended module composition | Effective behaviors |
| --- | --- | --- |
| data-viz / dashboard | `kpi-grid` + `chart-bar`/`chart-line` + `data-table` | sortable, filter, paginate, counter, tooltip, theme-toggle |
| diagram explorer | `node-graph` / `arch-diagram` / `erd` / `mindmap` | zoompan, dragNode, crossfilter (node-graph) |
| report / spec | `callout-box` + `tabs` + `comparison-grid` + `collapsible` | tabs, theme-toggle |
| code-review / PR writeup | `diff-block`(+`[data-copy]`)+ `tabs`(file switching)+ `callout-box` | copy, tabs |
| prototype / editor | `slider-control` + preview element + `[data-copy-text]` | slider, copy |
| triage board | `kanban-board` + a header `data-filter` search | kanban, filter |

**Design principles**

1. **A theme toggle can be placed once in any Shape** (included by default in `base.template.html`'s header).
   `dark-focus` pairs especially well with data-viz / diagram / code.
2. **`data-table` can have sortable and filter at the same time** (`data-sortable` on the same table,
   `data-filter`/`data-filter-in` on the search field). This is the most commonly combined pattern.
3. **`tabs` excels as a parent container that folds away heavy / long content**. Putting a different module
   (table, diagram, diff) in each panel lets you control the information density of one screen.
4. **`slider` + preview + `copy`** is the three-piece tuner set "move the value → reflect immediately → copy the CSS."
   The `slider-control` module embodies this configuration.
5. **Avoid collisions of same-name selectors / same global variables**: be careful with `filter`'s target class and
   `slider`'s `--var` name (§3.3 / §3.6).
6. **Every interactive attribute is opt-in**: the chart modules carry `[data-chart-tip]` and the diagram
   modules carry `[data-zoompan]` / `svg[data-draggable]` (+ `[data-crossfilter]` on `node-graph`), but
   removing the attributes leaves a fully static, print-clean figure - the behaviors are zero-footprint
   when their triggers are absent.

---

## 6. Quick Checklist

- [ ] Inlined `interactions.js` inside a `<script>`, just before `</body>`.
- [ ] If using interactive modules, also inlined the corresponding `<style data-module="…">` exactly once.
- [ ] The data-attribute keys (`data-tab` ↔ `data-panel`, `data-col`, `data-filter-in`, `data-slider`) are
      correctly matched and unique.
- [ ] Buttons are `<button>` + `aria-label`, and inputs have `aria-label`/`<label>`.
- [ ] Avoided same-name `filter` targets / same-name `--var`.
- [ ] The use case can tolerate the clipboard requiring a secure context.
