#!/usr/bin/env node
/* ============================================================================
   html-artifacts · component index generator + sync validator
   ----------------------------------------------------------------------------
   The DISCOVERY layer. Reads the hand-authored rich metadata in
   `index/components.json` and:
     1. VALIDATES it against reality -
        • every templates/modules/<id>.html has an index entry (and vice versa)
        • every entry's builder `section` names a real renderer in tools/build.mjs
          (entries marked "(manual)" are exempt)
        • every relatedTo / avoidWhen.use id is a real component id
     2. GENERATES `index/COMPONENTS.md` - the compact, AI-/human-scannable index
        an agent reads to PICK modules by tag/intent WITHOUT opening each file.

   So the index never drifts: change a module → re-run this; CI can gate with
   `--check` (exit 1 on any mismatch). Deterministic (no Date / no Math.random).

   USAGE:
     node tools/index.mjs                       # validate + regenerate COMPONENTS.md + INDEX.md
     node tools/index.mjs --check               # validate only; exit 1 on drift (no write)
     node tools/index.mjs --find "<keywords>"   # search modules by keyword/tag/intent (top 5)
     node tools/index.mjs --details <id>...      # full contract for the chosen module ids
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { scoreAll, indexOf as buildIndex } from './lib/search.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..');
const MODS = path.join(ROOT, 'templates/modules');
const INDEX_DIR = path.join(ROOT, 'index');
const JSON_PATH = path.join(INDEX_DIR, 'components.json');
const MD_PATH = path.join(INDEX_DIR, 'COMPONENTS.md');
const read = (f) => fs.readFileSync(f, 'utf8');

const CHECK_ONLY = process.argv.includes('--check');
const errors = [], warns = [];

/* ---- load index ---- */
if (!fs.existsSync(JSON_PATH)) { console.error('FAIL: index/components.json not found'); process.exit(1); }
let idx;
try { idx = JSON.parse(read(JSON_PATH)); } catch (e) { console.error('FAIL: components.json is not valid JSON - ' + e.message); process.exit(1); }
const components = idx.components || [];
const byId = new Map(components.map((c) => [c.id, c]));

/* ============================================================================
   QUERY MODES (read-only) - the real "index-first" discovery path:
     node tools/index.mjs --find "<keywords>" [--top N]   search by keyword/tag/intent
     node tools/index.mjs --details <id> [<id>...]         full contract for chosen ids
   So an AI narrows with --find (cheap) then reads only the chosen entries with
   --details - instead of loading the whole 75KB COMPONENTS.md or every module file.
   ============================================================================ */
const ARGV = process.argv.slice(2);
const scopeTag = (c) => c && c.scope ? ` · ${c.scope}${c.scope === 'marketing' ? ' (optional, non-core)' : ''}` : '';
function fmtEntry(c) {
  const L = [];
  L.push(`\n● ${c.id}  (section: ${c.section})  [${c.family}${c.status ? ' · ' + c.status : ''}${scopeTag(c)}]`);
  L.push(`  ${c.summary}`);
  if (c.useWhen && c.useWhen.length) L.push(`  use when: ${c.useWhen.join('; ')}`);
  if (c.avoidWhen && c.avoidWhen.length) L.push(`  avoid when: ${c.avoidWhen.map((a) => `${a.if} → ${a.use}`).join('; ')}`);
  if (c.keywords && c.keywords.length) L.push(`  keywords: ${c.keywords.join(', ')}`);
  if (c.intent) L.push(`  intent: EN ${(c.intent.en || []).join(' / ')} | KO ${(c.intent.ko || []).join(' / ')} | JA ${(c.intent.ja || []).join(' / ')}`);
  if (c.inputShape) L.push(`  input: ${c.inputShape}`);
  if (c.variants && c.variants !== 'none') L.push(`  variants: ${c.variants}`);
  L.push(`  interaction: ${c.interaction}${(c.dataAttrs && c.dataAttrs.length) ? ` (${c.dataAttrs.join(', ')})` : ''}`);
  if (c.shapes && c.shapes.length) L.push(`  shapes: ${c.shapes.join(', ')}`);
  if (c.relatedTo && c.relatedTo.length) L.push(`  related: ${c.relatedTo.map((r) => `${r.id} (${r.why})`).join('; ')}`);
  if (c.a11y) L.push(`  a11y: ${c.a11y}`);
  return L.join('\n');
}
if (ARGV.includes('--find')) {
  const fi = ARGV.indexOf('--find');
  let top = 5; const q = [];
  for (let i = fi + 1; i < ARGV.length; i++) { const a = ARGV[i]; if (a === '--top') { top = parseInt(ARGV[++i], 10) || 5; continue; } if (a.startsWith('--')) continue; q.push(a); }
  const query = q.join(' ').trim();
  if (!query) { console.error('usage: node tools/index.mjs --find "<keywords>" [--top N]'); process.exit(2); }
  const idx = buildIndex(components);
  const scored = scoreAll(idx, query).slice(0, top);
  console.log(`find "${query}" → ${scored.length} match${scored.length === 1 ? '' : 'es'} of ${components.length} (top ${top})`);
  if (!scored.length) console.log('  (no match - try broader keywords; see index/INDEX.md)');
  scored.forEach((x, i) => console.log(`\n${i + 1}. ${x.c.id}  ·  section: ${x.c.section}  ·  score ${x.score}  [${x.hits.join(', ')}]${scopeTag(x.c)}\n   ${x.c.summary}`));
  if (scored.length) console.log(`\n→ full contract: node tools/index.mjs --details ${scored.slice(0, 3).map((x) => x.c.id).join(' ')}`);
  process.exit(0);
}
if (ARGV.includes('--details')) {
  const di = ARGV.indexOf('--details');
  const ids = []; for (let i = di + 1; i < ARGV.length; i++) { if (ARGV[i].startsWith('--')) break; ids.push(ARGV[i]); }
  if (!ids.length) { console.error('usage: node tools/index.mjs --details <moduleId> [<moduleId>...]'); process.exit(2); }
  ids.forEach((id) => { const c = byId.get(id); console.log(c ? fmtEntry(c) : `\n● ${id} - NOT FOUND (run: node tools/index.mjs --find "<keywords>")`); });
  process.exit(0);
}

