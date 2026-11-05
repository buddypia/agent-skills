import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { parseThemeBlocks, auditTheme } from './contrast.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = execFileSync('mktemp', ['-d'], { encoding: 'utf8' }).trim();
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
