/* ============================================================================
   html-artifacts · shared retrieval scoring
   ----------------------------------------------------------------------------
   Single source of truth for how `index.mjs --find` ranks modules, so the
   reachability gate measures the real retrieval path instead of a copy that can
   drift away from it.

   Two properties matter more than cleverness here:

   1. WHOLE-TOKEN MATCHING for latin terms. Naive `field.includes(term)` let
      "top" score against "topology" and "cat" against "catalog", so a query like
      "show our key metrics at the top" ranked `sankey` above `kpi-grid`. Latin
      terms now match whole tokens (with a prefix allowance from 4 chars, so
      "diagram" still finds "diagrams").

   2. STOPWORDS CARRY NO SIGNAL. Every module summary contains "show", "the",
      "a"; scoring them rewards long entries rather than relevant ones. They are
      dropped from the query - unless the query is nothing but stopwords, in
      which case we keep them rather than return nothing.

   CJK has no word boundaries, so CJK terms keep substring matching; a 1-char CJK
   term is dropped because a single kanji matches almost everything.
   ============================================================================ */

export const WEIGHTS = { id: 5, keywords: 3, intent: 3, useWhen: 2, summary: 2, section: 2, shapes: 1, family: 1 };

const STOP = new Set([
  'a', 'an', 'the', 'of', 'for', 'with', 'to', 'in', 'on', 'at', 'as', 'by', 'and', 'or',
  'this', 'that', 'these', 'those', 'our', 'my', 'their', 'its', 'it', 'is', 'are', 'be',
  'make', 'made', 'making', 'show', 'shows', 'showing', 'display', 'lay', 'out', 'put',
  'give', 'get', 'want', 'need', 'please', 'like', 'me', 'us', 'we', 'you', 'i',
  'into', 'from', 'over', 'up', 'down', 'each', 'all', 'some', 'both', 'here', 'there',
  'how', 'what', 'when', 'where', 'which', 'who', 'do', 'does', 'can', 'should', 'would',
  'let', 'have', 'has', 'was', 'were', 'been', 'so', 'than', 'then', 'them', 'they',
  // JA/KO particles and light verbs that appear in nearly every entry
  'して', 'する', 'した', 'の', 'を', 'に', 'は', 'が', 'で', 'と', 'も', 'から', 'まで',
  '해줘', '보여줘', '만들어줘', '정리해줘', '해', '좀',
]);

const CJK = /[぀-ヿ㐀-䶿一-鿿가-힯]/;
const isCjk = (s) => CJK.test(s);

/* Japanese and Korean are written without spaces, so splitting a query on whitespace
   leaves the whole phrase as ONE term and substring matching then finds nothing:
   "システム構成を図解して" matched no module at all, and "장애가 나면 어떻게 되는지"
   landed on `cohort-grid`. Without a morphological analyser (and we ship no
   dependencies) the standard remedy is character n-grams: decompose a long CJK run
   into overlapping 2-grams and let IDF discount the ubiquitous ones ("して", "する",
   "이터"). A short run is already gram-sized and is kept whole.

   Grams are RECALL, not precision: a 2-gram like "이벤" or "動い" matches plenty of
   unrelated entries. So a gram carries a fraction of a real term's weight - it breaks
   ties and rescues a query that would otherwise return nothing, without letting
   accidental character overlap outrank a genuine phrase match. */
const CJK_RUN = /[぀-ヿ㐀-䶿一-鿿가-힯]{2,}/g;
const GRAM_WEIGHT = 0.3;
function cjkGrams(run) {
  if (run.length <= 3) return [{ t: run, w: 1 }];
  const out = [{ t: run, w: 1 }];          // the full run: an exact hit should still win
  for (let i = 0; i < run.length - 1; i++) out.push({ t: run.slice(i, i + 2), w: GRAM_WEIGHT });
  return out;
}

