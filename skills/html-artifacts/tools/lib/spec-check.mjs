/* html-artifacts · spec check (runs inside tools/build.mjs before rendering)
   ----------------------------------------------------------------------------
   The builder used to be lenient in ways that quietly broke "build what was asked":
   a misspelled section type rendered nothing, `layout:"grid"` silently became
   `stack`, a typo'd key (`seris`) was ignored, a decision row with one score too
   few produced NaN totals, and blueprint sample data (a fictional company) could
   ship inside a real deliverable. This module turns each of those into an
   explicit message:

     errors   → the build stops (exit 1) - the spec cannot produce what it claims
     warnings → printed, the build continues - likely a mistake, confirm it

   It also checks the optional requirement ledger (`brief.requirements` +
   per-section `covers`), which records claimed coverage. Rendering and behavior
   still need checking against the actual request.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';

const LOWER_IS_BETTER = /latency|churn|cost|spend|error|incident|defect|bug|bounce|delay|downtime|mttr|mttd|lead time|wait|p9\d|response time|cac\b|backlog|解約|離脱|遅延|レイテンシ|コスト|費用|エラー|障害|不具合|待ち|応答時間|所要時間|欠陥|返品|苦情|이탈|지연|비용|오류|장애|대기/i;
export const ENUMS = {
  theme: ['birchline', 'dark-focus', 'interactive-warm', 'minimal', 'midnight', 'slate', 'forest', 'rose', 'nord', 'sunset'],
  layout: ['stack', 'bento', 'sidebar', 'split'],
  header: ['standard', 'compact', 'banner', 'split', 'none'],
  density: ['comfortable', 'compact', 'spacious'],
  target: ['mobile-app', 'tablet-app', 'web-app', 'desktop-app', 'document', 'diagram'],
  viewport: ['phone', 'tablet', 'desktop'],
  nav: ['auto', 'rail', 'toc', 'none'],
};
const TOP_KEYS = new Set(['title', 'theme', 'layout', 'header', 'density', 'meta', 'lang', 'language', 'locale', 'target', 'surface',
  'viewport', 'defaultViewport', 'eyebrow', 'subtitle', 'footer', 'palette', 'sections', 'brief', 'covers', 'nav', 'navTitle']);
// keys every section may carry, whatever its type (layout, ledger, navigation)
const COMMON_KEYS = ['type', 'span', 'area', 'emphasis', 'id', 'covers', 'chapter', 'navTitle', 'title', 'module', 'cssModules'];
const REQUIRED = {
  kpi: ['items'], progress: ['items'], gauge: ['items'], radar: ['axes', 'series'], funnel: ['stages'],
  heatmap: ['rows', 'xLabels', 'yLabels'], table: ['columns', 'rows'], stepper: ['steps'], timeline: ['events'],
  comparison: ['options'], tabs: ['tabs'], screenflow: ['screens'], decision: ['options', 'criteria'], collapsible: ['items'],
  tree: ['nodes'], statlist: ['items'], features: ['items'], stattrend: ['items'], barstacked: ['categories', 'series'],
  areastacked: ['xLabels', 'series'], feed: ['items'], checklist: ['items'], form: ['fields'], bullet: ['rows'],
  calendar: ['weeks'], diagram: ['nodes'], archexplorer: ['nodes'], pipelineflow: ['stages'], servicecatalog: ['services'],
  requesttrace: ['hops'], eventcatalog: ['events'], deploymenttopology: ['regions'], failuremodes: ['rows'], prose: ['md'],
};
const NESTED = {
  kpi: { items: ['label', 'value', 'valueNum', 'prefix', 'suffix', 'delta', 'dir', 'tone', 'good', 'note'] },
  chart: { series: ['label', 'value', 'display', 'highlight', 'cat', 'key', 'values'], points: ['label', 'value', 'display'],
    segments: ['label', 'value', 'display', 'cat', 'key'], target: ['value', 'label', 'display'] },
  decision: { verdict: ['pick', 'rationale'], criteria: ['name', 'weight', 'scores', 'notes'] },
  comparison: { options: ['name', 'pros', 'cons', 'metrics', 'cta', 'href', 'recommended'] },
  timeline: { events: ['date', 'title', 'body', 'status'] },
  pipelineflow: { stages: ['num', 'name', 'proto', 'cards', 'emphasis'] },
};
const TEXT_REQUIRED = { html: ['html'], device: ['html'], empty: ['title'] };

/* Damerau-free Levenshtein, small strings only */
function dist(a, b) {
  const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
export function didYouMean(word, options) {
  const w = String(word).toLowerCase();
  let best = null, bd = Infinity;
  for (const o of options) {
    const k = dist(w, String(o).toLowerCase());
    if (k < bd || (k === bd && o.length < best.length)) { bd = k; best = o; }
    if (String(o).toLowerCase().startsWith(w) && w.length >= 3) return o;
  }
  return bd <= (w.length <= 4 ? 1 : Math.max(2, Math.floor(w.length / 3))) ? best : null;
}
const hint = (word, options) => { const s = didYouMean(word, options); return s ? ` - did you mean "${s}"?` : ` - valid: ${options.join(' / ')}`; };

/* keys each renderer reads, introspected from the builder source (`s.<key>` between
   `R.<type> =` and the next renderer) so the list can never drift from the code */
export function rendererKeys(buildSrc) {
  const re = /^R\.([a-z]+) = /gm; const pos = []; let m;
  while ((m = re.exec(buildSrc))) pos.push([m[1], m.index]);
  // top-level helpers handed the section (`axisFormat(items, s)`, `chartBar(s)`) read keys too
  const fnBody = {};
  const starts = [...buildSrc.matchAll(/^(?:function ([a-zA-Z_]\w*)\(|\S)/gm)];
  starts.forEach((x, k) => { if (x[1]) fnBody[x[1]] = buildSrc.slice(x.index, k + 1 < starts.length ? starts[k + 1].index : undefined); });
  const keysOf = (text, seen) => {
    const keys = new Set([...text.matchAll(/\bs\.([a-zA-Z_]+)/g)].map((x) => x[1]));
    for (const c of text.matchAll(/\b([a-zA-Z_]\w*)\((?:[^()]*,\s*)?s[,)]/g)) {
      if (fnBody[c[1]] && !seen.has(c[1])) { seen.add(c[1]); keysOf(fnBody[c[1]], seen).forEach((x) => keys.add(x)); }
    }
    return keys;
  };
  const out = {};
  pos.forEach(([name, at], k) => {
    const end = k + 1 < pos.length ? pos[k + 1][1] : buildSrc.indexOf('/* ===', at + 10);
    out[name] = keysOf(buildSrc.slice(at, end), new Set());
  });
  return out;
}

function strings(node, out = []) {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach((x) => strings(x, out));
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) if (!k.startsWith('_')) strings(v, out);
  return out;
}

/* blueprint sample markers: title / subtitle / footer / meta values of every blueprint
   (fictional companies, dates, owners) + any explicit `_recipe.sampleMarkers` */
function blueprintMarkers(root) {
  const dir = path.join(root, 'templates/blueprints');
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.spec.json'))) {
    try {
      const bp = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      // dates / periods ("2026-07-08", "2026年6月", "FY2026 Q1") recur across real documents - not evidence
      const DATEISH = /^[\s\dFYQH\-\/.:年月日期()（）〜~第四半]+$/;
      const marks = [bp.title, bp.subtitle, bp.footer, ...(bp.meta || []).map((m) => m && m.v), ...((bp._recipe && bp._recipe.sampleMarkers) || [])]
        .filter((x) => typeof x === 'string' && x.trim().length >= 6 && !DATEISH.test(x.trim()));
      out.push({ id: f.replace('.spec.json', ''), file: path.join(dir, f), marks });
    } catch { /* a broken blueprint is reported by its own build */ }
  }
  return out;
}

