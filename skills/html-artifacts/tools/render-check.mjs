#!/usr/bin/env node
/* html-artifacts · render check (the visual gate validate.mjs cannot be)
   ----------------------------------------------------------------------------
   validate.mjs reads the HTML text. Overflow, unreadable chart labels, colliding
   SVG text, orphaned grid rows and dead anchors only exist after a browser lays
   the page out - so this opens the artifact in a headless browser, runs
   tools/lib/render-audit.js at each viewport width, saves full-page screenshots,
   and collects console errors.

   usage:  node tools/render-check.mjs <file.html> [--widths=1280,390] [--shots=<dir>]
   exit:   0 PASS (warnings allowed) · 1 FAIL · 3 SKIPPED (no usable browser found)

   Driver: any locally installed Chromium-based browser (Chrome, Chromium, Edge,
   Brave), launched headless with a throwaway profile and driven over the Chrome
   DevTools Protocol - no npm packages. Set HTML_ARTIFACTS_BROWSER (or CHROME_PATH)
   to pick a binary. Needs Node 22+ (global WebSocket). When no browser is found the
   check is SKIPPED - say so in the delivery message and review the page by eye.
   ============================================================================ */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
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
const base = path.basename(abs);
const skip = (why) => { console.log(`SKIPPED  ${base} - ${why}; review the page by eye and say so when delivering.`); process.exit(3); };

if (typeof WebSocket === 'undefined') skip(`Node ${process.versions.node} has no global WebSocket (needs Node 22+)`);

/* ---- find a Chromium-based browser -------------------------------------- */
const onPath = (bin) => {
  const r = process.platform === 'win32'
    ? spawnSync('where', [bin], { encoding: 'utf8' })
    : spawnSync('sh', ['-c', `command -v "${bin}"`], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() : '';
};
const findBrowser = () => {
  for (const v of [process.env.HTML_ARTIFACTS_BROWSER, process.env.CHROME_PATH]) if (v) return fs.existsSync(v) ? v : onPath(v);
  const candidates = [];
  if (process.platform === 'darwin') {
    for (const app of ['Google Chrome', 'Chromium', 'Microsoft Edge', 'Brave Browser', 'Google Chrome Canary']) {
      candidates.push(`/Applications/${app}.app/Contents/MacOS/${app}`, path.join(os.homedir(), `Applications/${app}.app/Contents/MacOS/${app}`));
    }
  } else if (process.platform === 'win32') {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    for (const r of roots) candidates.push(path.join(r, 'Google/Chrome/Application/chrome.exe'), path.join(r, 'Microsoft/Edge/Application/msedge.exe'), path.join(r, 'Chromium/Application/chrome.exe'));
  }
  const hit = candidates.find((c) => fs.existsSync(c));
  if (hit) return hit;
  for (const bin of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable', 'brave-browser', 'chrome', 'msedge']) {
    const p = onPath(bin);
    if (p) return p;
  }
  return '';
};
const browser = findBrowser();
if (!browser) skip('no Chromium-based browser found (set HTML_ARTIFACTS_BROWSER=/path/to/chrome)');

/* ---- minimal CDP client ------------------------------------------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, what) => Promise.race([p, sleep(ms).then(() => { throw new Error(`timed out: ${what}`); })]);
const connect = (url) => new Promise((resolve, reject) => {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map(), listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, ko } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? ko(new Error(`${msg.error.message}`)) : ok(msg.result);
    } else if (msg.method) listeners.forEach((fn) => fn(msg));
  };
  ws.onerror = () => reject(new Error('could not connect to the browser'));
  ws.onopen = () => resolve({
    send: (method, params = {}, sessionId) => new Promise((ok, ko) => {
      const n = ++id; pending.set(n, { ok, ko });
      ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }));
    }),
    on: (fn) => listeners.push(fn),
    close: () => { try { ws.close(); } catch { /* already closed */ } },
  });
});