/** Split a query into weighted scoring terms: [{ t, w }]. */
export function terms(query) {
  const raw = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const out = [];
  for (const t of raw) {
    if (STOP.has(t)) continue;
    if (!isCjk(t)) { out.push({ t, w: 1 }); continue; }
    // Split into CJK runs and latin remainders, so "OSSの内部構造" yields both "oss"
    // and the grams of "内部構造".
    for (const lat of t.split(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]+/)) {
      if (lat.length > 1 && !STOP.has(lat)) out.push({ t: lat, w: 1 });
    }
    for (const run of t.match(CJK_RUN) || []) {
      if (STOP.has(run)) continue;
      for (const g of cjkGrams(run)) if (!STOP.has(g.t)) out.push(g);
    }
  }
  // Keep the highest weight seen for a term (a full run also emitted as a gram stays 1).
  const best = new Map();
  for (const { t, w } of out) if (!best.has(t) || best.get(t) < w) best.set(t, w);
  const kept = [...best].map(([t, w]) => ({ t, w }));
  // A query made entirely of stopwords is still a query; score it rather than
  // silently returning nothing.
  return kept.length ? kept : raw.map((t) => ({ t, w: 1 }));
}

export const fieldsOf = (c) => ({
  id: c.id || '', section: String(c.section || ''), family: c.family || '',
  keywords: (c.keywords || []).join(' '),
  intent: [
    ...((c.intent && c.intent.en) || []),
    ...((c.intent && c.intent.ko) || []),
    ...((c.intent && c.intent.ja) || []),
  ].join(' '),
  useWhen: (c.useWhen || []).join(' '),
  summary: c.summary || '',
  shapes: (c.shapes || []).join(' '),
});

/** Pre-tokenize once; callers score many queries against the same corpus. */
export function indexOf(components) {
  const docs = components.map((c) => {
    const f = fieldsOf(c);
    const prepared = {};
    for (const k of Object.keys(WEIGHTS)) {
      const text = String(f[k]).toLowerCase();
      prepared[k] = { text, tokens: new Set(text.split(/[^\p{L}\p{N}]+/u).filter(Boolean)) };
    }
    return { c, prepared };
  });
  docs.N = docs.length;
  docs.df = new Map();      // memoized document frequency, filled lazily per term
  return docs;
}

/* How many modules a term touches at all. "diagram" hits most of the diagram
   family, "sankey" hits one. Without this correction the +5 `id` bonus made every
   "... diagram" query resolve to whichever module happens to have "diagram" in its
   id (`arch-diagram` beat `arch-explorer` on "draw our system architecture
   diagram", and `deployment-topology` lost "infrastructure diagram" outright). */
function df(idx, term) {
  if (idx.df.has(term)) return idx.df.get(term);
  let n = 0;
  for (const { prepared } of idx) {
    for (const k of Object.keys(WEIGHTS)) if (fieldHit(prepared[k], term)) { n++; break; }
  }
  idx.df.set(term, n);
  return n;
}

/** Rarity multiplier in ~[0.05, 1]: a term matching everything carries no signal. */
function idf(idx, term) {
  const n = df(idx, term);
  if (!n) return 1;
  const raw = Math.log(idx.N / n) / Math.log(idx.N);   // 1 for unique, 0 for universal
  return Math.max(0.05, raw);
}

function fieldHit(field, term) {
  if (isCjk(term)) return field.text.includes(term);       // no word boundaries in CJK
  if (field.tokens.has(term)) return true;                  // whole token
  if (term.length >= 4) {
    for (const tok of field.tokens) {
      // "diagram" should find "diagrams", and "diagrams" should find "diagram" -
      // but BOTH sides must be long enough. Without the length floor on `tok`, the
      // ubiquitous token "in" matched the query "infrastructure", which is how
      // df("infrastructure") came out as 41 of 117 modules.
      if (tok.startsWith(term)) return true;
      if (tok.length >= 4 && term.startsWith(tok)) return true;
    }
  }
  return false;
}

/** Score every component against a query. Returns [{ c, score, hits }] desc, score>0 only. */
export function scoreAll(idx, query) {
  const ts = terms(query);
  const out = [];
  const w = ts.map((x) => idf(idx, x.t) * x.w);
  for (const { c, prepared } of idx) {
    let score = 0; const hits = new Set();
    ts.forEach((x, i) => {
      for (const k of Object.keys(WEIGHTS)) {
        if (fieldHit(prepared[k], x.t)) { score += WEIGHTS[k] * w[i]; hits.add(k); }
      }
    });
    if (score > 0) out.push({ c, score: Math.round(score * 10) / 10, hits: [...hits] });
  }
  // Stable tie-break: a shorter id is the more general/likely-intended module.
  return out.sort((a, b) => b.score - a.score || a.c.id.length - b.c.id.length || a.c.id.localeCompare(b.c.id));
}
