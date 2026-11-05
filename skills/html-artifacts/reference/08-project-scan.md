# 08 - Project/UI Scan Protocol

> **Role of this document**: the owner document for evidence-first scanning when an
> html-artifacts request must copy, document, or redesign an existing UI. The normal
> output contract still applies: deliver one self-contained offline `.html`, with no
> CDN, external library, or build step.

Use this protocol only when the user's request depends on what already exists:
current UI, existing screen, attached screenshot, browser annotation, localhost route,
"copy this page", "match the app", "before/after", "redesign from current", or similar.
For abstract reports, diagrams, specs, or greenfield wireframes, skip this file.

## 1. Scan Decision

Before selecting shape, modules, theme, layout, header, density, or copy, classify the input:

| Input | Required scan |
| --- | --- |
| Current project UI / local route | Repo scan + running-app scan when feasible |
| Attached screenshot only | Screenshot visual analysis + ask for repo/browser only if critical details are hidden |
| Browser annotation / visual feedback | Read the annotation context first, then inspect the target element/route |
| Existing component or page file | Repo scan of that component, its imports, styles, and assets; run app if visual fidelity matters |
| External URL | Use browser/web extraction only if the user has rights or requests analysis/redesign; keep final output self-contained |

Keep the scan scoped to the requested route, component, or screen. Do not crawl the whole
repo when a single page is enough.

## 2. Repo Scan

**Step 0 - reuse the spec-preview UI cache before reading any source.** If
`<project>/.tmp/spec-preview/ui-cache/ui-cache.json` exists, run
`node <spec-preview skill>/assets/ui-scan.mjs check --project <root>`:

- `fresh` → take `tokens.cssVars` / `tokens.colors` / `tokens.fonts` / `components` /
  `project.framework` / `project.lang` / `project.targetSurface` / `aiNotes` directly
  from the manifest as design-system evidence. Skip the "Design system" and "Language"
  bullets below; do the remaining repo scan only for what the cache does not cover
  (routes/screens, assets, page-specific structure).
- `stale` / `missing` → run `scan` there once (it is framework-agnostic: Web CSS /
  Tailwind / JS·TS theme / Flutter Dart / Android / iOS), then use the refreshed cache
  the same way. This keeps both skills on one shared, cached token source instead of
  re-deriving tokens per artifact.

Read project instructions first (`AGENTS.md`, `CLAUDE.md`, local README sections). Then gather
only the relevant source evidence:

- **Stack and commands:** package manager, framework, app/router structure, dev/build scripts.
- **Routes/screens:** route files, page components, layout wrappers, state providers, app shell.
- **UI components:** imported component library, local primitives, shared layouts, icon system.
- **Design system:** global CSS, CSS variables, Tailwind/theme config, shadcn tokens, typography,
  spacing, radius, shadows, motion, dark mode.
- **Assets:** `public/`, local fonts, inline SVGs, images/videos used by the target screen.
- **Language:** product UI language from source strings, i18n files, or route content.

First detect the framework and follow its scan playbook in
`reference/09-framework-scan-playbooks.md`. The playbook gives the shortest route from a URL or
component name to the files that actually shape the UI. Use the generic searches below only
after the framework-specific route/component/token path is unclear.

Prefer `rg --files` and targeted `rg` searches. Useful searches include:

```bash
rg --files | rg '(AGENTS|CLAUDE|README|package.json|app/|pages/|src/|components/|styles/|public/|tailwind|components.json)'
rg -n "(:root|--[a-z0-9-]+:|font-family|border-radius|box-shadow|theme|className=|data-theme|next/font|use client)" .
```

For Next.js projects, obey project instructions about reading the relevant local
`node_modules/next/dist/docs/` guide before writing or changing Next code. Generating a
separate HTML artifact usually does not require changing app code, but the scan should still
respect project-specific instructions and commands.

## 3. Running-App Scan

When feasible, start or reuse the dev server, open the requested route, and collect evidence at
desktop, tablet, and mobile widths. Default viewports:

- desktop: 1440px wide
- tablet: 768px wide
- mobile: 390px wide

Use browser automation if available. Collect:

- Full-page screenshots and target element screenshots.
- Accessibility/ARIA structure for the page or target region.
- Real visible text, alt text, aria labels, placeholder text, and badge/chip labels.
- DOM topology: page sections, fixed/sticky overlays, z-index layers, scroll containers.
- Computed styles for representative containers, headings, body text, buttons, inputs, cards,
  nav items, charts, and device frames.
- Asset usage: `<img>`, `<video>`, inline `<svg>`, CSS `background-image`, layered/absolute
  overlays, local fonts.

Use resolved styles rather than estimates. `getComputedStyle()` is the default browser API for
resolved values; Chrome DevTools Protocol CSS methods can provide deeper matched/computed style
and stylesheet evidence when available.

## 4. State And Behavior Sweep

Do not treat a screenshot as the whole UI. For the requested route/region:

1. **Scroll first.** Slowly scroll from top to bottom before clicking anything. Record header
   changes, reveal animations, sticky panels, scroll-snap, parallax, progress indicators, and
   scroll-driven active states.
2. **Click sweep.** Click tabs, pills, menus, accordions, dialogs, cards, and button-like controls.
   For each state, record the content, selected item, changed styles, and transition.
3. **Hover/focus sweep.** Check buttons, links, cards, nav items, images, rows, and controls.
   Record before/after styles and transition timing.
4. **Resize sweep.** Compare desktop/tablet/mobile layouts and note approximate breakpoints.
5. **Time sweep.** Observe carousels, loaders, animated counters, videos, or delayed entrances.

