import { test, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Stubs for the browser globals copy.js touches (document, window, navigator).
const saved = {};
const KEYS = ['document', 'window', 'navigator'];
let state;

function makeButton() {
  const handlers = {};
  const classes = new Set();
  const classList = { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) };
  return { textContent: 'Copy', classList, addEventListener: (type, fn) => { handlers[type] = fn; }, click: () => handlers.click() };
}

function install({ clipboard, secure = true } = {}) {
  const selection = { removed: 0, ranges: [], removeAllRanges() { this.removed++; this.ranges = []; }, addRange(r) { this.ranges.push(r); } };
  const code = { id: 'installCmd' };
  state = { selection, code, ranges: [] };
  globalThis.document = {
    getElementById: (id) => (id === 'installCmd' ? code : null),
    createRange: () => { const r = { selected: null, selectNodeContents(n) { this.selected = n; } }; state.ranges.push(r); return r; },
  };
  globalThis.window = { isSecureContext: secure, getSelection: () => selection };
  // navigator is a getter-only global on modern Node, so define it explicitly.
  Object.defineProperty(globalThis, 'navigator', { value: clipboard ? { clipboard } : {}, configurable: true, writable: true });
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

before(() => { for (const k of KEYS) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k); });
after(() => {
  for (const k of KEYS) {
    if (saved[k]) Object.defineProperty(globalThis, k, saved[k]); else delete globalThis[k];
  }
});
beforeEach(() => mock.timers.reset());

const { wireCopy } = await import('../site/js/copy.js');
const CMD = 'npx ampline-claude --install';

test('clipboard available in a secure context: writes the exact text and confirms', async () => {
  const calls = [];
  install({ clipboard: { writeText: (t) => { calls.push(t); return Promise.resolve(); } } });
  const button = makeButton(); const status = { textContent: '' };
  wireCopy(button, CMD, status);
  button.click(); await flush();
  assert.deepEqual(calls, [CMD]);
  assert.equal(button.textContent, 'Copied');
  assert.equal(status.textContent, 'Install command copied to clipboard.');
  assert.equal(state.selection.ranges.length, 0, 'no fallback selection on success');
  assert.ok(button.classList.contains('is-copied'), 'green state on success');
});

test('writeText rejects: falls back to selecting the command', async () => {
  install({ clipboard: { writeText: () => Promise.reject(new Error('denied')) } });
  const button = makeButton(); const status = { textContent: '' };
  wireCopy(button, CMD, status);
  button.click(); await flush();
  assert.equal(state.ranges.length, 1);
  assert.equal(state.ranges[0].selected, state.code);
  assert.equal(state.selection.removed, 1);
  assert.deepEqual(state.selection.ranges, [state.ranges[0]]);
  assert.equal(button.textContent, 'Selected');
  assert.equal(status.textContent, 'Command selected. Press and hold, or Ctrl+C, to copy.');
  assert.ok(!button.classList.contains('is-copied'), 'rejection fallback stays neutral');
});

test('no navigator.clipboard: fallback without calling writeText', () => {
  install({});
  const button = makeButton(); const status = { textContent: '' };
  wireCopy(button, CMD, status);
  button.click();
  assert.equal(button.textContent, 'Selected');
  assert.equal(status.textContent, 'Command selected. Press and hold, or Ctrl+C, to copy.');
  assert.equal(state.ranges[0].selected, state.code);
  assert.ok(!button.classList.contains('is-copied'), 'no-clipboard fallback stays neutral');
});

test('insecure context: fallback without calling writeText', () => {
  let called = 0;
  install({ clipboard: { writeText: () => { called++; return Promise.resolve(); } }, secure: false });
  const button = makeButton(); const status = { textContent: '' };
  wireCopy(button, CMD, status);
  button.click();
  assert.equal(called, 0);
  assert.equal(button.textContent, 'Selected');
  assert.ok(!button.classList.contains('is-copied'), 'insecure fallback stays neutral');
});

test('timers reset the button text, the status and the green state', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    install({ clipboard: { writeText: () => Promise.resolve() } });
    const button = makeButton(); const status = { textContent: '' };
    wireCopy(button, CMD, status);
    button.click(); await flush();
    assert.equal(button.textContent, 'Copied');
    assert.ok(button.classList.contains('is-copied'));
    mock.timers.tick(2999);
    assert.equal(button.textContent, 'Copied');
    assert.ok(button.classList.contains('is-copied'));
    mock.timers.tick(1);
    assert.equal(button.textContent, 'Copy');
    assert.ok(!button.classList.contains('is-copied'));
    assert.equal(status.textContent, '');

    install({});
    const b2 = makeButton(); const s2 = { textContent: '' };
    wireCopy(b2, CMD, s2);
    b2.click();
    assert.equal(b2.textContent, 'Selected');
    assert.ok(!b2.classList.contains('is-copied'));
    mock.timers.tick(2499);
    assert.equal(b2.textContent, 'Selected');
    mock.timers.tick(1);
    assert.equal(b2.textContent, 'Copy');
    assert.ok(!b2.classList.contains('is-copied'));
    assert.equal(s2.textContent, '');
  } finally {
    mock.timers.reset();
  }
});

