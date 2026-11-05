#!/usr/bin/env node
/* html-artifacts · static validator (the deterministic gate)
   usage: node tools/validate.mjs <file.html>  ->  PASS/FAIL + issues, exit 0/1 */
import fs from 'node:fs';
import { parseThemeBlocks, auditTheme } from './contrast.mjs';
const f = process.argv[2];
if (!f) { console.error('usage: node tools/validate.mjs <file.html>'); process.exit(2); }
const s = fs.readFileSync(f, 'utf8');
const issues = [], warns = [];

// 1. no external dependencies
//    (an outbound <a href="https://…"> is navigation, not a dependency - allowed)
if ([...s.matchAll(/\bsrc\s*=\s*"https?:\/\//gi)].length) issues.push('external src URL present');
if ([...s.matchAll(/<(?!a\b)[a-z][\w-]*\b[^>]*\bhref\s*=\s*"https?:\/\//gi)].length) issues.push('external href on a non-<a> element (loads a resource)');
if ([...s.matchAll(/url\(\s*['"]?https?:\/\//gi)].length) issues.push('external url() present');
if (/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*"(?!#)[^"]*\/\//i.test(s)) issues.push('external <script>/<link> reference');

// 2. no leftover template placeholders
const vars = [...s.matchAll(/\{\{[^}]+\}\}/g)];
if (vars.length) issues.push(`leftover {{ }} placeholders: ${vars.length} (e.g. ${vars[0][0]})`);

// 2b. embedded module <style> integrity - header-comment prose or a nested/duplicated
//     <style> tag inside a data-module block makes the CSS parser silently drop the
//     FIRST rule (usually the base rule defining --<prefix>-* vars), collapsing grids
//     while the page still builds. The markers below are structural: none can occur
//     in legitimate module CSS (retro-2026-07-09-embedded-style-corruption).
for (const m of s.matchAll(/<style\s+data-module="([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/style>/g)) {
  const bad = m[2].match(/<style|-->|\bINTERACTION:|\bUSAGE:|\bVARIABLES:|\bMODULE:|={4,}/);
  if (bad) issues.push(`corrupted module style "${m[1]}": stray "${bad[0]}" inside <style> - header-comment prose or duplicated tag; the first CSS rule is silently dropped`);
}

// 3. document structure
['<!DOCTYPE html>', '<title>', 'charset', 'viewport'].forEach((t) => { if (!s.includes(t)) issues.push('missing ' + t); });
if (!/<html[^>]*\slang=/.test(s)) issues.push('missing <html lang>');
if (!/<html[^>]*\sdata-target=/.test(s)) warns.push('missing data-target (target-aware artifacts should declare surface)');
if (!/<html[^>]*\sdata-viewport=/.test(s)) warns.push('missing data-viewport (target-aware artifacts should declare viewport)');
if (!/<html[^>]*\sdata-layout=/.test(s)) warns.push('missing data-layout (builder always emits the layout axis)');
if (!/<html[^>]*\sdata-density=/.test(s)) warns.push('missing data-density (builder always emits the density axis)');

// 3b. target surface checks
const htmlTag = (s.match(/<html\b[^>]*>/i) || [''])[0];
const target = (htmlTag.match(/\bdata-target="([^"]+)"/i) || [])[1] || '';
const viewport = (htmlTag.match(/\bdata-viewport="([^"]+)"/i) || [])[1] || '';

// 3c. (warn) default-sandwich heuristic: birchline + stack + standard-only
//     header on a multi-section page - the exact silhouette the layout/header
//     axes exist to avoid. Warning only; never flips PASS to FAIL.
const dsTheme = (htmlTag.match(/\bdata-theme="([^"]+)"/i) || [])[1] || '';
const dsLayout = (htmlTag.match(/\bdata-layout="([^"]+)"/i) || [])[1] || '';
const dsSections = (s.match(/<!-- section/g) || []).length;
const dsHeaderVariant = /class="[^"]*\b(?:header-compact|header-banner|header-split|page-controls)\b/.test(s);
if (dsTheme === 'birchline' && dsLayout === 'stack' && !dsHeaderVariant && dsSections > 3) {
  warns.push('default-sandwich: default look - confirm this is intentional');
}
if (target === 'mobile-app') {
  if (viewport !== 'phone') issues.push('mobile-app target must default to data-viewport="phone"');
  if (!/(class="[^"]*\bha-device\b|data-device-frame|class="[^"]*\bdevice-frame\b)/.test(s)) {
    issues.push('mobile-app target requires a device/app frame (.ha-device, data-device-frame, or .device-frame)');
  }
}
if (target === 'tablet-app' && viewport !== 'tablet') {
  issues.push('tablet-app target must default to data-viewport="tablet"');
}

// 4. no protruding accent bar or AI-slop regressions (design-taste-frontend)
const barRects = [...s.matchAll(/<rect[^>]*class="(?:ng-bar|node-bar)"/g)].length;
const barHidden = /\.(?:ng-bar|node-bar)\s*\{[^}]*display:\s*none/.test(s);
if (barRects && !barHidden) issues.push(`protruding accent-bar rects: ${barRects} (AI slop)`);
if (/--grain-img:\s*url\([^)]*feTurbulence|body::after\s*\{[^}]*feTurbulence/i.test(s)) issues.push('SVG feTurbulence background noise grain present (AI slop)');
if (/writing-mode:\s*vertical-rl[^}]*transform:\s*rotate\(180deg\)/i.test(s)) {
  issues.push('vertical-rl combined with rotate(180deg) (renders CJK glyphs upside down)');
}
if (/\.(?:callout(?:-[a-z]+)?|card-accent|ktw|qb\.qb-accent)\s*\{[^}]*border-left:\s*[3-9]px\s+solid/i.test(s)) {
  issues.push('thick border-left rail on callout/card/takeaway/quote (AI slop - use 1px semantic border)');
}
// Punctuation is an editorial hint, not proof of slop. Preserve source quotations,
// code, names and ranges; legitimate typography must not fail an otherwise valid artifact.
const bodyOnly = s.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
const dashes = [...bodyOnly.matchAll(/[\u2014\u2013]/g)].length;
if (dashes) {
  warns.push(`em-dash / en-dash glyphs present in document content: ${dashes} (editorial review only; preserve source quotations, code, names and ranges)`);
}
// AI-slop tells: radial mesh glow in hero (Section 4.2 / 9.A)
if (/radial-gradient\([^)]*color-mix\([^)]*var\(--accent\)/i.test(s)) {
  warns.push('radial accent gradient detected in hero/surface (AI slop tell - prefer crisp solid surface per design-taste-frontend §4.2)');
}
// AI-slop tells: hero tagline / trust micro-strip inside hero (Section 4.7)
if (/<section class="hro"[^>]*>[\s\S]*?<p class="hro-trust"/i.test(s)) {
  warns.push('trust tagline found inside hero section (AI slop tell - move logo/trust wall to separate section under hero per §4.7)');
}
for (const m of s.matchAll(/<style\s+data-module="([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/style>/g)) {
  const cssNoComments = m[2].replace(/\/\*[\s\S]*?\*\//g, '');
  const hex = cssNoComments.match(/#[0-9a-fA-F]{3,8}\b/);
  if (hex) issues.push(`module style "${m[1]}" contains raw hex color ${hex[0]} (use semantic tokens / color-mix per rule S2)`);
}

// 5. interactions wired if a draggable/zoom diagram or SVG diagram node is present
if (/data-draggable/.test(s)) {
  if (!/function dragNode|HA\.dragNode/.test(s)) issues.push('data-draggable present but interactions.js dragNode not inlined');
  if (/\[data-zoompan\]/.test(s) && !/data-viewport/.test(s)) issues.push('data-zoompan without data-viewport');
}
if (/class="[^"]*\b(?:dg-node|archexp-node|node-card|sd-state|sw-node|oc-box|kt-box|actor-box|dt-box|c4-box|ng-node)\b/.test(s)) {
  if (!/HA\.fitSvgText/.test(s)) issues.push('SVG diagram nodes present but HA.fitSvgText not inlined');
}

// 5b. obvious dead controls in prototype/artifact mocks.
// Warn only: static validation cannot know every custom class-bound handler.
const noopAnchors = [...s.matchAll(/<a\b(?=[^>]*\bhref\s*=\s*"#")[^>]*>/gi)].length;
if (noopAnchors) warns.push(`no-op anchors href="#": ${noopAnchors}`);
const inertButtons = [...s.matchAll(/<button\b([^>]*)>/gi)].filter((m) => {
  const attrs = m[1] || '';
  return !/\b(?:data-[\w-]+|onclick|aria-controls|form=|type\s*=\s*"(?:submit|reset)")/i.test(attrs);
}).length;
if (inertButtons) {
  warns.push(`buttons without visible wiring: ${inertButtons} (add data-* interaction, onclick/custom JS hook, or render as non-button markup)`);
}

// 5c. (warn) native form controls without an accessible name. A raw <input>/<select>/
//     <textarea> with no aria-label/aria-labelledby, no id (a <label for> target), and no
//     title renders an unlabeled control. Warn only - a static check can't see a wrapping
//     <label> or a programmatic name; the builder's checklist/form sections always pair every
//     control with an explicit <label for>, so generated output never trips this.
const markup = s.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
const namelessControls = [...markup.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)].filter((m) => {
  const tag = m[1].toLowerCase(), attrs = m[2] || '';
  if (tag === 'input') {
    const type = (attrs.match(/\btype\s*=\s*"([^"]*)"/i) || [])[1] || 'text';
    if (/^(?:hidden|submit|button|reset|image)$/i.test(type)) return false;   // not user-named inputs
  }
  // Check if wrapped inside an implicit <label>...</label>
  const prefix = markup.slice(0, m.index);
  const lastOpenLabel = prefix.lastIndexOf('<label');
  const lastCloseLabel = prefix.lastIndexOf('</label>');
  if (lastOpenLabel > lastCloseLabel) return false;
  // (?:^|\s) - not \b - so `data-aria-label` / `data-id` do NOT count as a real accessible name
  return !/(?:^|\s)(?:aria-label|aria-labelledby|id|title)\s*=/i.test(attrs);
}).length;
if (namelessControls) {
  warns.push(`form controls without an accessible name: ${namelessControls} (add a <label for>, aria-label, or title)`);
}

// 6. (warn) svg a11y
[...s.matchAll(/<svg\b[^>]*>/gi)].forEach((m) => { if (!/role=|aria-label=|aria-hidden=/.test(m[0])) warns.push('svg without role/aria-label/aria-hidden'); });

// 7. (warn) WCAG AA contrast of the active theme's key token pairs - advisory only,
//    never flips PASS to FAIL (consciously a warning: themes carry intentional
//    aesthetic intent, and a static check cannot see runtime custom-accent overrides
//    beyond the inline one below - see reference/03 §contrast). Audit all themes with
//    `node tools/contrast-audit.mjs`.
try {
  const blocks = parseThemeBlocks(s);
  const active = (dsTheme && blocks[dsTheme]) ? { ...blocks[dsTheme] } : (blocks._root ? { ...blocks._root } : null);
  if (active) {
    const styleAttr = (htmlTag.match(/\bstyle="([^"]*)"/i) || [])[1] || '';
    const ca = (styleAttr.match(/--accent:\s*(#[0-9a-fA-F]{3,6})/) || [])[1];
    const coa = (styleAttr.match(/--on-accent:\s*(#[0-9a-fA-F]{3,6})/) || [])[1];
    if (ca) active['--accent'] = ca;
    if (coa) active['--on-accent'] = coa;
    auditTheme(active, blocks._root)
      .filter((r) => r.pass === false)
      .forEach((r) => warns.push(`low contrast ${r.ratio.toFixed(2)}:1 (< AA ${r.min}) - ${r.label}${ca ? ' [custom accent]' : ''}`));
  }
} catch { /* contrast check is best-effort; never blocks the gate */ }

const pass = issues.length === 0;
console.log(`${pass ? (warns.length ? `PASS (${warns.length} warnings)` : 'PASS') : 'FAIL'}  ${f.split('/').pop()}`);
issues.forEach((i) => console.log('  ✗ ' + i));
if (warns.length) console.log(`  (warnings: ${warns.length}× ${[...new Set(warns)].join('; ')})`);
process.exit(pass ? 0 : 1);
