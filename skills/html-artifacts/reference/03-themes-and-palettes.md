# 03 - Themes and Palettes

> **Canonical source for themes.** The theme list, palettes (hex values), and contrast ratios in this document are the single source of truth, taken directly from `templates/core/themes.css`. Other documents (SKILL.md, other references, README) should link here instead of duplicating theme counts, hex values, or contrast numbers.

This document explains the Foundation layer's color system. The target files are `templates/core/tokens.css` (structural tokens + the density axis) and `templates/core/themes.css` (per-theme colors + structural personality). It covers the division of roles between the two, the density axis, the 10 themes and their structural personalities, the mechanism of `data-theme` switching, the behavior of the dark toggle, and how to override with a custom palette.

> Terminology clarification: "theme" here refers to a color preset (`birchline` / `dark-focus` / `interactive-warm` / `minimal` / `midnight` / `slate` / `forest` / `rose` / `nord` / `sunset`). "shape" refers to the kind of artifact (report, spec, dashboard, etc.) and is determined by the composition on the `base.template.html` side. Theme and shape are independent; each theme merely has "shapes it pairs well with," which is not enforced.

---

## 1. The token layer model

Colors and scales are defined in 3 layers. Components (the primitives in `elements.css`, the modules in `modules/*`) **reference only the bottom-most semantic aliases** as the cardinal rule, and must not write raw values directly.

| Layer | Content | Defined in | Theme-dependent |
| --- | --- | --- | --- |
| 1. Raw scale | spacing / radius / font stack / motion / type scale | `:root` in `tokens.css` | Defaults are theme-independent; themes may re-tune `--type-*`/`--radius-*` (structural personality, §2) and the density axis rescales spacing via `--sp-unit` (§1) - spacing itself is never theme-dependent |
| 2. Raw colors | each theme's raw colors such as `--color-primary`, `--color-ivory`, `--color-bg` | each `[data-theme=…]` in `themes.css` | Dependent |
| 3. Semantic | `--bg-*`, `--text-*`, `--border-*`, `--accent`, `--on-accent` | `themes.css` (bundling raw with `var()`) | Dependent |

### Why it is split into 2 files

In the original 5 skills, each of the original theme files **redundantly defined** spacing / radius / type / font. To de-duplicate that, the structural tokens (theme-independent scales) are placed only once in `tokens.css`, and `themes.css` overrides **colors plus a limited structural personality** - each theme may re-tune `--type-*`, `--radius-*`, and letter-spacing (the "structural personality" table in §2). Themes must **never** override `--sp-*`, `--sp-unit`, or `--container-max`: spacing is owned by the density axis (below), and page width is owned by the layout/artifact so theme switching and density/viewport switching stay independent.

### What tokens.css holds (structural tokens)

```
--sp-unit               4px - the spacing base unit (the density axis rescales it)
--sp-1..--sp-8          spacing scale, derived from --sp-unit (×1/2/3/4/6/8/12/16)
--radius-xs/sm/md/lg/pill  rounded corners (themes may override - see §2 personality)
--font-sans/mono/serif  font stacks - fully OFFLINE (no webfont/CDN). Sans leads with clean
                        OS-resident geometric and CJK system faces (-apple-system / Inter /
                        Hiragino Sans / Apple SD Gothic Neo / Noto Sans JP/KR); mono leads
                        with crisp coding faces (SF Mono / JetBrains Mono / Cascadia …);
                        serif is reserved for pull-quotes and explicit editorial callouts.
--font-display          display alias (= --font-sans across all themes for crisp CJK/Latin balance)
--tracking-display/-tight/-eyebrow  letter-spacing applied to display/heading/eyebrow
                        in elements.css (large type tightens; all-caps kickers open up).
--type-display/h1/h2/h3/body/small/caption  fluid clamp() font shorthands
--container-max         default 1200px (layout/artifact-owned; themes do not override)
--ease / --ease-out / --dur-fast/mid/slow   motion tokens for interactive hover/focus transitions
--cat-1..--cat-5        data-viz category colors (described later)
```

