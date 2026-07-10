# spec-preview — Turn Specs & UI Ideas into a Reviewable, Self-Contained HTML

A single-agent skill that renders a spec, a set of requirements, or a UI proposal into a
**self-contained HTML bundle** (a comparison `index` + full-screen views + shared CSS) and opens it
in the browser automatically — so a human can *see and decide*, not read prose and stall. It runs
entirely in the host agent's context; the only external dependency is `node` (for the optional UI
scan). For the skill definition (invocation summary and full workflow), see [SKILL.md](./SKILL.md).

## What it does

The deliverable's goal is **not "pretty HTML"** — it is "a human can look and decide immediately."
The skill always builds the artifact the same way, drops it in `.tmp/<slug>/`, and opens it so the
current state, the options, and the trade-offs are visible at a glance. It picks one of three modes:

| Mode | Use it when | What the `index` shows |
|---|---|---|
| **proposals** | There are several directions and a human should pick one | Each option compared, plus a recommendation; each option links to a full-screen view |
| **spec** | You want to survey features / requirements / screen flow / data on one page | A requirements dashboard, organized by section |
| **review** | You want to show the before / after and blast radius of a change | before / after side by side + affected scope |

It is **target-surface aware**: the browser is only the delivery container, so the preview's default
form follows the product's real surface — `mobile-app` / `tablet-app` / `web-app` / `desktop-app` /
`document` / `diagram`. For a Flutter / iOS / Android / React Native target it defaults to a
phone-first app-screen preview instead of a web hero/dashboard.

## Key features

- **UI cache (cost cut + faithful reproduction)** — `assets/ui-scan.mjs` scans the target project's
  UI assets (design tokens, components, UI-string SSOT) across frameworks (Web CSS / Tailwind /
  React / Next.js / React Native / Flutter / Android / iOS) and caches them under
  `<project>/.tmp/spec-preview/`. When the cache is **fresh**, the skill reuses `ui-cache.json` +
  `skin.css` and **skips re-scanning the source**; `skin.css` reproduces the original UI's look, so
  the reviewer immediately recognizes "this is my product."
- **Review checklist** — for new/changed UI it embeds an optimized checklist of **5–12** items (not a
  kitchen-sink list) chosen to match the kind of change, with OK / needs-fix toggles and progress
  saved to `localStorage`. Required in `review` mode.
- **Language-aware** — Korean/Japanese prompt phrasing feeds the `target` / `language` detection; UI
  labels follow the user/product language (e.g. Korean UI text by default on Trip Jarvis).

## When to use

Fires on requests like "show this UI as HTML", "mock it up", "show it as an improvement proposal",
"visualize the spec", "lay out the requirements", "compare a few options", "put before/after side by
side", "make it reviewable", or "put it in a form I can eyeball" — and their Japanese/Korean
equivalents. Also runs via `/spec-preview`. It is a mock/visualization tool, **not** the real
implementation — dummy data and light vanilla JS are enough.

## Usage

Invoke via the `spec-preview` trigger (optionally `/spec-preview <what to preview>`). The skill:

1. Picks the mode (proposals / spec / review), the target surface, viewport, and language.
2. Reads the actual code / requirements / change in scope (no guessing).
3. Checks the UI cache with `node assets/ui-scan.mjs check` — reuses it when fresh, otherwise scans
   and generates `skin.css`.
4. Writes a standalone bundle to `.tmp/<slug>/` (copies `shared.css` / `preview.js` / `skin.css`,
   fills the `index.template.html` / `view.template.html` placeholders per the mode's reference).
5. Opens `index.html` in the browser and asks — via `AskUserQuestion` — which option to adopt (or
   whether to proceed), handing that choice to the next action.

The mode-specific recipes live in [`references/`](./references) and **must be read before
generating**: `proposals.md`, `spec.md`, `review.md`, `target-surface.md` (target / viewport / lang
detection), `assets-contract.md` (template placeholders + ja/ko/en label glossary), `ui-cache.md`
(scan / freshness / `skin.css`), and `review-checklist.md` (picking the human review items).

## Requirements

`node` (for `assets/ui-scan.mjs`, the framework-agnostic UI scan). No external LLM CLIs, no API
keys, no setup. Everything else runs inside the host agent, and the generated bundle is fully
standalone — double-click `index.html` (`file://`) and it opens, no CDN required.

## References & Attribution

This skill is an original implementation. Its shape traces back to a three-option UI-improvement
comparison first built for the *slide-studio* project (that temporary artifact no longer exists); the
structure and conventions were folded into the `assets/` templates and `references/proposals.md`, so
there is no external directory to hunt for.

## License

Released under the MIT License — © 2026 buddypia. See [LICENSE](./LICENSE).

## Disclaimer

`spec-preview` produces a mock/visualization for human review, not a finished implementation. Treat
its screens, dummy data, and any inferred current-state analysis as a draft to confirm — the point is
to help a human decide, so always review the artifact in the browser before acting on it.
