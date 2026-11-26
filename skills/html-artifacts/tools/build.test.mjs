import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { parseThemeBlocks, auditTheme } from './contrast.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'html-artifacts-test-'));
after(() => fs.rmSync(scratch, { recursive: true }));
const run = (tool, ...args) => spawnSync(process.execPath, [path.join(root, 'tools', tool), ...args], { encoding: 'utf8' });
let seq = 0;
function build(spec) {
  const input = path.join(scratch, `probe-${++seq}.json`), output = input + '.html';
  fs.writeFileSync(input, JSON.stringify(spec));
  const result = run('build.mjs', input, output);
  return { ...result, output, html: result.status === 0 ? fs.readFileSync(output, 'utf8') : '' };
}
test('invalid specs stop before writing an artifact', () => {
  for (const spec of [
    { sections: [{ type: 'not-a-section' }] },
    { sections: [{ type: 'chart', variant: 'bar', series: [{ label: 'A', value: 'invalid' }] }] },
    { brief: { requirements: [{ id: 'R1', text: 'Required chart' }] }, sections: [{ type: 'prose', md: 'No claim' }] },
  ]) {
    const result = build({ title: 'Validation probe', ...spec });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert(!fs.existsSync(result.output));
  }
});
test('table extra cells retain valid tags and the row-length warning', () => {
  const result = build({ title: 'Table probe', sections: [{ type: 'table', columns: ['Item'], rows: [['A', 'B']] }] });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /warning:/); assert.match(result.html, /<td>B<\/td>/);
  assert(!result.html.includes('tdundefined'));
});
test('source punctuation remains valid and receives an editorial warning', () => {
  const result = build({ title: 'Source typography', sections: [{ type: 'prose', md: 'Annual results 2024–2026 — source wording.' }] });
  assert.equal(result.status, 0, result.stderr);
  const checked = run('validate.mjs', result.output);
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
  assert.match(checked.stdout, /editorial review only/);
});
test('caption contrast uses the normal text threshold on every theme', () => {
  const blocks = parseThemeBlocks(fs.readFileSync(path.join(root, 'templates/core/themes.css'), 'utf8'));
  for (const [id, theme] of Object.entries(blocks)) {
    if (id === '_root') continue;
    const rows = auditTheme(theme, blocks._root);
    assert.equal(rows.find((r) => r.fg === '--text-muted').min, 4.5);
    for (const row of rows) assert.equal(row.pass, true, `${id}: ${row.label} ${row.ratio}`);
  }
});
const samples = [
  ...fs.readdirSync(path.join(root, 'templates/blueprints')).filter((f) => f.endsWith('.spec.json')).sort().map((f) => `templates/blueprints/${f}`),
  ...fs.readdirSync(path.join(root, 'examples/specs')).filter((f) => f.endsWith('.spec.json')).sort().map((f) => `examples/specs/${f}`),
  'examples/example-demo-gallery.spec.json', 'examples/example-spec.json',
];
for (const [i, sample] of samples.entries()) test(`${sample}: repeatable build and static contract`, () => {
  const input = path.join(root, sample), output = path.join(scratch, `sample-${i}.html`);
  const first = run('build.mjs', input, output);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const bytes = fs.readFileSync(output);
  const second = run('build.mjs', input, output);
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert(bytes.equals(fs.readFileSync(output)), 'same spec produces identical bytes');
  const checked = run('validate.mjs', output);
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
});

