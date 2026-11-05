#!/usr/bin/env node
/* ============================================================================
   contrast-audit.mjs - WCAG AA contrast audit of all themes in themes.css.

   Usage:  node tools/contrast-audit.mjs            # audit every theme
           node tools/contrast-audit.mjs --json     # machine-readable
           node tools/contrast-audit.mjs <theme>    # one theme only

   Reports, per theme, the WCAG 2.x contrast ratio of the key semantic pairs
   (defined in contrast.mjs · AUDIT_PAIRS) against the AA bar appropriate to
   each pair's context (normal text 4.5:1 · large text / UI 3:1). This is the
   maintenance / measurement tool - it never edits anything. Exit code is 0
   even with failures (advisory), 1 only on a usage/read error.
   ============================================================================ */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseThemeBlocks, auditTheme } from './contrast.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = join(here, '..', 'templates', 'core', 'themes.css');

let css;
try { css = readFileSync(cssPath, 'utf8'); }
catch (e) { console.error('cannot read', cssPath, e.message); process.exit(1); }

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const only = args.find((a) => !a.startsWith('--'));

const blocks = parseThemeBlocks(css);
const root = blocks._root || {};
const themes = Object.keys(blocks).filter((t) => t !== '_root' && (!only || t === only));
if (only && !themes.length) { console.error('unknown theme:', only); process.exit(1); }

const results = {};
let totalFail = 0, totalUnresolved = 0;
for (const t of themes) {
  const rows = auditTheme(blocks[t], root);
  results[t] = rows;
  totalFail += rows.filter((r) => r.pass === false).length;
  totalUnresolved += rows.filter((r) => r.pass === null).length;
}

if (asJson) {
  console.log(JSON.stringify({ themes: results, totalFail, totalUnresolved }, null, 2));
  process.exit(0);
}

const f2 = (n) => (n == null ? '  -  ' : n.toFixed(2).padStart(5));
for (const t of themes) {
  console.log(`\n■ ${t}`);
  for (const r of results[t]) {
    const mark = r.pass === null ? '?' : r.pass ? '✓' : '✗';
    const need = `AA≥${r.min}`;
    const pair = `${r.fg}(${r.fgHex || '?'}) / ${r.bg}(${r.bgHex || '?'})`;
    console.log(`  ${mark} ${f2(r.ratio)}:1  ${need.padEnd(7)} ${r.label.padEnd(28)} ${pair}`);
  }
}
console.log(`\nSummary: ${themes.length} themes · ${totalFail} pair(s) below AA · ${totalUnresolved} unresolved`);
console.log('Note: advisory only. Text, including muted captions, requires 4.5:1; non-text UI pairs use 3:1 (WCAG §1.4.11).');
