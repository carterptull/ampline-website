import { test, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Stubs for the browser globals copy.js touches (document, window, navigator).
const saved = {};
const KEYS = ['document', 'window', 'navigator'];
let state;

function makeButton() {
  const handlers = {};
  return { textContent: 'Copy', addEventListener: (type, fn) => { handlers[type] = fn; }, click: () => handlers.click() };
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
});

test('no navigator.clipboard: fallback without calling writeText', () => {
  install({});
  const button = makeButton(); const status = { textContent: '' };
  wireCopy(button, CMD, status);
  button.click();
  assert.equal(button.textContent, 'Selected');
  assert.equal(status.textContent, 'Command selected. Press and hold, or Ctrl+C, to copy.');
  assert.equal(state.ranges[0].selected, state.code);
});

test('insecure context: fallback without calling writeText', () => {
  let called = 0;
  install({ clipboard: { writeText: () => { called++; return Promise.resolve(); } }, secure: false });
  const button = makeButton(); const status = { textContent: '' };
  wireCopy(button, CMD, status);
  button.click();
  assert.equal(called, 0);
  assert.equal(button.textContent, 'Selected');
});

test('timers reset the button text and the status', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    install({ clipboard: { writeText: () => Promise.resolve() } });
    const button = makeButton(); const status = { textContent: '' };
    wireCopy(button, CMD, status);
    button.click(); await flush();
    assert.equal(button.textContent, 'Copied');
    mock.timers.tick(1599);
    assert.equal(button.textContent, 'Copied');
    mock.timers.tick(1);
    assert.equal(button.textContent, 'Copy');
    assert.equal(status.textContent, '');

    install({});
    const b2 = makeButton(); const s2 = { textContent: '' };
    wireCopy(b2, CMD, s2);
    b2.click();
    assert.equal(b2.textContent, 'Selected');
    mock.timers.tick(2499);
    assert.equal(b2.textContent, 'Selected');
    mock.timers.tick(1);
    assert.equal(b2.textContent, 'Copy');
    assert.equal(s2.textContent, '');
  } finally {
    mock.timers.reset();
  }
});
