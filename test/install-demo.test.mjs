import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAmpline } from '../site/js/runtime/ampline.js';
import { statusPayload } from '../site/js/payloads.js';
import { mountInstallDemo, INSTALL_TRANSCRIPT, INSTALL_COMMAND } from '../site/js/install-demo.js';

// Just enough DOM for install-demo.js, playground.h and ansi.renderAnsi, passed in as `doc` / `win`.
function makeEl(tag) {
  const cls = new Set();
  const attrs = {};
  const listeners = {};
  return {
    tag, kids: [], style: {}, inert: false, hidden: false, scrollWidth: 0, clientWidth: 0, _text: '', attrs, listeners,
    get children() { return this.kids.filter((k) => k.tag !== '#text'); },
    set className(v) { cls.clear(); for (const c of String(v).split(/\s+/)) if (c) cls.add(c); },
    get className() { return [...cls].join(' '); },
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c),
      toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); } },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return k in attrs ? attrs[k] : null; },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    appendChild(c) { if (c.tag === '#fragment') { this.kids.push(...c.kids); c.kids = []; } else this.kids.push(c); return c; },
    append(...cs) { for (const c of cs) this.appendChild(c); },
    replaceChildren(...cs) { this.kids = []; this.append(...cs); },
    set textContent(v) { this._text = String(v); this.kids = []; },
    get textContent() { return this.kids.length ? this.kids.map((k) => k.textContent).join('') : this._text; },
    set innerHTML(v) { throw new Error('innerHTML is forbidden'); },
  };
}

function walk(node, fn) { fn(node); for (const k of node.kids || []) walk(k, fn); }
function findAll(root, pred) { const out = []; walk(root, (n) => { if (n.tag !== '#text' && pred(n)) out.push(n); }); return out; }
const byClass = (root, c) => findAll(root, (n) => n.classList && n.classList.contains(c));

function setup(t, { reduced = false, hidden = false, io = false } = {}) {
  mock.timers.enable({ apis: ['setTimeout'] });
  const realSetTimeout = globalThis.setTimeout;
  const timers = { n: 0 };
  globalThis.setTimeout = (...a) => { timers.n++; return realSetTimeout(...a); };
  t.after(() => { globalThis.setTimeout = realSetTimeout; mock.timers.reset(); });

  const vis = [];
  const doc = {
    hidden,
    createElement: makeEl,
    createDocumentFragment: () => makeEl('#fragment'),
    createTextNode: (data) => ({ tag: '#text', data, get textContent() { return this.data; } }),
    addEventListener: (type, fn) => { if (type === 'visibilitychange') vis.push(fn); },
  };
  const observers = [];
  const win = { document: doc, matchMedia: () => ({ matches: reduced }) };
  if (io) {
    win.IntersectionObserver = class {
      constructor(cb, opts) { this.cb = cb; this.opts = opts; this.observed = []; this.disconnected = false; observers.push(this); }
      observe(el) { this.observed.push(el); }
      disconnect() { this.disconnected = true; }
    };
  }
  const mount = makeEl('div');
  const amp = createAmpline({ columns: 120 });
  const api = mountInstallDemo({ amp, mount, win, doc });
  const figure = mount.children.find((c) => c.tag === 'figure');
  return {
    amp, mount, api, figure, timers, observers,
    body: byClass(figure, 'term-body')[0],
    sl: byClass(figure, 'sl')[0],
    replay: findAll(mount, (n) => n.tag === 'button')[0],
    setHidden(v) { doc.hidden = v; for (const fn of vis) fn(); },
  };
}

// Advance in small steps so timers scheduled by other timers (the typing chain) fire too.
const advance = (ms) => { for (let t = 0; t < ms; t += 10) mock.timers.tick(10); };
const FULL = 8000;
const FINAL_BODY = `$ ${INSTALL_COMMAND}\n${INSTALL_TRANSCRIPT.join('\n')}\n$ claude`;

test('install demo: types the command, prints the captured lines, then lights the runtime statusline', (t) => {
  const d = setup(t);
  assert.equal(d.body.textContent, '$ ', 'a bare prompt before typing starts');
  advance(600);
  assert.ok(d.body.textContent.startsWith('$ npx'), 'the command is being typed');
  assert.ok(d.body.textContent.length < FINAL_BODY.length, 'the script is still running');
  assert.ok(d.sl.classList.contains('sl-off'), 'the statusline is still dark');

  advance(FULL);
  assert.equal(d.body.textContent, FINAL_BODY);
  assert.equal(byClass(d.body, 'caret').length, 0, 'no caret left behind');
  assert.equal(d.sl.classList.contains('sl-off'), false, 'the statusline is lit');
  assert.ok(byClass(d.sl, 'seg-in').length > 0, 'segments power up with the stagger');
  assert.equal(d.sl.children.length, 1);
  assert.equal(d.sl.children[0].inert, true, 'segments sit in an inert wrapper, like the hero');
  const expected = d.amp.stripAnsi(d.amp.renderStatusline(statusPayload()));
  assert.equal(d.sl.textContent, expected, 'statusline text is the runtime output');
  assert.equal(d.sl.attrs.tabindex, '-1');
});

