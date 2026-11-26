import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../templates/core/interactions.js', import.meta.url), 'utf8');
function element(attrs = {}) {
  const classes = new Set();
  return {
    attrs, classes, textContent: 'Copy', dataset: {}, listeners: {}, style: {},
    classList: {
      add: (v) => classes.add(v), remove: (v) => classes.delete(v),
      contains: (v) => classes.has(v),
      toggle: (v, on) => on === undefined ? (classes.has(v) ? (classes.delete(v), false) : (classes.add(v), true)) : (on ? classes.add(v) : classes.delete(v)),
    },
    getAttribute(k) { return this.attrs[k] ?? null; },
    hasAttribute(k) { return k in this.attrs; },
    setAttribute(k, v) { this.attrs[k] = v; },
    removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(k, f) { (this.listeners[k] ??= []).push(f); },
    querySelectorAll() { return []; },
  };
}
function library(document, navigator = {}) {
  const timers = [];
  const window = {};
  document.readyState = 'loading';
  document.addEventListener = () => {};
  const context = vm.createContext({ window, document, navigator, setTimeout: (fn) => (timers.push(fn), timers.length), clearTimeout: () => {} });
  vm.runInContext(source, context);
  return { HA: window.HA, timers };
}
async function copy({ clipboard, result = true, throws = false, lang = 'en', attrs = { 'data-copy-text': 'payload' }, target = null } = {}) {
  const button = element(attrs), children = [], calls = [];
  let restored = false;
  const body = {
    appendChild(el) { children.push(el); el.parentNode = body; },
    removeChild(el) { children.splice(children.indexOf(el), 1); el.parentNode = null; },
  };
  const document = {
    body, activeElement: { focus() { restored = true; } },
    documentElement: { getAttribute: () => lang },
    querySelectorAll: () => [button], querySelector: () => target,
    createElement: () => ({ style: {}, select() {} }),
    execCommand(name) { calls.push(name); if (throws) throw Error('denied'); return result; },
  };
  const { HA, timers } = library(document, { clipboard });
  HA.copy(); HA.copy();
  assert.equal(button.listeners.click.length, 1, 'initialization is idempotent');
  button.listeners.click[0]();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(children.length, 0, 'fallback textarea is removed');
  return { button, calls, restored, timers };
}
test('copy confirms fallback only when the browser reports success', async () => {
  const { button, calls, restored, timers } = await copy();
  assert.equal(button.textContent, 'Copied ✓');
  assert(button.classes.has('copied')); assert.deepEqual(calls, ['copy']); assert(restored);
  timers.at(-1)(); assert.equal(button.textContent, 'Copy');
});
test('copy failure is honest for false, throwing and denied fallbacks', async () => {
  for (const options of [{ result: false }, { throws: true }, { clipboard: { writeText: () => Promise.reject(Error('denied')) }, result: false }]) {
    const { button, restored } = await copy(options);
    assert.equal(button.textContent, 'Copy failed'); assert(!button.classes.has('copied')); assert(restored);
  }
});
test('Clipboard API success skips fallback and localizes feedback', async () => {
  for (const [lang, expected] of [['ja', '✓ コピーしました！'], ['ko', '✓ 복사되었습니다!'], ['en', 'Copied ✓']]) {
    let payload;
    const { button, calls } = await copy({ lang, clipboard: { writeText: async (text) => { payload = text; } } });
    assert.equal(payload, 'payload'); assert.equal(button.textContent, expected); assert.deepEqual(calls, []);
  }
});
test('copy supports explicit empty literals and preserves empty field values', async () => {
  for (const [attrs, target] of [[{ 'data-copy-text': '' }, null], [{ 'data-copy': '#field' }, { value: '', textContent: 'not the field value' }]]) {
    let payload;
    await copy({ attrs, target, clipboard: { writeText: async (text) => { payload = text; } } });
    assert.equal(payload, '');
  }
});
test('copy reports missing targets and honors custom feedback', async () => {
  const missing = await copy({ attrs: { 'data-copy': '#absent', 'data-copy-failed': 'Unavailable' } });
  assert.equal(missing.button.textContent, 'Unavailable'); assert.deepEqual(missing.calls, []);
  const custom = await copy({ attrs: { 'data-copy-text': 'x', 'data-copy-done': 'Saved' } });
  assert.equal(custom.button.textContent, 'Saved');
});
test('switcher synchronizes bars, handles case lists and all-only content', () => {
  const a = element({ 'data-switch': 'a' }), all = element({ 'data-switch': 'all' });
  const mirror = element({ 'data-switch': 'a' });
  const bar = element({ 'data-switch-group': 'tools' }), secondBar = element({ 'data-switch-group': 'tools' });
  const shared = element({ 'data-switch-case': 'a,b' }), only = element({ 'data-switch-case': 'b', 'data-switch-only': '' });
  const always = element({ 'data-switch-case': 'all' });
  const document = { querySelectorAll(selector) {
    if (selector === '[data-switch-group]') return [bar, secondBar];
    return selector.includes('data-switch-group') ? [a, all, mirror] : [shared, only, always];
  } };
  bar.querySelectorAll = () => [a, all]; secondBar.querySelectorAll = () => [mirror];
  const { HA } = library(document);
  HA.switcher(); HA.switcher(); assert.equal(a.listeners.click.length, 1);
  a.listeners.click[0]();
  assert.equal(mirror.attrs['aria-pressed'], 'true'); assert.equal(all.attrs['aria-pressed'], 'false');
  assert(!shared.classes.has('hidden')); assert(only.classes.has('hidden')); assert(!always.classes.has('hidden'));
  all.listeners.click[0]();
  assert(!shared.classes.has('hidden')); assert(only.classes.has('hidden')); assert(!always.classes.has('hidden'));
});