### Surface & motion discipline (`elements.css`)

- **Clean solid surfaces** - `body` uses a clean, opaque `--bg-page` background without SVG `feTurbulence` noise overlays or decorative radial-gradient mesh blobs. Cards and callouts use `1px` semantic borders (`color-mix(in srgb, var(--accent) 28%, var(--border-default))`) instead of thick 3px–4px left border rails.
- **No page-load bounce** - pages render immediately in their final resting state (no `@keyframes ha-enter` entrance bounce on load); interactive transitions use subtle `140ms–220ms` opacity/border-color easing (`prefers-reduced-motion` guarded).

### The density axis (`data-density`)

The whole spacing scale hangs off one unit, so a single `data-density` attribute on `<html>` rescales every gap, padding, and margin at once (the builder always emits `data-density` alongside `data-theme` / `data-layout`):

```css
--sp-unit: 4px;
--sp-1: var(--sp-unit);            --sp-2: calc(var(--sp-unit)*2);
--sp-3: calc(var(--sp-unit)*3);    --sp-4: calc(var(--sp-unit)*4);
--sp-5: calc(var(--sp-unit)*6);    --sp-6: calc(var(--sp-unit)*8);
--sp-7: calc(var(--sp-unit)*12);   --sp-8: calc(var(--sp-unit)*16);
```

After `:root`, `tokens.css` defines the two non-default densities:

```css
[data-density="compact"]  { --sp-unit: 3.25px; --type-body: 400 14px/1.55 var(--font-sans); --type-small: 400 12.5px/1.45 var(--font-sans); }
[data-density="spacious"] { --sp-unit: 4.75px; }
```

- `comfortable` (the default, no override) - `--sp-unit: 4px`, values identical to the historic scale.
- `compact` - `--sp-unit: 3.25px` plus slightly smaller body/small type; for dense dashboards and ops views.
- `spacious` - `--sp-unit: 4.75px`; for airy, editorial long-form.

Because themes never touch `--sp-*` / `--sp-unit`, any density pairs with any theme. (The per-section `density: "compact"` key of the `table` section type is a separate, table-local tightening - see `04-module-catalog.md` / `07-build-spec.md`.)

### Semantic aliases (every theme must provide them)

| Category | Token |
| --- | --- |
| Background | `--bg-page` / `--bg-surface` / `--bg-muted` / `--bg-card` |
| Text | `--text-primary` / `--text-secondary` / `--text-muted` |
| Border | `--border-default` / `--border-subtle` |
| Accent | `--accent` / `--on-accent` |
| Status | `--color-success` / `--color-warning` / `--color-danger` / `--color-info` |
| Shadow | `--shadow-sm` / `--shadow-md` / `--shadow-lg` (some themes have `--shadow-glow` / `--shadow-interactive`) |
| Code | `--code-bg` |

At the end of `tokens.css`, `body { font: var(--type-body); color: var(--text-primary); background: var(--bg-page); }` is bound, so the whole document's base color and text color change in tandem just by switching the theme.

---

## 2. The 10 themes

`themes.css` scopes each theme to a `[data-theme="…"]` selector. Only `birchline` is also applied to `:root` at the same time, making it the **default theme** (applied even when `data-theme` is unspecified).