test('install demo: the animated terminal is hidden from assistive tech and a static paragraph carries the text', (t) => {
  const d = setup(t);
  assert.equal(d.figure.attrs['aria-hidden'], 'true');
  const sr = byClass(d.mount, 'visually-hidden');
  assert.equal(sr.length, 1);
  assert.ok(sr[0].textContent.includes(INSTALL_COMMAND));
  assert.ok(sr[0].textContent.includes('ampline-claude installed.'));
  assert.equal(sr[0].attrs['aria-live'], undefined);
  assert.equal(d.replay.className, 'copy');
  assert.equal(d.replay.attrs.type, 'button');
  assert.equal(d.replay.textContent, 'Replay');
});

test('install demo: reduced motion renders the final state at once, with no timers and no Replay', (t) => {
  const d = setup(t, { reduced: true, io: true });
  assert.equal(d.timers.n, 0, 'no timers were scheduled');
  assert.equal(d.body.textContent, FINAL_BODY);
  assert.equal(d.sl.classList.contains('sl-off'), false);
  assert.equal(byClass(d.sl, 'seg-in').length, 0, 'no stagger animation');
  assert.equal(d.sl.textContent, d.amp.stripAnsi(d.amp.renderStatusline(statusPayload())));
  assert.equal(d.replay.hidden, true);
  assert.equal(d.observers.length, 0, 'no observer either');
  advance(FULL);
  assert.equal(d.timers.n, 0);
});

test('install demo: Replay restarts cleanly, mid-run and after the end, without duplicate output', (t) => {
  const d = setup(t);
  advance(1500);
  const partial = d.body.textContent;
  assert.ok(partial.length > 2 && partial.length < FINAL_BODY.length);
  d.replay.listeners.click[0]();
  assert.equal(d.body.textContent, '$ ', 'restarted from a bare prompt');
  assert.ok(d.sl.classList.contains('sl-off'));
  assert.equal(d.sl.children.length, 0);
  advance(FULL);
  assert.equal(d.body.textContent, FINAL_BODY, 'one clean run, no leftovers from the first');
  assert.equal(d.sl.children.length, 1);

  d.replay.listeners.click[0]();
  advance(FULL);
  assert.equal(d.body.textContent, FINAL_BODY);
  assert.equal(d.sl.children.length, 1);
  assert.equal(byClass(d.body, 'caret').length, 0);
});

test('install demo: pauses while the tab is hidden and resumes when it is visible again', (t) => {
  const d = setup(t);
  advance(1500);
  const before = d.body.textContent;
  d.setHidden(true);
  advance(20000);
  assert.equal(d.body.textContent, before, 'no progress while hidden');
  d.setHidden(false);
  advance(FULL);
  assert.equal(d.body.textContent, FINAL_BODY);
  assert.equal(d.sl.classList.contains('sl-off'), false);
});

test('install demo: a page opened in a hidden tab waits for visibility before playing', (t) => {
  const d = setup(t, { hidden: true });
  advance(FULL);
  assert.equal(d.body.textContent, '$ ', 'only the bare prompt, nothing typed');
  d.setHidden(false);
  advance(FULL);
  assert.equal(d.body.textContent, FINAL_BODY);
});

test('install demo: with an IntersectionObserver it plays once, when ~40% is visible', (t) => {
  const d = setup(t, { io: true });
  assert.equal(d.observers.length, 1);
  const io = d.observers[0];
  assert.deepEqual(io.observed, [d.figure]);
  assert.equal(io.opts.threshold, 0.4);
  advance(FULL);
  assert.equal(d.timers.n, 0, 'nothing is scheduled before it scrolls into view');

  io.cb([{ isIntersecting: false }]);
  advance(FULL);
  assert.equal(d.timers.n, 0, 'not intersecting yet');

  io.cb([{ isIntersecting: true }]);
  assert.equal(io.disconnected, true, 'it plays once');
  advance(FULL);
  assert.equal(d.body.textContent, FINAL_BODY);
});

test('install demo: no IntersectionObserver means it plays immediately', (t) => {
  const d = setup(t, { io: false });
  advance(FULL);
  assert.equal(d.body.textContent, FINAL_BODY);
});

test('install demo: the module writes no markup', () => {
  const src = readFileSync(new URL('../site/js/install-demo.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /innerHTML|insertAdjacentHTML|outerHTML/);
  assert.doesNotMatch(src, /setAttribute\(\s*['"]style['"]/);
});

test('install demo: the transcript is the six captured lines', () => {
  assert.equal(INSTALL_TRANSCRIPT.length, 6);
  assert.equal(INSTALL_TRANSCRIPT[0], '✓ ampline-claude installed.');
  assert.equal(INSTALL_COMMAND, 'npx ampline-claude --install');
});

test('index.html: the install section sits between the hero and the tour and carries the command without JS', () => {
  const html = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
  const at = html.indexOf('id="install"');
  assert.ok(at > html.indexOf('</header>') && at < html.indexOf('id="features"'));
  const section = html.slice(at, html.indexOf('</section>', at));
  assert.match(section, /aria-labelledby="install-h"|<h2 id="install-h">One command\.<\/h2>/);
  assert.ok(section.includes(`<code>${INSTALL_COMMAND}</code>`));
  assert.ok(section.includes('id="installMount"'));
  assert.ok(section.includes('Undo any time: <code>npx ampline-claude uninstall</code> (backs up your settings first).'));
});
