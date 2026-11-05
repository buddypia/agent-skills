# 09 - Framework Scan Playbooks

> **Role of this document**: fast, evidence-first routes through common frontend project
> structures. Use after `08-project-scan.md` says a current/existing UI scan is required.
> The goal is to find the files that actually determine the requested screen, not to read the
> whole repo.

## 1. Scan Laws

Apply these in order:

1. **Classify first.** Identify framework/router, package manager, app root, and styling system
   before opening many files.
2. **Route first, then imports.** Start from the URL or named screen, find the route/page file,
   then follow local imports outward one to two hops. Do not start with global grep over every
   component.
3. **Shell before leaf.** Read app/root layouts, providers, navigation, and page shell before
   leaf cards/buttons; these usually define typography, background, spacing, and language.
4. **Tokens before CSS guesses.** Find design tokens/global CSS/theme config before interpreting
   utility classes or component styling.
5. **Assets by reference.** Only inventory assets referenced by the target route/import graph,
   plus global brand assets. Avoid scanning every image in `public/` unless the UI references it.
6. **Client boundary for behavior.** Interaction usually lives where React hooks/event handlers,
   `"use client"`, stores, or controller components appear. Scan those before API/backend files.
7. **Runtime confirms static evidence.** Use screenshots/computed styles to confirm the static
   map. If static and runtime evidence disagree, prefer the running app or latest screenshot.
8. **Stop when major visual decisions are evidenced.** You are done when structure, copy,
   tokens, key assets, states, and responsive rules all have a source.

## 2. Framework Detection

Run targeted file/package checks:

```bash
rg --files | rg '(^|/)(package.json|next.config|vite.config|astro.config|svelte.config|nuxt.config|angular.json|src|app|pages|components|styles|public)'
rg -n '"(next|vite|astro|@sveltejs/kit|nuxt|react|vue|tailwindcss|@tailwindcss/postcss)"' package.json
```

Detection hints:

| Evidence | Treat as |
| --- | --- |
| `next` dependency plus `app/` or `src/app/` | Next.js App Router |
| `next` dependency plus `pages/` or `src/pages/` | Next.js Pages Router |
| `vite` + React plugin or `src/main.tsx` | Vite React |
| `astro.config.*` + `src/pages` | Astro |
| `@sveltejs/kit` + `src/routes` | SvelteKit |
| `nuxt.config.*` + `pages/` or `app/` | Nuxt/Vue |

If both route systems exist, prefer the route that matches the requested URL in the running app.

## 3. Next.js App Router Playbook

Use when `package.json` has `next` and the repo has `app/` or `src/app/`.

### 3.1 Local docs rule

If changing Next.js code, first read the relevant local guide under
`node_modules/next/dist/docs/` because this version may differ from prior conventions. For scan
only, use local docs when route/CSS/font/image conventions are unclear. Useful docs:

- `01-app/01-getting-started/02-project-structure.md`
- `01-app/01-getting-started/03-layouts-and-pages.md`
- `01-app/01-getting-started/11-css.md`
- `01-app/01-getting-started/12-images.md`
- `01-app/01-getting-started/13-fonts.md`

### 3.2 Find the route file

Normalize the URL to route segments:

- `app/page.tsx` is `/`.
- `app/studio/page.tsx` is `/studio`.
- Route groups like `(marketing)` do not appear in the URL.
- Private folders like `_components` are not routable.
- Dynamic folders `[id]`, `[...slug]`, and `[[...slug]]` match URL params.
- Parallel route folders `@slot` are not URL segments but may add visible layout regions.
- API `route.ts` files are not page UI unless the page fetches from them.

Commands:

```bash
rg --files | rg '^(src/)?app/(.*)(page|layout|template|loading|error|not-found)\.(tsx|ts|jsx|js)$'
rg --files | rg '^(src/)?app/.*(\\[[^/]+\\]|\\([^/]+\\)|@[^/]+|_[^/]+)'
```

For a requested URL, open:

1. The matching `page.tsx`.
2. Every ancestor `layout.tsx`, starting at root `app/layout.tsx`.
3. Segment `template.tsx`, `loading.tsx`, `error.tsx`, and `not-found.tsx` only if visible in
   the requested state or likely to affect the screenshot.
4. Visible parallel route slots used by the nearest layout.

### 3.3 Follow the import graph

From the page and layouts, follow local imports only:

- Components under `components/`, `app/**/_components/`, `src/components/`, or aliased paths
  such as `@/components`.
- Utilities that return visible labels, theme classes, navigation items, menu definitions, or
  template/card data.