| theme | Character | accent | base color | shapes it pairs well with |
| --- | --- | --- | --- | --- |
| `birchline` (default) | Warm stone paper, terracotta accent | `#B85032` (terracotta) | warm stone `#FAF9F6` | report, spec, long-form |
| `dark-focus` | Deep carbon-slate dark, crisp sky-blue accent | `#58A6FF` (sky blue) | `#0D1117` | data-viz, diagram, code |
| `interactive-warm` | Clean neutral white, cobalt accent | `#2563EB` (cobalt) | `#FAFAFA` | prototype, editor |
| `minimal` | High-contrast monochrome, tight radii | `#171717` (ink) | `#FFFFFF` | essay, long-form documents |
| `midnight` | Obsidian dark, indigo-violet accent | `#A78BFA` (violet) | `#0F0E17` | dashboard, data-viz, diagram |
| `slate` | Crisp cool slate, enterprise blue accent | `#1D4ED8` (blue) | `#F8FAFC` | report, spec, dashboard |
| `forest` | Calm botanical paper, emerald-pine accent | `#15803D` (emerald) | `#F7F9F7` | report, documentation, long-form |
| `rose` | Warm editorial blush, deep crimson-rose accent | `#BE185D` (crimson rose) | `#FDF8F9` | product pages, lighter reports |
| `nord` | Polar night dark, frost cyan accent | `#88C0D0` (frost) | `#242933` | code, diagram, data-viz |
| `sunset` | Warm espresso dark, amber-gold accent | `#F59E0B` (amber) | `#161210` | dashboard, data-viz |

### Theme structural personality (radius / tracking overrides)

Every theme block in `themes.css` carries a **structural personality** via `--radius-*`, `--type-caption`, and letter-spacing while keeping clean fluid `--font-sans` headings across all themes so CJK and technical labels remain crisp. Themes never override `--sp-*` / `--sp-unit` or `--container-max`. The resulting silhouettes fall into three families:

- **warm-editorial** - `birchline` / `rose` / `forest` / `minimal` (`minimal` tightens radii to `2/4/6/8px`; `forest` and `rose` use softer `10/16px` radii)
- **bold-sans** - `sunset` / `nord` / `interactive-warm` (`interactive-warm` uses `8/12/16px` radii; `nord` uses sharp `3/5/8/12px` radii with mono captions)
- **technical-compact** - `slate` / `midnight` / `dark-focus` (crisp `6–8px` card radii and `--font-mono` captions)

### WCAG contrast ratios

Measured contrast ratios for all 60 key token pairs across the 10 themes (`node tools/contrast-audit.mjs` reports **60/60 PASS, 0 below AA**). **Body text (`--text-primary` × `--bg-page`), secondary text (`--text-secondary` × `--bg-surface`), muted text (`--text-muted` × `--bg-surface`), and button pairs (`--accent` × `--on-accent`) all clear WCAG AA on every theme.**

| theme | text-primary / bg-page | text-secondary / bg-surface | text-muted / bg-surface | on-accent / accent |
| --- | --- | --- | --- | --- |
| `birchline` | `#0F172A` on `#F8FAFC` ≈ 17.06:1 | `#334155` on `#FFFFFF` ≈ 10.35:1 | `#64748B` on `#FFFFFF` ≈ 4.76:1 | `#FFFFFF` on `#B91C1C` ≈ 6.47:1 |
| `dark-focus` | `#ECF0F6` on `#0D1117` ≈ 16.55:1 | `#9BA4B5` on `#151B23` ≈ 6.90:1 | `#8290A5` on `#151B23` ≈ 5.34:1 | `#091326` on `#58A6FF` ≈ 7.34:1 |
| `interactive-warm` | `#111827` on `#F9FAFB` ≈ 16.98:1 | `#4B5563` on `#FFFFFF` ≈ 7.56:1 | `#6B7280` on `#FFFFFF` ≈ 4.83:1 | `#FFFFFF` on `#2563EB` ≈ 5.17:1 |
| `minimal` | `#18181B` on `#FDFDFC` ≈ 17.41:1 | `#52525B` on `#FFFFFF` ≈ 7.73:1 | `#71717A` on `#FFFFFF` ≈ 4.83:1 | `#FFFFFF` on `#374151` ≈ 10.31:1 |
| `midnight` | `#F1F5F9` on `#0B0E17` ≈ 17.60:1 | `#94A3B8` on `#131826` ≈ 6.90:1 | `#8290A5` on `#131826` ≈ 5.46:1 | `#0A1020` on `#4F83FF` ≈ 5.44:1 |
| `slate` | `#0F172A` on `#F8FAFC` ≈ 17.06:1 | `#334155` on `#FFFFFF` ≈ 10.35:1 | `#64748B` on `#FFFFFF` ≈ 4.76:1 | `#FFFFFF` on `#1D4ED8` ≈ 6.70:1 |
| `forest` | `#14231A` on `#F6F8F5` ≈ 15.30:1 | `#354B3E` on `#FFFFFF` ≈ 9.43:1 | `#62796B` on `#FFFFFF` ≈ 4.70:1 | `#FFFFFF` on `#15803D` ≈ 5.02:1 |
| `rose` | `#23151B` on `#FDF8F9` ≈ 16.72:1 | `#4F3842` on `#FFFFFF` ≈ 10.62:1 | `#7C626E` on `#FFFFFF` ≈ 5.48:1 | `#FFFFFF` on `#BE185D` ≈ 6.04:1 |
| `nord` | `#ECEFF4` on `#1E222A` ≈ 13.83:1 | `#C8D0E0` on `#272C36` ≈ 9.04:1 | `#8A94A6` on `#272C36` ≈ 4.58:1 | `#181C24` on `#88C0D0` ≈ 8.53:1 |
| `sunset` | `#F4ECE6` on `#12100E` ≈ 16.26:1 | `#C8B7AB` on `#1C1916` ≈ 9.01:1 | `#948275` on `#1C1916` ≈ 4.76:1 | `#1C1307` on `#F59E0B` ≈ 8.54:1 |