test('two quick clicks: the first timer is cancelled, so the second confirmation is not cut short', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    install({ clipboard: { writeText: () => Promise.resolve() } });
    const button = makeButton(); const status = { textContent: '' };
    wireCopy(button, CMD, status);
    button.click(); await flush();
    mock.timers.tick(2000);
    button.click(); await flush();
    mock.timers.tick(1000); // 3000 ms after the first click: its timer would have fired
    assert.equal(button.textContent, 'Copied');
    assert.ok(button.classList.contains('is-copied'));
    assert.equal(status.textContent, 'Install command copied to clipboard.');
    mock.timers.tick(1999);
    assert.equal(button.textContent, 'Copied');
    mock.timers.tick(1); // 3000 ms after the second click
    assert.equal(button.textContent, 'Copy');
    assert.ok(!button.classList.contains('is-copied'));
    assert.equal(status.textContent, '');
  } finally {
    mock.timers.reset();
  }
});

test('a fallback click after a success cancels the pending green reset and stays neutral', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let fail = false;
    install({ clipboard: { writeText: () => (fail ? Promise.reject(new Error('denied')) : Promise.resolve()) } });
    const button = makeButton(); const status = { textContent: '' };
    wireCopy(button, CMD, status);
    button.click(); await flush();
    assert.ok(button.classList.contains('is-copied'));
    fail = true;
    mock.timers.tick(1000);
    button.click(); await flush();
    assert.equal(button.textContent, 'Selected');
    assert.ok(!button.classList.contains('is-copied'), 'fallback after success drops the green state');
    mock.timers.tick(2000); // 3000 ms after the success: its timer must not fire
    assert.equal(button.textContent, 'Selected');
    mock.timers.tick(500); // 2500 ms after the fallback
    assert.equal(button.textContent, 'Copy');
  } finally {
    mock.timers.reset();
  }
});

test('fallback with no selection API (getSelection returns null): does not throw, still announces', () => {
  install({});
  globalThis.window.getSelection = () => null;
  const button = makeButton(); const status = { textContent: '' };
  wireCopy(button, CMD, status);
  assert.doesNotThrow(() => button.click());
  assert.equal(button.textContent, 'Selected');
  assert.equal(status.textContent, 'Command selected. Press and hold, or Ctrl+C, to copy.');
  assert.ok(!button.classList.contains('is-copied'));
});

test('text may be a function: it is read at click time, not at wire time', async () => {
  const calls = [];
  install({ clipboard: { writeText: (t) => { calls.push(t); return Promise.resolve(); } } });
  const button = makeButton(); const status = { textContent: '' };
  let current = '{}';
  wireCopy(button, () => current, status);
  current = '{ "color": false }';
  button.click(); await flush();
  assert.deepEqual(calls, ['{ "color": false }']);
  assert.equal(button.textContent, 'Copied');
});

test('opts: custom label, messages and fallback element (element or function)', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    install({ clipboard: { writeText: () => Promise.resolve() } });
    const button = makeButton(); const status = { textContent: '' };
    wireCopy(button, 'x', status, { label: 'Copy .amplinerc.json', copiedMessage: 'Config copied.' });
    button.click(); await flush();
    assert.equal(button.textContent, 'Copied');
    assert.equal(status.textContent, 'Config copied.');
    mock.timers.tick(3000);
    assert.equal(button.textContent, 'Copy .amplinerc.json', 'reset restores the custom label');
    assert.equal(status.textContent, '');
  } finally { mock.timers.reset(); }

  install({});
  const pre = { id: 'pre' };
  let opened = 0;
  const b2 = makeButton(); const s2 = { textContent: '' };
  wireCopy(b2, 'x', s2, { fallbackEl: () => { opened++; return pre; }, selectedMessage: 'JSON selected.' });
  b2.click();
  assert.equal(opened, 1);
  assert.equal(state.ranges[0].selected, pre);
  assert.equal(b2.textContent, 'Selected');
  assert.equal(s2.textContent, 'JSON selected.');

  install({});
  const b3 = makeButton(); const s3 = { textContent: '' };
  wireCopy(b3, 'x', s3, { fallbackEl: pre });
  b3.click();
  assert.equal(state.ranges[0].selected, pre);
});