export function checkSpec(spec, { root, buildSrc, specPath, moduleIds }) {
  const errors = [], warns = [], notes = [];
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return { errors: ['spec must be a JSON object'], warns, notes };
  const keysByType = rendererKeys(buildSrc);
  const ALIASES = { 'arch-explorer': 'archexplorer', 'pipeline-flow': 'pipelineflow', 'service-catalog': 'servicecatalog', 'request-trace': 'requesttrace', 'event-catalog': 'eventcatalog', 'deployment-topology': 'deploymenttopology', 'failure-modes': 'failuremodes' };
  const types = [...Object.keys(keysByType), ...Object.keys(ALIASES)];
  // for the "valid:" list show each type once, in its documented spelling ("arch-explorer", not "archexplorer")
  const shownTypes = types.filter((t) => ALIASES[t] || !Object.values(ALIASES).includes(t));

  /* ---- top level ---- */
  for (const k of Object.keys(spec)) {
    if (k.startsWith('_') || k.startsWith('$') || TOP_KEYS.has(k)) continue;
    const s = didYouMean(k, [...TOP_KEYS]);
    warns.push(`unknown top-level key "${k}" is ignored${s ? ` - did you mean "${s}"?` : ''}`);
  }
  const enumKey = (key, val, list) => { if (val != null && !list.includes(val)) errors.push(`${key}: "${val}" is not valid${hint(val, list)}`); };
  enumKey('theme', spec.theme, ENUMS.theme);
  enumKey('layout', spec.layout, ENUMS.layout);
  enumKey('header', spec.header, ENUMS.header);
  enumKey('density', spec.density, ENUMS.density);
  enumKey('target', spec.target ?? spec.surface, ENUMS.target);
  enumKey('viewport', spec.viewport ?? spec.defaultViewport, ENUMS.viewport);
  if (spec.nav != null && typeof spec.nav !== 'boolean') enumKey('nav', spec.nav, ENUMS.nav);
  const lang = spec.lang || spec.language || spec.locale;
  if (lang != null && !['ko', 'ja', 'en'].includes(String(lang).slice(0, 2).toLowerCase())) warns.push(`lang: "${lang}" is not ko / ja / en - the language will be inferred from the text`);
  if (!spec.title) warns.push('no "title" - the page <title> and <h1> will be empty');
  if (spec.meta != null && (!Array.isArray(spec.meta) || spec.meta.some((m) => !m || m.k == null || m.v == null))) errors.push('meta must be an array of { "k": "…", "v": "…" }');
  if (spec.palette && !/^#[0-9a-fA-F]{3,8}$/.test(String(spec.palette.accent || ''))) errors.push('palette.accent must be a hex color like "#7C5CFF"');
  if (!Array.isArray(spec.sections) || !spec.sections.length) errors.push('"sections" must be a non-empty array');

  /* ---- sections ---- */
  const sections = Array.isArray(spec.sections) ? spec.sections : [];
  const ids = new Set();
  sections.forEach((s, i) => {
    const at = `section #${i + 1}${s && s.title ? ` "${String(s.title).slice(0, 24)}"` : ''}`;
    if (!s || typeof s !== 'object') { errors.push(`${at}: must be an object with a "type"`); return; }
    if (!s.type) { errors.push(`${at}: missing "type"${s.html ? ' (use "type": "html" for raw markup)' : ''}`); return; }
    let type = ALIASES[s.type] || s.type;
    if (!keysByType[type]) {
      if (moduleIds.includes(s.type) && s.html) { notes.push(`${at}: type "${s.type}" = manual module → html passthrough with its module CSS auto-injected`); type = 'html'; }
      else if (moduleIds.includes(s.type)) { errors.push(`${at}: "${s.type}" is a hand-pasted module, not a builder section - use { "type": "${s.type}", "html": "<filled markup from templates/modules/${s.type}.html>" }`); return; }
      else { const sug = didYouMean(s.type, types); errors.push(`${at}: unknown section type "${s.type}"${sug ? ` - did you mean "${sug}"?` : ` - valid: ${shownTypes.join(' / ')}`}`); return; }
    }
    if (s.id != null) {
      if (!/^[A-Za-z][\w-]*$/.test(String(s.id))) errors.push(`${at}: id "${s.id}" must start with a letter and use only letters, digits, - and _`);
      else if (ids.has(s.id)) errors.push(`${at}: duplicate id "${s.id}"`);
      ids.add(s.id);
    }
    if (s.span != null && !(Number.isInteger(+s.span) && +s.span >= 1 && +s.span <= 12)) errors.push(`${at}: span must be an integer 1–12 (got ${JSON.stringify(s.span)})`);
    if (s.area != null && !['main', 'side'].includes(s.area)) errors.push(`${at}: area "${s.area}"${hint(s.area, ['main', 'side'])}`);
    if (s.emphasis != null && !['hero', 'normal', 'quiet'].includes(s.emphasis)) errors.push(`${at}: emphasis "${s.emphasis}"${hint(s.emphasis, ['hero', 'normal', 'quiet'])}`);
    // required fields
    for (const k of REQUIRED[type] || []) {
      if (!Array.isArray(s[k]) || !s[k].length) {
        if (type === 'prose' && typeof s[k] === 'string' && s[k].trim()) continue;
        errors.push(`${at}: "${k}" is required and must be a non-empty ${type === 'prose' ? 'string' : 'array'} for type "${s.type}"`);
      }
    }
    for (const k of TEXT_REQUIRED[type] || []) if (typeof s[k] !== 'string' || !s[k].trim()) errors.push(`${at}: "${k}" is required for type "${s.type}"`);
    if (type === 'callout' && !s.title && !s.body) errors.push(`${at}: a callout needs "title" and/or "body"`);
    if (type === 'chart') {
      const v = s.variant || 'bar';
      if (!['bar', 'line', 'donut'].includes(v)) errors.push(`${at}: chart variant "${v}"${hint(v, ['bar', 'line', 'donut'])}`);
      const multiLine = v === 'line' && Array.isArray(s.series) && s.series.length && Array.isArray(s.series[0] && s.series[0].values);
      const key = v === 'line' ? 'points' : v === 'donut' ? 'segments' : 'series';
      if (multiLine) {
        const labels = s.labels || s.xLabels;
        if (!Array.isArray(labels) || !labels.length) errors.push(`${at}: a multi-series line chart needs "labels" (the x categories)`);
        s.series.forEach((se, j) => {
          if (!Array.isArray(se.values) || se.values.some((x) => !Number.isFinite(+x))) errors.push(`${at}: series[${j}].values must be an array of numbers`);
          else if (Array.isArray(labels) && se.values.length !== labels.length) errors.push(`${at}: series[${j}] "${se.label || ''}" has ${se.values.length} values for ${labels.length} labels`);
        });
      } else if (!Array.isArray(s[key]) || !s[key].length) errors.push(`${at}: a ${v} chart needs a non-empty "${key}" array${s.series && key !== 'series' ? ' (you passed "series" - for several lines give series[{label, values[]}] + labels[])' : s.points && key !== 'points' ? ' (you passed "points")' : ''}`);
      else s[key].forEach((d, j) => { if (!Number.isFinite(+(d && d.value))) errors.push(`${at}: ${key}[${j}].value must be a number (got ${JSON.stringify(d && d.value)})`); });
      if (s.size != null && !['sm', 'md', 'lg'].includes(s.size)) errors.push(`${at}: size "${s.size}"${hint(s.size, ['sm', 'md', 'lg'])}`);
    }
    if (type === 'kpi' && s.variant != null && !['cards', 'inline', 'hero'].includes(s.variant)) errors.push(`${at}: kpi variant "${s.variant}"${hint(s.variant, ['cards', 'inline', 'hero'])}`);
    // the delta colour defaults to up = good / down = bad; for lower-is-better metrics
    // that paints an improvement red (and a regression green) unless tone is given
    if (type === 'kpi' && Array.isArray(s.items)) s.items.forEach((it, j) => {
      if (!it || !it.delta || it.tone != null || it.good != null || it.dir === 'flat') return;
      if (LOWER_IS_BETTER.test(String(it.label || ''))) warns.push(`${at}: items[${j}] "${it.label}" looks lower-is-better - dir:"${it.dir || 'up'}" renders ${it.dir === 'down' ? 'red' : 'green'}; set tone:"good" | "bad" explicitly`);
    });
    if (type === 'decision' && Array.isArray(s.options) && Array.isArray(s.criteria)) {
      s.criteria.forEach((c, j) => {
        if (!Array.isArray(c.scores) || c.scores.length !== s.options.length) errors.push(`${at}: criteria[${j}] "${c.name}" has ${Array.isArray(c.scores) ? c.scores.length : 0} scores for ${s.options.length} options`);
        else if (c.scores.some((x) => !Number.isFinite(+x))) errors.push(`${at}: criteria[${j}] "${c.name}" has a non-numeric score`);
      });
      if (s.verdict && s.verdict.pick && !s.options.includes(s.verdict.pick)) errors.push(`${at}: verdict.pick "${s.verdict.pick}" is not one of the options${hint(s.verdict.pick, s.options)}`);
    }
    if (type === 'table' && Array.isArray(s.columns) && Array.isArray(s.rows)) {
      const bad = s.rows.findIndex((r) => !Array.isArray(r) || r.length !== s.columns.length);
      if (bad >= 0) warns.push(`${at}: rows[${bad}] has ${Array.isArray(s.rows[bad]) ? s.rows[bad].length : 'no'} cells for ${s.columns.length} columns`);
    }
    if ((type === 'diagram' || type === 'archexplorer') && Array.isArray(s.nodes)) {
      const nid = new Set(s.nodes.map((n) => n && n.id));
      (s.edges || []).forEach((e, j) => { ['from', 'to'].forEach((end) => { if (!nid.has(e[end])) errors.push(`${at}: edges[${j}].${end} "${e[end]}" is not a node id${hint(e[end], [...nid].filter(Boolean))}`); }); });
    }
    if (type === 'radar' && Array.isArray(s.axes)) (s.series || []).forEach((se, j) => { if ((se.values || []).length !== s.axes.length) warns.push(`${at}: series[${j}] has ${(se.values || []).length} values for ${s.axes.length} axes`); });
    if ((type === 'barstacked' || type === 'areastacked') && Array.isArray(s.series)) {
      const n = (type === 'barstacked' ? s.categories : s.xLabels || []).length;
      s.series.forEach((se, j) => { if ((se.values || []).length !== n) warns.push(`${at}: series[${j}] has ${(se.values || []).length} values for ${n} ${type === 'barstacked' ? 'categories' : 'xLabels'}`); });
    }
    if (type === 'heatmap' && Array.isArray(s.rows)) {
      if (Array.isArray(s.yLabels) && s.rows.length !== s.yLabels.length) warns.push(`${at}: ${s.rows.length} rows for ${s.yLabels.length} yLabels`);
      const bad = s.rows.findIndex((r) => (r || []).length !== (s.xLabels || []).length);
      if (bad >= 0) warns.push(`${at}: rows[${bad}] has ${(s.rows[bad] || []).length} cells for ${(s.xLabels || []).length} xLabels`);
    }
    // nested objects the renderers read field by field: an unread key is content that vanishes
    for (const [field, keys] of Object.entries(NESTED[type] || {})) {
      const v = s[field];
      const list = Array.isArray(v) ? v.map((x, j) => [x, `${field}[${j}]`]) : v && typeof v === 'object' ? [[v, field]] : [];
      list.forEach(([o, where]) => {
        if (!o || typeof o !== 'object' || Array.isArray(o)) return;
        for (const k of Object.keys(o)) {
          if (k.startsWith('_') || keys.includes(k)) continue;
          const sug = didYouMean(k, keys);
          warns.push(`${at}: ${where}.${k} is not read and is ignored${sug ? ` - did you mean "${sug}"?` : ''} (${field} reads: ${keys.join(', ')})`);
        }
      });
    }
    // unknown keys → probably a typo of a key the renderer reads
    const known = new Set([...COMMON_KEYS, ...(keysByType[type] || [])]);
    for (const k of Object.keys(s)) {
      if (k.startsWith('_') || known.has(k)) continue;
      const sug = didYouMean(k, [...known]);
      warns.push(`${at}: key "${k}" is not read by type "${s.type}" and is ignored${sug ? ` - did you mean "${sug}"?` : ''}`);
    }
  });

  /* ---- requirement ledger ---- */
  const brief = spec.brief;
  if (brief != null) {
    const reqs = Array.isArray(brief.requirements) ? brief.requirements : [];
    if (!Array.isArray(brief.requirements)) errors.push('brief.requirements must be an array of { "id", "text", "must"? }');
    const byId = new Map();
    reqs.forEach((r, j) => {
      if (!r || !r.id || !r.text) { errors.push(`brief.requirements[${j}] needs "id" and "text"`); return; }
      if (byId.has(r.id)) errors.push(`brief.requirements: duplicate id "${r.id}"`);
      byId.set(r.id, { ...r, by: [] });
    });
    const claim = (list, where) => (Array.isArray(list) ? list : list != null ? [list] : []).forEach((id) => {
      if (!byId.has(id)) errors.push(`${where}: covers "${id}" but brief.requirements has no such id${hint(id, [...byId.keys()])}`);
      else byId.get(id).by.push(where);
    });
    claim(spec.covers, 'page');
    sections.forEach((s, i) => s && claim(s.covers, `§${i + 1} ${s.type}${s.title ? ` "${String(s.title).slice(0, 20)}"` : ''}`));
    const rows = [...byId.values()];
    const open = rows.filter((r) => !r.by.length && !r.waived);
    const mustOpen = open.filter((r) => r.must !== false);
    const waived = rows.filter((r) => !r.by.length && r.waived).length;
    notes.push(`requirements: ${rows.length - open.length - waived}/${rows.length} covered${waived ? `, ${waived} waived` : ''}${open.length ? `, ${open.length} open` : ''}`);
    rows.forEach((r) => notes.push(`  ${r.by.length ? '✓' : r.waived ? '–' : '✗'} ${r.id} ${r.text}${r.by.length ? ` → ${r.by.join(', ')}` : r.waived ? ` (waived: ${r.waived})` : r.must === false ? ' - not covered (optional)' : ' - NOT COVERED'}`));
    if (mustOpen.length) errors.push(`requirement(s) not covered by any section: ${mustOpen.map((r) => r.id).join(', ')} - add a section with "covers": ["${mustOpen[0].id}"], or set "waived": "<reason>" on the requirement and tell the user why`);
  }

  /* ---- blueprint sample data left in a real deliverable ---- */
  const self = specPath ? path.resolve(specPath) : '';
  if (!spec._allowSample) {
    const hay = strings(spec).join('\n');
    for (const bp of blueprintMarkers(root)) {
      if (bp.file === self) continue;
      const hit = bp.marks.filter((m) => hay.includes(m));
      if (hit.length) errors.push(`blueprint "${bp.id}" sample data is still in the spec: ${hit.slice(0, 3).map((h) => `"${h.slice(0, 30)}"`).join(', ')} - replace it with the user's real content (set "_allowSample": true only for a deliberate demo build)`);
    }
  }
  return { errors, warns, notes };
}