**Automated contrast check.** `node tools/contrast-audit.mjs` audits every theme's key pairs (the table above) against the WCAG bar appropriate to each pair's context (normal text including muted captions 4.5:1 · non-text UI components 3:1, §1.4.11); `--json` for machine output. `tools/validate.mjs` also re-checks the **built artifact's active theme** (and any inline `--accent` custom override) and emits an advisory **warning** for any sub-AA pair. When raising a custom accent, run it through the audit and prefer an accent whose button pair clears 4.5:1.

---

## 3. Switching via data-theme

The theme switches via the single `data-theme` attribute on `<html>`. Since the CSS for all themes is scoped by `[data-theme=…]` and already inlined into one file, **simply rewriting the attribute switches live** (no reload, no external request needed).

```html
<html data-theme="birchline">        <!-- default -->
<html data-theme="dark-focus">
<html data-theme="interactive-warm">
<html data-theme="minimal">
<html data-theme="midnight">
<html data-theme="slate">
<html data-theme="forest">
<html data-theme="rose">
<html data-theme="nord">
<html data-theme="sunset">
```

In `base.template.html`, the `{{THEME}}` of `<html lang="{{LANG}}" data-theme="{{THEME}}">` is filled at generation time. Even if the attribute is omitted, `birchline` applies via `:root`.

The inline order (inside `<style>`) also matters: paste in the order `reset.css → tokens.css → themes.css → elements.css → each module CSS`. The cascade works in the order raw colors (tokens) → semantic overrides (themes) → the primitives that reference them.

---

## 4. The behavior of the dark toggle

The header of `base.template.html` includes a "◐ Theme" button from the start.

```html
<button class="btn-ghost btn-sm no-print" data-theme-toggle aria-label="Toggle dark mode" …>◐ Theme</button>
```

`HA.themeToggle` in `interactions.js` attaches a click handler to elements that have `[data-theme-toggle]`. The logic is "a round-trip toggle to and from `dark-focus`":

1. On click, read the current `data-theme` (`birchline` if unspecified).
2. If the current one is **not** `dark-focus` → save the current theme to `html.dataset.prevTheme` and set `data-theme` to `dark-focus`.
3. If the current one **is** `dark-focus` → revert to `dataset.prevTheme` (`birchline` if absent).

In other words, the toggle is always the 2 states "current theme ⇄ dark-focus." Pressing from `interactive-warm` cycles `interactive-warm ⇄ dark-focus`; pressing from `minimal` cycles `minimal ⇄ dark-focus`. Note that `dark-focus` is fixed as the "dedicated dark theme" destination (it is not a generic light/dark inversion) - even the other dark themes (`midnight` / `nord` / `sunset`) toggle to `dark-focus`, not to a light counterpart.

