#!/usr/bin/env node
/* html-artifacts · render check (the visual gate validate.mjs cannot be)
   ----------------------------------------------------------------------------
   validate.mjs reads the HTML text. Overflow, unreadable chart labels, colliding
   SVG text, orphaned grid rows and dead anchors only exist after a browser lays
   the page out - so this opens the artifact in a headless browser, runs
   tools/lib/render-audit.js at each viewport width, saves full-page screenshots,
   and collects console errors.

   usage:  node tools/render-check.mjs <file.html> [--widths=1280,390] [--shots=<dir>]
   exit:   0 PASS (warnings allowed) · 1 FAIL · 3 SKIPPED (no browser driver found)

   Driver: `chrome-cli` (or its `pw-agent` alias, shared headless pool; the session is always closed, even on
   error). With neither on PATH the check is SKIPPED - say so
   in the delivery message and review the page by eye instead.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
if (!file) { console.error('usage: node tools/render-check.mjs <file.html> [--widths=1280,390] [--shots=<dir>]'); process.exit(2); }
const abs = path.resolve(file);
if (!fs.existsSync(abs)) { console.error(`error: ${abs} does not exist`); process.exit(2); }
const widths = opt('widths', '1280,390').split(',').map((w) => parseInt(w, 10)).filter((w) => w >= 280);
if (!widths.length) { console.error('error: --widths needs at least one viewport width >= 280'); process.exit(2); }
const shots = opt('shots', '') ? path.resolve(opt('shots', '')) : '';
if (shots) fs.mkdirSync(shots, { recursive: true });

const has = (bin) => spawnSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' }).status === 0;
const driver = has('chrome-cli') ? 'chrome-cli' : has('pw-agent') ? 'pw-agent' : '';
if (!driver) {
  console.log(`SKIPPED  ${path.basename(abs)} - no browser driver (chrome-cli / pw-agent) on PATH; review the page by eye and say so when delivering.`);
  process.exit(3);
}
// a distinct 8-char prefix per run so parallel agents never share a session
const sid = process.env.CHROME_CLI_SESSION_ID || process.env.PW_AGENT_SESSION_ID || `harc${(process.pid % 0xffff).toString(16).padStart(4, '0')}${Date.now().toString(36).slice(-4)}`;
const env = { ...process.env, CHROME_CLI_SESSION_ID: sid, PW_AGENT_SESSION_ID: sid };
const run = (...a) => spawnSync(driver, a, { encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
const resultOf = (out) => {
  const m = String(out || '').match(/### Result\s*\n([\s\S]*?)(?:\n###|$)/);
  if (!m) return null;
  try { let v = JSON.parse(m[1].trim()); if (typeof v === 'string') v = JSON.parse(v); return v; } catch { return null; }
};

const script = fs.readFileSync(path.join(HERE, 'lib/render-audit.js'), 'utf8').replace(/^\/\*[\s\S]*?\*\/\s*/, '').trim();
const report = [];
let consoleErrors = 0, consoleSample = '';
const opened = run('open-test', `file://${abs}`);
try {
  if (opened.status !== 0) {
    console.log(`SKIPPED  ${path.basename(abs)} - ${driver} could not open the page:\n${(opened.stderr || opened.stdout || '').trim().split('\n').slice(-4).join('\n')}`);
    process.exitCode = 3;
  } else {
    for (const w of widths) {
      run('resize', String(w), '900');
      spawnSync('sleep', ['0.4']);
      const res = resultOf(run('eval', script).stdout);
      if (!res) { report.push({ width: w, fail: [{ kind: 'audit-error', msg: 'the audit script returned no result' }], warn: [] }); continue; }
      report.push(res);
      if (shots) run('screenshot', '--full-page', '--filename', path.join(shots, `${path.basename(abs, '.html')}-${w}.png`));
    }
    const con = run('console', 'error').stdout || '';
    consoleErrors = +((con.match(/Errors:\s*(\d+)/) || [])[1] || 0);
    if (consoleErrors) consoleSample = con.split('\n').filter((l) => /error/i.test(l) && !/Total messages/.test(l)).slice(0, 3).join(' | ');
  }
} finally {
  run('close-test');
}
if (process.exitCode === 3) process.exit(3);

const fails = report.flatMap((r) => r.fail.map((f) => ({ ...f, width: r.width })));
const warns = report.flatMap((r) => r.warn.map((f) => ({ ...f, width: r.width })));
if (consoleErrors) fails.push({ kind: 'console-error', msg: `${consoleErrors} console error(s): ${consoleSample}`, width: '*' });
const line = (f) => `[${f.width}px] ${f.kind}: ${f.msg}${f.more ? ` (+${f.more} more)` : ''}`;
console.log(`${fails.length ? 'FAIL' : warns.length ? `PASS (${warns.length} warnings)` : 'PASS'}  ${path.basename(abs)}  (widths ${widths.join('/')}${shots ? `, screenshots → ${shots}` : ''})`);
fails.forEach((f) => console.log('  ✗ ' + line(f)));
warns.forEach((f) => console.log('  ! ' + line(f)));
if (shots) console.log(`  look at the screenshots before delivering: ${widths.map((w) => path.join(shots, `${path.basename(abs, '.html')}-${w}.png`)).join(' ')}`);
process.exit(fails.length ? 1 : 0);