test('HA.review manages verdicts, notes, storage persistence, filters, reset, and Markdown output', () => {
  function makeNode(attrs = {}) {
    const n = element(attrs);
    n.children = [];
    n.focus = () => {};
    n.removeAttribute = (k) => { delete n.attrs[k]; };
    n.querySelector = (sel) => {
      if (sel === '.rv-item-title') return n._titleEl || null;
      if (sel === '.rv-scope') return n._scopeEl || null;
      if (sel === '[data-review-note]') return n._noteEl || null;
      if (sel === '[data-review-badge]') return n._badgeEl || null;
      return n._qs ? n._qs(sel) : null;
    };
    return n;
  }
  const ok1 = makeNode({ 'data-review-status': 'ok' });
  const fix1 = makeNode({ 'data-review-status': 'fix' });
  const note1 = makeNode(); note1.value = '';
  const item1 = makeNode({ 'data-review-item': 'i1', 'data-review-title': 'Auth fix' });
  item1._noteEl = note1;
  item1._scopeEl = { textContent: 'auth.ts' };
  item1.querySelectorAll = (sel) => sel === '[data-review-status]' ? [ok1, fix1] : [];

  const ok2 = makeNode({ 'data-review-status': 'ok' });
  const note2 = makeNode(); note2.value = '';
  const item2 = makeNode({ 'data-review-item': 'i2', 'data-review-title': 'UI layout' });
  item2._noteEl = note2;
  item2.querySelectorAll = (sel) => sel === '[data-review-status]' ? [ok2] : [];

  const fAll = makeNode({ 'data-review-filter': 'all' });
  const fFix = makeNode({ 'data-review-filter': 'fix' });
  const progress = makeNode();
  const output = makeNode(); output.value = '';
  const reset = makeNode();
  const jumpBadge = makeNode({ 'data-review-badge': '' });
  const jump = makeNode({ 'data-review-jump': '' });
  jump._badgeEl = jumpBadge;

  const rv = makeNode({ 'data-review': '', 'data-review-id': 'test-rv' });
  rv._qs = (sel) => ({ '[data-review-progress]': progress, '[data-review-output]': output, '[data-review-reset]': reset }[sel] || null);
  rv.querySelectorAll = (sel) => {
    if (sel === '[data-review-item]') return [item1, item2];
    if (sel === '[data-review-filter]') return [fAll, fFix];
    return [];
  };

  const store = new Map();
  const windowObj = { localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) } };
  const doc = {
    readyState: 'loading', title: 'PR Review',
    documentElement: { getAttribute: () => 'en' },
    addEventListener: () => {},
    querySelectorAll: (sel) => sel === '[data-review]' ? [rv] : sel === '[data-review-jump]' ? [jump] : [],
  };
  const ctx = vm.createContext({ window: windowObj, document: doc, location: { pathname: '/test' }, navigator: {}, setTimeout: () => 1, clearTimeout: () => {} });
  vm.runInContext(source, ctx);
  windowObj.HA.review(doc);

  fix1.listeners.click[0]();
  note1.value = 'Add null guard';
  note1.listeners.input[0]();
  ok2.listeners.click[0]();

  assert.equal(item1.getAttribute('data-status'), 'fix');
  assert.equal(jumpBadge.textContent, '1');
  assert.match(progress.textContent, /2 \/ 2 reviewed \(Needs Fix 1\)/);
  assert.match(output.value, /### Needs Fix[\s\S]*Auth fix.*Add null guard/);
  assert(store.has('ha-review:test-rv'));

  fFix.listeners.click[0]();
  assert(!item1.classes.has('hidden'));
  assert(item2.classes.has('hidden'));

  reset.listeners.click[0]();
  assert.equal(item1.getAttribute('data-status'), null);
  assert(!store.has('ha-review:test-rv'));
});

