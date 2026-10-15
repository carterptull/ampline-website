import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createAmpline } from '../site/js/runtime/ampline.js';
import { mountPlayground, NARROW_COLUMNS } from '../site/js/playground.js';

// A fake DOM that is just enough for mountPlayground, wireCopy, watchOverflow and ansi.renderAnsi.
function makeEl(tag) {
  const cls = new Set();
  const attrs = {};
  const listeners = {};
  return {
    tag, kids: [], style: {}, attrs, listeners, hidden: false, value: '', open: false,
    scrollWidth: 0, clientWidth: 0, _text: '',
    get children() { return this.kids.filter((k) => k.tag !== '#text'); },
    set className(v) { cls.clear(); for (const c of String(v).split(/\s+/)) if (c) cls.add(c); },
    get className() { return [...cls].join(' '); },
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c),
      toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); } },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return k in attrs ? attrs[k] : null; },
    removeAttribute(k) { delete attrs[k]; },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    fire(type, ...a) { for (const fn of listeners[type] || []) fn(...a); },
    appendChild(c) { if (c.tag === '#fragment') { this.kids.push(...c.kids); c.kids = []; } else this.kids.push(c); return c; },
    append(...cs) { for (const c of cs) this.appendChild(c); },
    replaceChildren(...cs) { this.kids = []; this.append(...cs); },
    set textContent(v) { this._text = String(v); this.kids = []; },
    get textContent() { return this.kids.length ? this.kids.map((k) => k.textContent).join('') : this._text; },
  };
}
function walk(n, fn, parent = null) { fn(n, parent); for (const k of n.kids || []) walk(k, fn, n); }
function findAll(root, pred) { const out = []; walk(root, (n) => { if (n.tag !== '#text' && pred(n)) out.push(n); }); return out; }
const byId = (root, id) => findAll(root, (n) => n.attrs.id === id)[0];
const button = (root, label) => findAll(root, (n) => n.tag === 'button' && n.textContent === label)[0];

function setup(t, { narrow = false } = {}) {
  mock.timers.enable({ apis: ['setTimeout'] });
  const clip = [];
  const saved = { window: globalThis.window, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
  globalThis.window = { isSecureContext: true };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: (v) => { clip.push(v); return Promise.resolve(); } } } });
  t.after(() => {
    mock.timers.reset();
    if (saved.window === undefined) delete globalThis.window; else globalThis.window = saved.window;
    Object.defineProperty(globalThis, 'navigator', saved.navigator);
  });

  const doc = {
    createElement: makeEl,
    createDocumentFragment: () => makeEl('#fragment'),
    createTextNode: (data) => ({ tag: '#text', data, get textContent() { return this.data; } }),
  };
  const mq = { matches: narrow, listeners: [], addEventListener(_, fn) { this.listeners.push(fn); } };
  const win = {
    document: doc, matchMedia: () => mq,
    addEventListener() {}, requestAnimationFrame: (cb) => { cb(); return 1; },
    setTimeout: (...a) => globalThis.setTimeout(...a), clearTimeout: (...a) => globalThis.clearTimeout(...a),
  };
  // Every instance is tagged with the noColor option it was created with, and each render records which one ran.
  const made = [];
  const renders = [];
  const makeAmpline = (opts = {}) => {
    const amp = createAmpline(opts);
    const kind = opts.noColor ? 'plain' : 'color';
    const render = amp.renderStatusline;
    amp.renderStatusline = (input) => { renders.push(kind); return render(input); };
    made.push(kind);
    return amp;
  };
  const mount = makeEl('div');
  mountPlayground({ mount, makeAmpline, win });
  const line = byId(mount, 'playLine');
  const pre = byId(mount, 'playJson');
  const colored = () => findAll(line, (n) => n.style.color).length;
  const widthField = () => { let p = null; walk(mount, (n, par) => { if (n.attrs && n.attrs.id === 'pg-width') p = par; }); return p; };
  return { mount, line, pre, mq, clip, colored, widthField, made, renders,
    pressed: (label) => button(mount, label).attrs['aria-pressed'],
    slide: (id, v) => { const el = byId(mount, id); el.value = String(v); el.fire('input'); } };
}