test('all 24 new typed section types build deterministically and pass validate.mjs', () => {
  const result = build({
    title: 'Comprehensive 24 Typed Section Suite',
    lang: 'en',
    theme: 'slate',
    layout: 'stack',
    header: 'compact',
    sections: [
      { type: 'takeaways', title: 'Summary Takeaways', items: [{ lead: 'Point one', elab: 'Detail one' }, 'Point two'] },
      { type: 'beforeafter', title: 'Before vs After', before: ['Legacy flow'], after: ['Unified path'], transformLabel: 'Clean' },
      { type: 'diff', title: 'Code Diffs', files: [{ file: 'a.ts', kind: 'modified', patch: '@@ -1,2 +1,3 @@\n const x = 1;\n-return x;\n+return x + 1;\n', note: 'Checked' }, { file: 'b.ts', kind: 'added', lines: [{ type: 'add', ln: 1, text: '+export const ok = true;' }] }] },
      { type: 'code', title: 'Highlighted Snippet', file: 'demo.ts', lang: 'ts', highlight: [2], code: '// comment\nexport function run(n) { return "ok"; }' },
      { type: 'filetree', title: 'File Tree', entries: [{ path: 'src/index.ts', note: 'entry' }, { path: 'src/lib/util.ts' }] },
      { type: 'apiendpoint', title: 'REST API', endpoints: [{ method: 'POST', path: '/v1/items/:id', desc: 'Update item', params: [{ name: 'id', type: 'string', required: true, desc: 'Item ID' }], status: '200', responseDesc: 'Updated JSON' }] },
      { type: 'changelog', title: 'Release Log', versions: [{ version: 'v1.2.0', date: '2026-07-01', latest: true, groups: [{ tag: 'Added', tone: 'added', entries: ['Typed renderers'] }] }] },
      { type: 'waterfall', title: 'Revenue Bridge', items: [{ label: 'Start', value: 100, kind: 'start' }, { label: 'Up', value: 30, kind: 'delta' }, { label: 'Down', value: -10, kind: 'delta' }, { label: 'End', value: 120, kind: 'total' }] },
      { type: 'scatter', title: 'Usage Scatter', xLabel: 'Usage', yLabel: 'Risk', points: [{ x: 10, y: 80, r: 8, label: 'Alpha', series: 'High' }, { x: 70, y: 20, r: 6, label: 'Beta', series: 'Low' }] },
      { type: 'pareto', title: 'Pareto Defects', yAxis: 'Count', items: [{ label: 'Timeout', value: 50 }, { label: 'Validation', value: 30 }, { label: 'Other', value: 10 }] },
      { type: 'diverging', title: 'Sentiment Split', seriesA: 'Agree', seriesB: 'Disagree', items: [{ label: 'Speed', a: 80, b: 12 }, { label: 'UI', a: 70, b: 18 }] },
      { type: 'cohort', title: 'Monthly Retention', periods: ['M0', 'M1', 'M2'], cohorts: [{ label: '2026-01', size: '100', values: [100, 72, 61] }, { label: '2026-02', size: '120', values: [100, 75, null] }] },
      { type: 'leaderboard', title: 'Team Leaderboard', items: [{ rank: 1, name: 'East', value: 98, display: '98%', move: '+2', dir: 'up' }, { rank: 2, name: 'West', value: 91, display: '91%', move: '-1', dir: 'down' }] },
      { type: 'quadrant', title: 'Priority Matrix', xAxis: 'Ease', yAxis: 'Impact', quadrants: { tl: 'Big Bets', tr: 'Quick Wins', bl: 'Defer', br: 'Fill' }, items: [{ label: 'Task A', x: 80, y: 82 }] },
      { type: 'riskmatrix', title: 'Risk Matrix', xAxis: 'Impact', yAxis: 'Likelihood', items: [{ label: 'Outage', prob: 4, impact: 5 }] },
      { type: 'sequence', title: 'Call Sequence', actors: ['Client', 'API', 'DB'], messages: [{ from: 'Client', to: 'API', label: 'POST' }, { from: 'API', to: 'DB', label: 'INSERT' }, { from: 'DB', to: 'API', type: 'return', label: 'OK' }], notes: [{ actor: 'API', text: 'Idempotent' }] },
      { type: 'statediagram', title: 'Job States', states: [{ id: 's0', label: 'New', initial: true }, { id: 's1', label: 'Done', tone: 'success', final: true }], transitions: [{ from: 's0', to: 's1', label: 'finish()' }] },
      { type: 'erd', title: 'Schema ERD', entities: [{ id: 'users', name: 'users', columns: [{ name: 'id', key: 'PK', type: 'uuid' }] }, { id: 'orders', name: 'orders', columns: [{ name: 'user_id', key: 'FK', type: 'uuid' }] }], relations: [{ from: 'users', to: 'orders', cardinality: '1:N' }] },
      { type: 'sankey', title: 'Traffic Flow', leftTitle: 'Source', rightTitle: 'Target', flows: [{ from: 'Search', to: 'Signup', value: 60 }, { from: 'Direct', to: 'Signup', value: 40 }] },
      { type: 'fishbone', title: 'Root Cause', effect: 'Latency Spike', categories: [{ label: 'Code', causes: ['Lock contention'] }, { label: 'Infra', causes: ['Cold cache'] }] },
      { type: 'kpitree', title: 'Unit Cost Tree', root: { name: 'Total', value: '$10', op: '+', children: [{ name: 'Compute', value: '$6' }, { name: 'Storage', value: '$4' }] } },
      { type: 'walkthrough', title: 'Walkthrough Tour', steps: [{ id: '1', title: 'Step One', label: 'Init', code: 'init()', desc: 'Initialize subsystem' }, { id: '2', title: 'Step Two', label: 'Run', code: 'run()', desc: 'Execute worker' }] },
      { type: 'verification', title: 'Verification Logs', duration: '2.1s', items: [{ name: 'Unit Tests', cmd: 'node --test', status: 'pass', counts: '10/10', duration: '1.1s', log: 'ok' }, { name: 'E2E', cmd: 'npm run e2e', status: 'fail', counts: '1 failed', duration: '1.0s', log: 'err' }] },
      { type: 'review', id: 'review-signoff', title: 'Human Review Signoff', items: [{ id: 'r1', scope: 'a.ts', title: 'Confirm diff', status: 'ok' }, { id: 'r2', scope: 'b.ts', title: 'Check test', note: 'Needs edge case' }] },
    ],
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const bytes = fs.readFileSync(result.output);
  const again = build({
    title: 'Comprehensive 24 Typed Section Suite', lang: 'en', theme: 'slate', layout: 'stack', header: 'compact',
    sections: [
      { type: 'takeaways', title: 'Summary Takeaways', items: [{ lead: 'Point one', elab: 'Detail one' }, 'Point two'] },
      { type: 'beforeafter', title: 'Before vs After', before: ['Legacy flow'], after: ['Unified path'], transformLabel: 'Clean' },
      { type: 'diff', title: 'Code Diffs', files: [{ file: 'a.ts', kind: 'modified', patch: '@@ -1,2 +1,3 @@\n const x = 1;\n-return x;\n+return x + 1;\n', note: 'Checked' }, { file: 'b.ts', kind: 'added', lines: [{ type: 'add', ln: 1, text: '+export const ok = true;' }] }] },
      { type: 'code', title: 'Highlighted Snippet', file: 'demo.ts', lang: 'ts', highlight: [2], code: '// comment\nexport function run(n) { return "ok"; }' },
      { type: 'filetree', title: 'File Tree', entries: [{ path: 'src/index.ts', note: 'entry' }, { path: 'src/lib/util.ts' }] },
      { type: 'apiendpoint', title: 'REST API', endpoints: [{ method: 'POST', path: '/v1/items/:id', desc: 'Update item', params: [{ name: 'id', type: 'string', required: true, desc: 'Item ID' }], status: '200', responseDesc: 'Updated JSON' }] },
      { type: 'changelog', title: 'Release Log', versions: [{ version: 'v1.2.0', date: '2026-07-01', latest: true, groups: [{ tag: 'Added', tone: 'added', entries: ['Typed renderers'] }] }] },
      { type: 'waterfall', title: 'Revenue Bridge', items: [{ label: 'Start', value: 100, kind: 'start' }, { label: 'Up', value: 30, kind: 'delta' }, { label: 'Down', value: -10, kind: 'delta' }, { label: 'End', value: 120, kind: 'total' }] },
      { type: 'scatter', title: 'Usage Scatter', xLabel: 'Usage', yLabel: 'Risk', points: [{ x: 10, y: 80, r: 8, label: 'Alpha', series: 'High' }, { x: 70, y: 20, r: 6, label: 'Beta', series: 'Low' }] },
      { type: 'pareto', title: 'Pareto Defects', yAxis: 'Count', items: [{ label: 'Timeout', value: 50 }, { label: 'Validation', value: 30 }, { label: 'Other', value: 10 }] },
      { type: 'diverging', title: 'Sentiment Split', seriesA: 'Agree', seriesB: 'Disagree', items: [{ label: 'Speed', a: 80, b: 12 }, { label: 'UI', a: 70, b: 18 }] },
      { type: 'cohort', title: 'Monthly Retention', periods: ['M0', 'M1', 'M2'], cohorts: [{ label: '2026-01', size: '100', values: [100, 72, 61] }, { label: '2026-02', size: '120', values: [100, 75, null] }] },
      { type: 'leaderboard', title: 'Team Leaderboard', items: [{ rank: 1, name: 'East', value: 98, display: '98%', move: '+2', dir: 'up' }, { rank: 2, name: 'West', value: 91, display: '91%', move: '-1', dir: 'down' }] },
      { type: 'quadrant', title: 'Priority Matrix', xAxis: 'Ease', yAxis: 'Impact', quadrants: { tl: 'Big Bets', tr: 'Quick Wins', bl: 'Defer', br: 'Fill' }, items: [{ label: 'Task A', x: 80, y: 82 }] },
      { type: 'riskmatrix', title: 'Risk Matrix', xAxis: 'Impact', yAxis: 'Likelihood', items: [{ label: 'Outage', prob: 4, impact: 5 }] },
      { type: 'sequence', title: 'Call Sequence', actors: ['Client', 'API', 'DB'], messages: [{ from: 'Client', to: 'API', label: 'POST' }, { from: 'API', to: 'DB', label: 'INSERT' }, { from: 'DB', to: 'API', type: 'return', label: 'OK' }], notes: [{ actor: 'API', text: 'Idempotent' }] },
      { type: 'statediagram', title: 'Job States', states: [{ id: 's0', label: 'New', initial: true }, { id: 's1', label: 'Done', tone: 'success', final: true }], transitions: [{ from: 's0', to: 's1', label: 'finish()' }] },
      { type: 'erd', title: 'Schema ERD', entities: [{ id: 'users', name: 'users', columns: [{ name: 'id', key: 'PK', type: 'uuid' }] }, { id: 'orders', name: 'orders', columns: [{ name: 'user_id', key: 'FK', type: 'uuid' }] }], relations: [{ from: 'users', to: 'orders', cardinality: '1:N' }] },
      { type: 'sankey', title: 'Traffic Flow', leftTitle: 'Source', rightTitle: 'Target', flows: [{ from: 'Search', to: 'Signup', value: 60 }, { from: 'Direct', to: 'Signup', value: 40 }] },
      { type: 'fishbone', title: 'Root Cause', effect: 'Latency Spike', categories: [{ label: 'Code', causes: ['Lock contention'] }, { label: 'Infra', causes: ['Cold cache'] }] },
      { type: 'kpitree', title: 'Unit Cost Tree', root: { name: 'Total', value: '$10', op: '+', children: [{ name: 'Compute', value: '$6' }, { name: 'Storage', value: '$4' }] } },
      { type: 'walkthrough', title: 'Walkthrough Tour', steps: [{ id: '1', title: 'Step One', label: 'Init', code: 'init()', desc: 'Initialize subsystem' }, { id: '2', title: 'Step Two', label: 'Run', code: 'run()', desc: 'Execute worker' }] },
      { type: 'verification', title: 'Verification Logs', duration: '2.1s', items: [{ name: 'Unit Tests', cmd: 'node --test', status: 'pass', counts: '10/10', duration: '1.1s', log: 'ok' }, { name: 'E2E', cmd: 'npm run e2e', status: 'fail', counts: '1 failed', duration: '1.0s', log: 'err' }] },
      { type: 'review', id: 'review-signoff', title: 'Human Review Signoff', items: [{ id: 'r1', scope: 'a.ts', title: 'Confirm diff', status: 'ok' }, { id: 'r2', scope: 'b.ts', title: 'Check test', note: 'Needs edge case' }] },
    ],
  });
  assert(bytes.equals(fs.readFileSync(again.output)), '24-type spec builds deterministically');
  const checked = run('validate.mjs', result.output);
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
  assert.match(result.html, /data-review/);
  assert.match(result.html, /data-review-jump/);
  assert.match(result.html, /data-details-toggle/);
  assert.match(result.html, /data-walkthrough/);
  assert.match(result.html, /class="diff-nav/);
  assert.match(result.html, /class="cs-row is-hl"/);
});