test('HA.walkthrough synchronizes step selection and target highlights', () => {
  function mk(attrs = {}) { return element(attrs); }
  const s1 = mk({ 'data-walk-step': '1' }), s2 = mk({ 'data-walk-step': '2' });
  s1.removeAttribute = (k) => delete s1.attrs[k];
  s2.removeAttribute = (k) => delete s2.attrs[k];
  const t1 = mk({ 'data-walk-target': '1' }), t2 = mk({ 'data-walk-target': '2' });
  const readout = mk(), nextBtn = mk({ 'data-walk-next': '' }), prevBtn = mk({ 'data-walk-prev': '' });
  const wk = mk({ 'data-walkthrough': '' });
  wk.querySelector = (s) => ({ '[data-walk-readout]': readout, '[data-walk-next]': nextBtn, '[data-walk-prev]': prevBtn }[s] || null);
  wk.querySelectorAll = (s) => s === '[data-walk-step]' ? [s1, s2] : s === '[data-walk-target]' ? [t1, t2] : [];
  const doc = { querySelectorAll: (s) => s === '[data-walkthrough]' ? [wk] : [] };
  const { HA } = library(doc);
  HA.walkthrough(doc);
  assert.equal(readout.textContent, '1 / 2');
  assert(t1.classes.has('is-active') && t2.classes.has('is-dimmed'));
  nextBtn.listeners.click[0]();
  assert.equal(readout.textContent, '2 / 2');
  assert(t2.classes.has('is-active') && t1.classes.has('is-dimmed'));
  assert.equal(s2.getAttribute('aria-current'), 'step');
});

test('HA.sortable uses dt-sort-btn, aria-sort, numeric/string sorting, and live status announcement', () => {
  function makeTh(label) {
    const btn = element({}); btn.type = 'button'; btn.className = 'dt-sort-btn'; btn.textContent = label;
    const th = element({}); th.style = {}; th.removeAttribute = (k) => delete th.attrs[k];
    th.querySelector = (s) => s === 'button.dt-sort-btn' ? btn : null;
    return { th, btn };
  }
  const c0 = makeTh('Name'), c1 = makeTh('Cost');
  const td = (t) => Object.assign(element({}), { textContent: t });
  const rA = { cells: [td('Zeta'), td('$20')] };
  const rB = { cells: [td('Alpha'), td('$100')] };
  const tbody = { rows: [rA, rB], appendChild(r) { this.rows.splice(this.rows.indexOf(r), 1); this.rows.push(r); } };
  const statusEl = element({});
  const hostChildren = [];
  const host = {
    querySelector: () => null,
    appendChild(el) { hostChildren.push(el); Object.assign(statusEl, el); },
  };
  const table = element({});
  table.tHead = { rows: [{ cells: [c0.th, c1.th] }] };
  table.tBodies = [tbody];
  table.parentNode = host;
  const doc = {
    documentElement: { lang: 'en', getAttribute: () => 'en' },
    querySelectorAll: (s) => s === 'table[data-sortable]' ? [table] : [],
    createElement: () => element({}),
  };
  const { HA } = library(doc);
  HA.sortable(doc);
  c1.btn.listeners.click[0]();
  assert.equal(c1.th.getAttribute('aria-sort'), 'ascending');
  assert.equal(c0.th.getAttribute('aria-sort'), null);
  assert.deepEqual(tbody.rows, [rA, rB], '$20 sorts before $100 ascending');
  assert.match(hostChildren[0].textContent, /Sorted by Cost, ascending/);
  c1.btn.listeners.click[0]();
  assert.equal(c1.th.getAttribute('aria-sort'), 'descending');
  assert.deepEqual(tbody.rows, [rB, rA]);
});

test('HA.tabs uses hidden="until-found", updates roving tabindex, and reveals panel on beforematch', () => {
  const t1 = element({ 'data-tab': 'a', 'aria-selected': 'true' }); t1.classList.add('active');
  const t2 = element({ 'data-tab': 'b', 'aria-selected': 'false' });
  const p1 = element({ 'data-panel': 'a' }); p1.classList.add('tab-panel'); p1.removeAttribute = (k) => delete p1.attrs[k];
  const p2 = element({ 'data-panel': 'b', hidden: 'until-found' }); p2.classList.add('tab-panel'); p2.removeAttribute = (k) => delete p2.attrs[k];
  const tablist = element({ role: 'tablist' });
  const group = element({ 'data-tabs': '' });
  group.querySelector = (s) => s === '[role="tablist"]' ? tablist : null;
  group.querySelectorAll = (s) => s === '.tab' ? [t1, t2] : s === '[data-panel]' ? [p1, p2] : [];
  const doc = { querySelectorAll: (s) => s === '[data-tabs]' ? [group] : [] };
  const { HA } = library(doc);
  HA.tabs(doc);
  assert.equal(t1.getAttribute('tabindex'), '0');
  assert.equal(t2.getAttribute('tabindex'), '-1');
  assert.equal(p2.getAttribute('hidden'), 'until-found');
  p2.listeners.beforematch[0]();
  assert.equal(t2.getAttribute('aria-selected'), 'true');
  assert.equal(t2.getAttribute('tabindex'), '0');
  assert.equal(p2.getAttribute('hidden'), null);
  assert.equal(p1.getAttribute('hidden'), 'until-found');
});