- Client components with `"use client"`, hooks, event handlers, stores, or animation code.

Stop after one to two local import hops unless the target component is still unresolved.
Avoid backend-only files until visible content depends on them.

### 3.4 Find styling and tokens

Open in this order:

1. Root layout import of global CSS, usually `app/globals.css` or `src/app/globals.css`.
2. Tailwind/PostCSS config and Tailwind v4 CSS imports if present (`@import "tailwindcss"`).
3. `components.json`, shadcn/ui primitives, or local design-system primitives.
4. `*.module.css` imported by the target page/components.
5. `DESIGN.md`, token JSON/CSS exports, or theme provider files when present.
6. Class composition helpers (`cn`, `cva`, variant maps) referenced by target components.

Search:

```bash
rg -n "import ['\\\"]\\.\\/globals\\.css|@import ['\\\"]tailwindcss|:root|--[a-z0-9-]+:|next/font|className=|cn\\(|cva\\(|data-theme|ThemeProvider" app src components styles . 2>/dev/null
rg --files | rg '(globals\\.css|\\.module\\.css|tailwind\\.config|postcss\\.config|components\\.json|DESIGN\\.md|theme|tokens)'
```

### 3.5 Fonts and images

For fonts:

- Check `next/font/google` and `next/font/local` imports in layouts/pages/components.
- If a font class is applied at `<html>` or `<body>`, treat it as global typography.
- In the final offline HTML, use a local/system fallback or embed a local font only when needed.

For images:

- Check `next/image` imports and `<Image src=...>` usage.
- `/foo.png` means `public/foo.png`.
- Static image imports may live next to page/component files.
- CSS `background-image` may hide important layered assets.
- Remote images must be downloaded/embedded or replaced with an explicit limitation note.

### 3.6 Running scan

Start with `package.json` scripts. Usually:

```bash
npm run dev
```

Open the matched route at desktop/tablet/mobile widths. Use the runtime to confirm:

- Which ancestor layout regions are visible.
- Whether server-rendered text differs from static source due to data fetches/actions.
- Computed spacing and colors after Tailwind/theme resolution.
- Client behavior from `"use client"` components.

## 4. Next.js Pages Router Playbook

Use when `package.json` has `next` and the repo has `pages/` or `src/pages/`.

Open in this order:

1. Matching page: `pages/index.tsx` for `/`, `pages/foo.tsx` or `pages/foo/index.tsx` for
   `/foo`, dynamic `[id].tsx` for param routes.
2. `pages/_app.tsx` for global wrappers, providers, and global CSS imports.
3. `pages/_document.tsx` for document-level classes, fonts, or body/html attributes.
4. Imported local components, then page-specific `*.module.css`.
5. `styles/globals.css`, Tailwind/PostCSS config, theme/tokens, `public/`.

Only inspect `pages/api/**` if the page content visibly depends on it.

## 5. Vite React Playbook

Use when `vite` is present and the app has React entry files.

Open in this order:

1. `src/main.tsx` / `src/main.jsx` for providers, router, global CSS.
2. Router definitions (`src/App.tsx`, `src/routes`, `react-router` config).
3. The component matched by the requested route or screen name.
4. Global CSS and tokens: `src/index.css`, `src/App.css`, Tailwind config, theme providers.
5. Local component imports and assets under `src/assets` or `public`.

Runtime route mapping often lives in code rather than folders, so search for route path strings:

```bash
rg -n "createBrowserRouter|Routes|Route|path:|to=|href=" src
```

## 6. Astro / SvelteKit / Nuxt Quick Paths

Use these only as routing shortcuts; still apply the scan laws.

| Framework | Route files | Shell/global UI | Styles/assets |
| --- | --- | --- | --- |
| Astro | `src/pages/**` | `src/layouts/**`, imported `.astro` components | `src/styles`, `public`, component CSS |
| SvelteKit | `src/routes/**/+page.svelte` | `+layout.svelte`, `+layout.ts`, hooks/stores | `src/app.css`, component `<style>`, `static` |
| Nuxt | `pages/**` or `app/pages/**` | `app.vue`, `layouts/**`, plugins | `assets`, `public`, `nuxt.config`, component styles |

## 7. Evidence Budget

For a single screen, aim for this minimum:

- 1 route/page file
- All ancestor shell/layout files
- 3 to 8 directly imported UI components
- 1 to 4 style/token files
- Referenced assets only
- Runtime screenshots at desktop and mobile, tablet when layout changes are likely

Escalate beyond this only when the requested screen remains visually unexplained.