/* ---- ground truth: module files + builder renderers ---- */
const moduleFiles = fs.readdirSync(MODS).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, ''));
const buildSrc = read(path.join(ROOT, 'tools/build.mjs'));
const renderers = new Set([...buildSrc.matchAll(/^R\.([a-zA-Z]+) =/gm)].map((m) => m[1]));

/* ---- 1. file <-> entry parity ---- */
const fileSet = new Set(moduleFiles);
moduleFiles.forEach((f) => { if (!byId.has(f)) errors.push(`module file "${f}.html" has NO index entry`); });
components.forEach((c) => { if (!fileSet.has(c.id)) errors.push(`index entry "${c.id}" has NO module file (templates/modules/${c.id}.html)`); });

/* ---- 1b. exactly one CSS block per module file - the builder and the hand-paste
   path both cut the module CSS out by its opening tag; a second occurrence (even in
   header prose) makes them cut the wrong span and silently drop rules ---- */
moduleFiles.forEach((f) => {
  const n = (read(path.join(MODS, `${f}.html`)).match(/<style data-module=/g) || []).length;
  if (n !== 1) errors.push(`module file "${f}.html" has ${n} "<style data-module=" occurrences (need exactly 1 - reword header prose)`);
});

/* ---- 2. builder section sanity ---- */
const KNOWN_NON_RENDER = new Set(['html']); // builder-only / passthrough
components.forEach((c) => {
  const sec = String(c.section || '');
  if (/manual/i.test(sec)) return;                 // hand-assembled module - no builder section to check
  const tok = (sec.match(/^[a-zA-Z]+/) || [])[0];
  if (!tok) { warns.push(`entry "${c.id}" has an unpar's-able section "${sec}"`); return; }
  if (!renderers.has(tok) && !KNOWN_NON_RENDER.has(tok)) errors.push(`entry "${c.id}" names builder section "${tok}" but tools/build.mjs has no R.${tok}`);
});

/* ---- 3. cross-reference ids ---- */
components.forEach((c) => {
  (c.relatedTo || []).forEach((r) => { if (r.id && !byId.has(r.id)) warns.push(`entry "${c.id}" relatedTo unknown id "${r.id}"`); });
  (c.avoidWhen || []).forEach((a) => { if (a.use && !byId.has(a.use)) warns.push(`entry "${c.id}" avoidWhen.use unknown id "${a.use}"`); });
});

/* ---- 4. required-field presence (lenient: warn) ---- */
const NEED = ['family', 'section', 'summary', 'useWhen', 'keywords', 'intent', 'inputShape', 'interaction', 'status'];
components.forEach((c) => { NEED.forEach((k) => { if (c[k] == null || (Array.isArray(c[k]) && !c[k].length)) warns.push(`entry "${c.id}" missing/empty "${k}"`); }); });

/* ============================ report ============================ */
const ok = errors.length === 0;
const famCount = new Set(components.map((c) => c.family)).size;
console.log(`${ok ? (warns.length ? `PASS (${warns.length} warnings)` : 'PASS') : 'FAIL'}  index: ${components.length} components, ${famCount} families, ${renderers.size} builder sections`);
errors.forEach((e) => console.log('  ✗ ' + e));
if (warns.length) console.log('  ' + warns.slice(0, 40).map((w) => '· ' + w).join('\n  '));

if (CHECK_ONLY) process.exit(ok ? 0 : 1);
if (!ok) { console.log('\nNOT regenerating COMPONENTS.md while errors exist (fix components.json first).'); process.exit(1); }