/* ---- run ---------------------------------------------------------------- */
const script = fs.readFileSync(path.join(HERE, 'lib/render-audit.js'), 'utf8').replace(/^\/\*[\s\S]*?\*\/\s*/, '').trim();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'html-artifacts-render-'));
const child = spawn(browser, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
  '--disable-extensions', '--mute-audio', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

const report = [];
const consoleErrors = [];
let cdp = null, failure = '';
try {
  const wsUrl = await withTimeout(new Promise((resolve, reject) => {
    let buf = '';
    child.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]); });
    child.on('error', reject);
    child.on('exit', (code) => reject(new Error(`browser exited (code ${code}) before DevTools was ready`)));
  }), 20000, 'browser start');
  cdp = await connect(wsUrl);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (m, p) => cdp.send(m, p, sessionId);
  let loaded = null;
  cdp.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    const p = msg.params || {};
    if (msg.method === 'Page.loadEventFired' && loaded) loaded();
    else if (msg.method === 'Runtime.consoleAPICalled' && p.type === 'error') consoleErrors.push((p.args || []).map((a) => a.value ?? a.description ?? '').join(' '));
    else if (msg.method === 'Runtime.exceptionThrown') consoleErrors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || 'uncaught exception');
    else if (msg.method === 'Log.entryAdded' && p.entry?.level === 'error') consoleErrors.push(p.entry.text);
  });
  await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Log.enable')]);
  const metrics = (w, h = 900) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await metrics(widths[0]);
  const onLoad = new Promise((r) => { loaded = r; });
  await send('Page.navigate', { url: pathToFileURL(abs).href });
  await withTimeout(onLoad, 30000, 'page load');

  for (const w of widths) {
    await metrics(w);
    await sleep(400);
    const ev = await send('Runtime.evaluate', { expression: script, returnByValue: true, awaitPromise: true });
    const res = ev.exceptionDetails ? null : ev.result?.value;
    if (!res || !Array.isArray(res.fail)) { report.push({ width: w, fail: [{ kind: 'audit-error', msg: 'the audit script returned no result' }], warn: [] }); continue; }
    report.push(res);
    if (shots) {
      const { cssContentSize: s } = await send('Page.getLayoutMetrics');
      const h = Math.min(Math.ceil(s.height), 16000);
      await metrics(w, h);
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
      fs.writeFileSync(path.join(shots, `${path.basename(abs, '.html')}-${w}.png`), Buffer.from(data, 'base64'));
    }
  }
} catch (e) {
  failure = e.message;
} finally {
  if (cdp) { try { await withTimeout(cdp.send('Browser.close'), 3000, 'browser close'); } catch { /* fall through to kill */ } cdp.close(); }
  if (child.exitCode === null) child.kill('SIGKILL');
  await sleep(200);
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* the OS cleans tmp eventually */ }
}
if (failure && !report.length) skip(`${path.basename(browser)} could not render the page (${failure})`);

const fails = report.flatMap((r) => r.fail.map((f) => ({ ...f, width: r.width })));
const warns = report.flatMap((r) => r.warn.map((f) => ({ ...f, width: r.width })));
if (failure) fails.push({ kind: 'audit-error', msg: failure, width: '*' });
if (consoleErrors.length) fails.push({ kind: 'console-error', msg: `${consoleErrors.length} console error(s): ${consoleErrors.slice(0, 3).join(' | ')}`, width: '*' });
const line = (f) => `[${f.width}px] ${f.kind}: ${f.msg}${f.more ? ` (+${f.more} more)` : ''}`;
console.log(`${fails.length ? 'FAIL' : warns.length ? `PASS (${warns.length} warnings)` : 'PASS'}  ${base}  (widths ${widths.join('/')}${shots ? `, screenshots → ${shots}` : ''})`);
fails.forEach((f) => console.log('  ✗ ' + line(f)));
warns.forEach((f) => console.log('  ! ' + line(f)));
if (shots) console.log(`  look at the screenshots before delivering: ${widths.map((w) => path.join(shots, `${path.basename(abs, '.html')}-${w}.png`)).join(' ')}`);
process.exit(fails.length ? 1 : 0);
