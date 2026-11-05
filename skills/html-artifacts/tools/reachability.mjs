#!/usr/bin/env node
/* ============================================================================
   html-artifacts · module reachability gate
   ----------------------------------------------------------------------------
   Registering a module in components.json makes it EXIST. It does not make it
   FINDABLE. The failure this guards against is silent: an agent runs
   `index.mjs --find "<what the user asked>"`, a weaker near-synonym ranks first,
   the agent takes it, and the artifact is worse for a reason no diff will show.
   (Real case: "시스템 아키텍처 다이어그램" and "システムアーキテクチャ図" both
   returned the lightweight `arch-diagram` above `arch-explorer`.)

   Every module's own declared intent phrases (EN/KO/JA) are replayed as queries
   through the SAME scoring `--find` uses, so this measures the retrieval path
   agents actually walk rather than a parallel one.

   Three checks, in order of severity:

     1. OWNERSHIP  - every module must win rank 1 on at least one of its own
        phrases. A module that owns nothing is unreachable in practice: there is
        no query the agent can type that lands on it first.

     2. VISIBILITY - no phrase may push its claimant below rank 3. Below that an
        agent scanning the top hits never sees it.

     3. ROUTED COLLISIONS - when module A loses its own phrase to module B, A and
        B must be linked (A.avoidWhen→B, A.relatedTo→B, or B.relatedTo→A). Two
        modules legitimately share vocabulary (`tree` vs `file-tree`); that is
        fine as long as the catalog SAYS which to prefer and when. An unlinked
        collision is silent misdirection - the case this gate exists for.

   USAGE:  node tools/reachability.mjs             # gate: exit 1 on any failure
           node tools/reachability.mjs --verbose   # list every finding
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..');
const components = JSON.parse(fs.readFileSync(path.join(ROOT, 'index/components.json'), 'utf8')).components;
const VERBOSE = process.argv.includes('--verbose');

import { scoreAll, indexOf as buildIndex } from './lib/search.mjs';

const IDX = buildIndex(components);
function rank(query) { return scoreAll(IDX, query).map((x) => ({ id: x.c.id, score: x.score })); }

const byId = new Map(components.map((c) => [c.id, c]));


const linked = (aId, bId) => {
  const a = byId.get(aId), b = byId.get(bId);
  if (!a || !b) return false;
  const rel = (c) => [...((c.relatedTo || []).map((r) => r.id)), ...((c.avoidWhen || []).map((r) => r.use))];
  return rel(a).includes(bId) || rel(b).includes(aId);
};

let checked = 0;
const noIntent = [], owns = new Map(), buried = [], unrouted = [], routed = [];

for (const c of components) {
  const phrases = [...((c.intent && c.intent.en) || []), ...((c.intent && c.intent.ko) || []), ...((c.intent && c.intent.ja) || [])];
  if (!phrases.length) { noIntent.push(c.id); continue; }
  owns.set(c.id, 0);
  for (const p of phrases) {
    checked++;
    const r = rank(p);
    const at = r.findIndex((x) => x.id === c.id);
    if (at === 0) { owns.set(c.id, owns.get(c.id) + 1); continue; }
    const winner = r[0] ? r[0].id : '(none)';
    const rec = { id: c.id, phrase: p, at: at < 0 ? null : at + 1, winner };
    if (at < 0 || at > 2) buried.push(rec);
    else (linked(c.id, winner) ? routed : unrouted).push(rec);
  }
}

const orphans = [...owns.entries()].filter(([, n]) => n === 0).map(([id]) => id);

console.log(`reachability: ${components.length} modules · ${checked} intent phrases replayed through --find scoring\n`);
console.log(`  [1] ownership        ${components.length - orphans.length - noIntent.length}/${components.length} modules win rank 1 on at least one own phrase`);
console.log(`  [2] visibility       ${checked - buried.length}/${checked} phrases keep their claimant in the top 3`);
console.log(`  [3] routed overlaps  ${routed.length} documented · ${unrouted.length} UNROUTED`);
if (noIntent.length) console.log(`\n  ${noIntent.length} module(s) declare no intent phrases: ${noIntent.join(', ')}`);

const show = (title, list, hint) => {
  if (!list.length) return;
  console.log(`\n${title}`);
  if (hint) console.log(`  ${hint}`);
  for (const m of list) console.log(`  ${m.id}  ←  "${m.phrase}"   rank ${m.at == null ? 'unranked' : m.at}, top: ${m.winner}`);
};

if (VERBOSE || orphans.length) {
  if (orphans.length) {
    console.log(`\nORPHANS - own none of their phrases (unreachable):`);
    orphans.forEach((id) => console.log(`  ${id}`));
  }
}
if (VERBOSE) {
  show('BURIED - claimant falls below rank 3:', buried, 'sharpen the module keywords/summary, or drop the phrase if another module truly owns it.');
  show('UNROUTED OVERLAPS - another module wins and the catalog does not say so:', unrouted,
    'add avoidWhen {if,use} on the loser or relatedTo on either side, so an agent that lands on the winner is told when to switch.');
  show('routed overlaps (documented, informational):', routed);
}

const fail = orphans.length || noIntent.length || buried.length || unrouted.length;
if (fail) {
  if (!VERBOSE) console.log('\nrun with --verbose to list each finding.');
  console.log('\nFAIL  some modules are not reliably selectable.');
  process.exit(1);
}
console.log('\nPASS  every module is owned, visible, and every overlap is documented.');