/* ============================ generate COMPONENTS.md ============================ */
const FAM_ORDER = ['charts', 'diagrams', 'interactive', 'document', 'content'];
const FAM_TITLE = {
  charts: 'charts - quantitative visualization',
  diagrams: 'diagrams - structure, relationships, screens',
  interactive: 'interactive - operable widgets',
  document: 'document - structural reading blocks',
  content: 'content - marketing / product blocks',
};
const list = (a) => (a && a.length ? a.join('; ') : '-');
const kw = (a) => (a && a.length ? a.join(', ') : '-');
const intent = (o) => o ? `EN: ${(o.en || []).join(' / ')} · KO: ${(o.ko || []).join(' / ')} · JA: ${(o.ja || []).join(' / ')}` : '-';
const avoid = (a) => (a && a.length ? a.map((x) => `if ${x.if} → \`${x.use}\``).join('; ') : '-');
const related = (a) => (a && a.length ? a.map((x) => `\`${x.id}\` (${x.why})`).join('; ') : '-');

let md = `# html-artifacts - Component Index

> **Generated by \`tools/index.mjs\` from \`index/components.json\` - do not hand-edit.**
> Re-run \`node tools/index.mjs\` after changing any module or its metadata.

## Discovery protocol (read this, not every module file)

When assembling an artifact, pick modules by scanning THIS index - match the user's
request against each component's **use when / keywords / intent (EN·KO·JA)**, then
confirm you have the data via **input**. Only AFTER choosing do you open
\`reference/04-module-catalog.md\` for the chosen module's full prop/CSS contract.
Do **not** read all module files up front.

- **section** - the \`tools/build.mjs\` JSON section \`type\` that renders it (\`(manual)\` = paste the module file by hand; see \`reference/06-usage-guide.md\`). Three builder-only sections have no module file: \`prose\` (Markdown body text - paragraphs, lists, tables, code), \`device\` (app-frame preview from raw HTML) and \`html\` (raw passthrough; \`module\`/\`cssModules\` pull in module CSS).
- **avoid when** - guard rails: when another module is the better pick.
- **input** - the minimal data the section needs; confirm you have it before choosing.
- Colors are always semantic tokens; SVG modules already carry \`role/aria\`; interactive ones auto-wire via \`interactions.js\` data-attributes (no custom JS).

**Totals:** ${components.length} components · ${famCount} families · ${renderers.size} builder section types.

`;

/* quick-lookup table */
const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|');
md += `## Quick lookup\n\n| id | family | section | summary |\n|---|---|---|---|\n`;
FAM_ORDER.forEach((fam) => {
  components.filter((c) => c.family === fam).forEach((c) => {
    md += `| \`${c.id}\` | ${c.family} | \`${cell(c.section)}\` | ${cell(c.summary)} |\n`;
  });
});
md += `\n`;

/* per-family detail */
FAM_ORDER.forEach((fam) => {
  const items = components.filter((c) => c.family === fam);
  if (!items.length) return;
  md += `## ${FAM_TITLE[fam] || fam}\n\n`;
  items.forEach((c) => {
    md += `### \`${c.id}\`${c.status === 'new' ? ' 🆕' : ''}${c.scope === 'marketing' ? ' · 🛍 marketing (optional, non-core)' : ''} - ${c.summary}\n`;
    md += `\`section: ${c.section}\` · \`interaction: ${c.interaction}\`${c.variants && c.variants !== 'none' ? ` · \`variants: ${c.variants}\`` : ''}\n\n`;
    md += `- **use when:** ${list(c.useWhen)}\n`;
    md += `- **avoid when:** ${avoid(c.avoidWhen)}\n`;
    md += `- **keywords:** ${kw(c.keywords)}\n`;
    md += `- **intent:** ${intent(c.intent)}\n`;
    md += `- **input:** \`${c.inputShape}\`\n`;
    if (c.shapes && c.shapes.length) md += `- **shapes:** ${c.shapes.join(', ')}\n`;
    md += `- **related:** ${related(c.relatedTo)}\n`;
    if (c.a11y) md += `- **a11y:** ${c.a11y}\n`;
    md += `\n`;
  });
});

fs.writeFileSync(MD_PATH, md.trimEnd() + '\n');
console.log(`wrote ${path.relative(ROOT, MD_PATH)} (${md.length} bytes)`);

/* ---- tiny summary tier (read FIRST; then --find / --details to drill in) ---- */
const MIN_PATH = path.join(INDEX_DIR, 'INDEX.md');
let mini = `# Component quick index (summary tier)\n\n> Smallest catalog - one line per module. **Pick a module by searching, not by reading everything:** \`node tools/index.mjs --find "<keywords>"\` → \`node tools/index.mjs --details <id>\`. Full prose index: \`COMPONENTS.md\`; full contracts: \`reference/04-module-catalog.md\`.\n>\n> ${components.length} modules · ${famCount} families · builder section in \`(…)\`; \`(manual)\` = paste the module file.\n`;
FAM_ORDER.forEach((fam) => {
  const items = components.filter((c) => c.family === fam);
  if (!items.length) return;
  mini += `\n## ${fam}\n`;
  items.forEach((c) => { mini += `- \`${c.id}\` (\`${c.section}\`)${c.scope === 'marketing' ? ' 🛍_optional_' : ''} - ${c.summary} _[${(c.keywords || []).slice(0, 5).join(', ')}]_\n`; });
});
fs.writeFileSync(MIN_PATH, mini);
console.log(`wrote ${path.relative(ROOT, MIN_PATH)} (${mini.length} bytes)`);