Always identify the interaction model before rendering: static, click-driven, scroll-driven,
hover/focus-driven, time-driven, or mixed. Scroll-driven UI must not be represented as
click-only tabs unless the artifact is intentionally simplifying and says so.

## 5. Compact Extraction Snippets

Run snippets in the browser console, Playwright, or another browser automation evaluator.
Adjust selectors to the target region.

```javascript
// Asset and font inventory
JSON.stringify({
  images: [...document.images].map(img => ({
    src: img.currentSrc || img.src,
    alt: img.alt,
    width: img.naturalWidth,
    height: img.naturalHeight,
    parent: img.parentElement?.className?.toString()
  })),
  videos: [...document.querySelectorAll('video')].map(v => ({
    src: v.currentSrc || v.src || v.querySelector('source')?.src,
    poster: v.poster,
    autoplay: v.autoplay,
    loop: v.loop,
    muted: v.muted
  })),
  backgrounds: [...document.querySelectorAll('*')]
    .map(el => ({ el, bg: getComputedStyle(el).backgroundImage }))
    .filter(x => x.bg && x.bg !== 'none')
    .map(x => ({
      tag: x.el.tagName.toLowerCase(),
      className: x.el.className?.toString(),
      backgroundImage: x.bg
    })),
  fonts: [...new Set([...document.querySelectorAll('body *')]
    .slice(0, 300)
    .map(el => getComputedStyle(el).fontFamily))]
}, null, 2);
```

```javascript
// DOM + computed-style tree for a target region
(function(selector) {
  const root = document.querySelector(selector);
  if (!root) return JSON.stringify({ error: 'not found', selector }, null, 2);
  const props = [
    'display','position','zIndex','inset','top','right','bottom','left',
    'width','height','maxWidth','minWidth','padding','margin','gap',
    'gridTemplateColumns','flexDirection','justifyContent','alignItems',
    'fontFamily','fontSize','fontWeight','lineHeight','letterSpacing',
    'color','background','backgroundColor','border','borderRadius','boxShadow',
    'opacity','transform','transition','overflow','objectFit','filter','backdropFilter'
  ];
  function styles(el) {
    const cs = getComputedStyle(el);
    return Object.fromEntries(props
      .map(p => [p, cs[p]])
      .filter(([, v]) => v && !['none', 'normal', 'auto', '0px', 'rgba(0, 0, 0, 0)'].includes(v)));
  }
  function walk(el, depth = 0) {
    if (depth > 4) return null;
    const children = [...el.children].slice(0, 24).map(c => walk(c, depth + 1)).filter(Boolean);
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      className: el.className?.toString().split(/\s+/).slice(0, 8).join(' ') || undefined,
      text: children.length ? undefined : el.textContent?.trim().slice(0, 160) || undefined,
      styles: styles(el),
      children
    };
  }
  return JSON.stringify(walk(root), null, 2);
})('main');
```

For stateful UI, capture the same selector before and after the trigger, then diff the JSON.

## 6. Map Evidence To The Artifact

Use the scan to constrain generation:

- **Structure:** choose html-artifacts modules that match the real page topology; preserve order,
  grouping, fixed/sticky elements, and target surface.
- **Tokens:** map real colors, typography, radius, spacing, borders, shadows, and density to
  semantic variables. If no built-in theme matches, choose the closest one and add semantic
  inline overrides on `<html>`.
- **Assets:** inline critical local SVGs directly; embed required local images/fonts as data URLs
  when they are necessary for fidelity. Do not emit `/public/...` paths, CDN links, or remote font
  links in the final file.
- **Content:** copy visible project text verbatim when the user asks for an as-is representation.
  Localize only builder-owned labels, not existing product copy.
- **Behavior:** wire visible controls with existing `interactions.js` data attributes or scoped
  inline JS. If a copied affordance is illustrative only, render it as non-interactive markup.
- **Responsive:** encode the observed mobile/tablet/desktop behavior. A `mobile-app` target must
  start phone/app-shaped; a `web-app` target should be browser/dashboard-shaped.

## 7. Evidence Notes

Temporary evidence may be useful while working:

```text
$(mktemp -d)/        # session scratch, e.g. html-artifacts-scan-<slug>
  screenshots/
  styles.json
  structure.json
  behavior-notes.md
```

These files are working notes, not deliverables. Do not reference them as dependencies from the
HTML. In the final message, state the scan basis briefly: repo-only, screenshot-only, or
running-app scan with viewports.

## 8. Stop Conditions

- If the dev server cannot start, continue with a repo-only scan and say so.
- If auth or unavailable data hides the requested UI, ask for access/context only when no
  reasonable static representation can be made.
- If the screenshot and repo disagree, prefer the user's latest visual evidence and mention the
  assumption.
- If exact font/image reuse would require external network access, use local assets or offline
  fallbacks and state the limitation.

## 9. Pre-Assembly Checklist

Before assembling an as-is/current-UI artifact, verify:

- [ ] The request actually needs current UI fidelity; otherwise skip scan mode.
- [ ] Project instructions and relevant source files were read.
- [ ] At least one evidence source backs every major visual decision.
- [ ] Colors, typography, spacing, and radius come from project tokens or computed styles.
- [ ] All copied text/content is real project content unless explicitly marked as placeholder.
- [ ] Interaction model is identified before controls are rendered.
- [ ] Scroll/click/hover/focus/time states are represented or deliberately omitted with a note.
- [ ] Desktop/tablet/mobile behavior was checked or a limitation is stated.
- [ ] Final HTML is still self-contained: no external URLs, no local file dependencies, no CDN.