Supplementary notes:

- The button has `no-print`, so it disappears when printing.
- State is held only in `dataset.prevTheme` (in-DOM memory) and is not persisted to `localStorage`. A reload returns to the initial `{{THEME}}`.
- Any number of elements with `data-theme-toggle`, placed anywhere, will work (`HA.themeToggle` scans all matching elements).

---

## 5. Overriding with a custom palette

When you want to swap only the accent without adding a new theme file, override the CSS variables inline on `<html>`. Since semantic aliases can be overridden via the cascade, the accent pair alone is enough at minimum.

```html
<html data-theme="birchline" style="--accent:#2563EB;--on-accent:#fff">
```

This alone makes every element that references the accent follow: `.btn` / `.badge-accent` / `.callout` / `.card-accent` / `.eyebrow` / `a.link` / `:focus-visible` ring, and even the **data-viz category color `--cat-1`** (because `--cat-1: var(--accent)`).

### Data-viz category scale (--cat-1..--cat-5)

At the end of `tokens.css`, the category colors are derived from the accent + status colors. Chart-family modules (`chart-bar` / `chart-donut` / `chart-line`) reference these, so changing only the accent makes the chart's first series color follow too.

```
--cat-1: var(--accent);
--cat-2: var(--color-info,    #0D9488);
--cat-3: var(--color-success, #2E7D32);
--cat-4: var(--color-warning, #D97706);
--cat-5: var(--color-danger,  #DC2626);
```

When you want to swap multiple series colors at once, `--cat-2..--cat-5` can be inline-overridden the same way.

### Integration with the color-palette skill

When raising a full-fledged palette from a single brand hex, use the `color-palette` skill to generate an 11-step scale (50–950) + WCAG-checked semantic tokens. There are 2 ways to apply the generated result:

1. **Light swap** - assign the generated scale's base color (e.g., the 500 / 600 step) to `--accent` and the color that sits on the text to `--on-accent`, and override via the inline `style` above. Derivatives including `--cat-*` follow automatically.
2. **Settle it as a theme** - add a new `[data-theme="brand"] { … }` block to `themes.css` and swap wholesale in the order generated raw (`--color-primary` / `--color-*`) → semantic (`--bg-*` / `--text-*` / `--accent` / `--cat-*`). If you follow the same "raw → semantic" two-layer structure as the existing themes, it stays consistent with other behaviors such as the dark toggle.

In either case, run it through `color-palette`'s WCAG contrast check and follow this system's policy (§2): body × background at AA or above, and muted captions at 4.5:1 or above for normal-sized text.

---

## 6. Quick reference

| What you want to do | How |
| --- | --- |
| Choose a theme | Set `<html data-theme="…">` to one of the 10: `birchline` / `dark-focus` / `interactive-warm` / `minimal` / `midnight` / `slate` / `forest` / `rose` / `nord` / `sunset` (`birchline` if unspecified) |
| Go dark live | Click the `[data-theme-toggle]` button (⇄ `dark-focus`) |
| Change only the accent | `<html style="--accent:#…;--on-accent:#…">` |
| Change chart colors in tandem too | Change the accent (`--cat-1` follows) / individually override `--cat-2..5` |
| Generate a palette from a brand color | `color-palette` skill → swap `--accent` or add a new `[data-theme]` |
| Change the overall whitespace (density) | Set `<html data-density="comfortable\|compact\|spacious">` - rescales `--sp-unit` (§1); themes never touch spacing |
| Change corners / typesetting per theme | The theme's structural personality (`--type-*` / `--radius-*` overrides in `themes.css`, §2 table) |
| Change structure globally (all themes at once) | Edit the raw scales in `tokens.css` (applies commonly to all themes) |

Reference files: `templates/core/tokens.css`, `templates/core/themes.css`, `templates/core/reset.css`, `templates/core/elements.css`, `templates/core/interactions.js`, `templates/base.template.html`