test('playground mount: moving a control clears the active preset', (t) => {
  const d = setup(t);
  button(d.mount, 'Stale cache').fire('click');
  assert.equal(d.pressed('Stale cache'), 'true');
  d.slide('pg-context', 70);
  assert.equal(d.pressed('Stale cache'), 'false');
  button(d.mount, '85% edge').fire('click');
  assert.equal(d.pressed('85% edge'), 'true');
  button(d.mount, 'git').fire('click');
  assert.equal(d.pressed('85% edge'), 'false', 'a segment toggle clears it too');
});

test('playground mount: NO_COLOR keeps the preset and renders through the noColor instance', (t) => {
  const d = setup(t);
  assert.deepEqual(d.made, ['color'], 'the plain instance is built lazily');
  button(d.mount, 'API-key account').fire('click');
  assert.ok(d.colored() > 0, 'the colored instance paints colors');
  assert.equal(d.renders.at(-1), 'color');
  button(d.mount, 'NO_COLOR').fire('click');
  assert.deepEqual(d.made, ['color', 'plain'], 'a noColor: true instance was created on first use');
  assert.equal(d.renders.at(-1), 'plain', 'the render came from the noColor instance');
  assert.equal(d.pressed('API-key account'), 'true', 'NO_COLOR is environment, not a manual edit');
  assert.equal(d.colored(), 0, 'plain output has no colors');
  assert.deepEqual(JSON.parse(d.pre.textContent).color, false);
  button(d.mount, 'NO_COLOR').fire('click');
  assert.equal(d.renders.at(-1), 'color', 'switching back uses the colored instance again');
  assert.ok(d.colored() > 0);
});

test('playground mount: wide and narrow modes, including a media-query change', (t) => {
  const d = setup(t, { narrow: true });
  assert.equal(d.widthField().hidden, true, 'the width control is hidden on a narrow screen');
  assert.deepEqual(JSON.parse(d.pre.textContent).segments, ['model', 'context', 'fiveHour', 'weekly']);
  assert.ok(d.line.textContent.includes('\n'), `${NARROW_COLUMNS} columns splits the line in two`);

  d.mq.listeners.forEach((fn) => fn({ matches: false }));
  assert.equal(d.widthField().hidden, false);
  assert.ok(JSON.parse(d.pre.textContent).segments.includes('dir'), 'wide mode shows the full segment list');
});

test('playground mount: Copy .amplinerc.json copies the diff of the chosen config from the defaults', async (t) => {
  const d = setup(t);
  button(d.mount, 'NO_COLOR').fire('click');
  button(d.mount, 'Copy .amplinerc.json').fire('click');
  await Promise.resolve();
  // Wide mode with git, cost and PR on and task off: that segment order, and color off, differ from the defaults.
  const expected = JSON.stringify({
    segments: ['dir', 'git', 'model', 'context', 'fiveHour', 'weekly', 'cost', 'pr'],
    color: false,
  }, null, 2);
  assert.deepEqual(d.clip, [expected]);
  assert.equal(d.pre.textContent, expected, 'the visible JSON is the same text');
});

test('playground mount: no literal "null" or "undefined" anywhere in the mounted tree', (t) => {
  const d = setup(t);
  button(d.mount, 'Stale cache').fire('click');
  walk(d.mount, (n) => {
    if (n.tag === '#text') assert.doesNotMatch(n.data, /\bnull\b|\bundefined\b/);
    else for (const v of Object.values(n.attrs)) assert.doesNotMatch(v, /^(null|undefined)$/);
  });
  assert.doesNotMatch(d.mount.textContent, /\bnull\b|\bundefined\b/);
});
