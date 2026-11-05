import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../templates/core/interactions.js', import.meta.url), 'utf8');
function element(attrs = {}) {
  const classes = new Set();
  return {
    attrs, classes, textContent: 'Copy', dataset: {}, listeners: {},
    classList: {
      add: (v) => classes.add(v), remove: (v) => classes.delete(v),
      toggle: (v, on) => on ? classes.add(v) : classes.delete(v),
    },
    getAttribute(k) { return this.attrs[k] ?? null; },
    hasAttribute(k) { return k in this.attrs; },
    setAttribute(k, v) { this.attrs[k] = v; },
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
