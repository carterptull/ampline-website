import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createAmpline } from '../site/js/runtime/ampline.js';
import { startHero } from '../site/js/hero.js';

// Just enough DOM for hero.js and ansi.renderAnsi, installed as globals (hero.js uses the page's document).
function makeEl(tag) {
  const cls = new Set();
  return {
    tag, kids: [], style: {}, inert: false, scrollWidth: 0, clientWidth: 0, _text: '',
    get children() { return this.kids.filter((k) => k.tag !== '#text'); },
    set className(v) { cls.clear(); for (const c of String(v).split(/\s+/)) if (c) cls.add(c); },
    get className() { return [...cls].join(' '); },
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c),
      toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); } },
    setAttribute() {},
    appendChild(c) { if (c.tag === '#fragment') { this.kids.push(...c.kids); c.kids = []; } else this.kids.push(c); return c; },
    append(...cs) { for (const c of cs) this.appendChild(c); },
    replaceChildren(...cs) { this.kids = []; this.append(...cs); },
    set textContent(v) { this._text = String(v); this.kids = []; },
    get textContent() { return this.kids.length ? this.kids.map((k) => k.textContent).join('') : this._text; },
  };
}

function installDom({ hidden }) {
  const listeners = [];
  globalThis.document = {
    hidden,
    createElement: makeEl,
    createDocumentFragment: () => makeEl('#fragment'),
    createTextNode: (data) => ({ tag: '#text', data, get textContent() { return this.data; } }),
    addEventListener: (type, fn) => { if (type === 'visibilitychange') listeners.push(fn); },
  };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  return { setHidden(v) { document.hidden = v; for (const fn of listeners) fn(); } };
}

// Advance in small steps so timers scheduled by other timers (the typing chain) fire too.
const advance = (ms) => { for (let t = 0; t < ms; t += 10) mock.timers.tick(10); };

// The hero wave animates freely, like the nav wave (DECISIONS.md D18): the hero never holds a bar.
// A spy equalizer is still passed in, to prove that even a caller that hands one over sees it untouched.
// Its hold()/release() really toggle the `hold` class on the fake bars, like the real equalizer does, so the
// heldBars() assertions below fail if hero.js ever holds a bar.
function spyEqualizer() {
  const calls = [];
  const bars = Array.from({ length: 20 }, () => makeEl('span'));
  return { calls, bars,
    hold: (i) => { calls.push(['hold', i]); bars.forEach((b, k) => b.classList.toggle('hold', k === i)); },
    release: () => { calls.push(['release']); bars.forEach((b) => b.classList.remove('hold')); } };
}
const heldBars = (eq) => eq.bars.filter((b) => b.classList.contains('hold')).length;

// Counts every repaint of the hero line (each paint replaces its children).
function watchPaints(line) {
  const paints = { n: 0 };
  const orig = line.replaceChildren.bind(line);
  line.replaceChildren = (...cs) => { paints.n++; return orig(...cs); };
  return paints;
}

test('hero: a page that powers up in a hidden tab does not cycle until it becomes visible', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  t.after(() => { mock.timers.reset(); delete globalThis.document; delete globalThis.window; });
  const tab = installDom({ hidden: true });
  const eq = spyEqualizer();
  const line = makeEl('div');
  const paints = watchPaints(line);
  startHero({ amp: createAmpline({ columns: 120 }), equalizer: eq, body: makeEl('div'), line });

  advance(5000); // typing (38ms per character) and the power-up delay are done
  assert.equal(paints.n, 1, 'powered up once');
  assert.ok(line.textContent.length > 0, 'the line is painted');
  assert.equal(line.children.length, 1, 'one wrapper around the segments');
  assert.equal(line.children[0].inert, true, 'the segments sit in an inert wrapper');

  advance(26000);
  assert.equal(paints.n, 1, 'no cycling while the tab is hidden');

  tab.setHidden(false);
  advance(2600);
  assert.equal(paints.n, 2, 'cycling starts once the tab is visible');

  tab.setHidden(true);
  advance(26000);
  assert.equal(paints.n, 2, 'and pauses again when it is hidden');

  assert.deepEqual(eq.calls, [], 'the hero never holds or releases a wave bar');
  assert.equal(heldBars(eq), 0, 'no bar carries the hold class');
});

test('hero: cycling keeps repainting the line while the wave is never held', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  t.after(() => { mock.timers.reset(); delete globalThis.document; delete globalThis.window; });
  installDom({ hidden: false });
  const eq = spyEqualizer();
  const line = makeEl('div');
  const paints = watchPaints(line);
  startHero({ amp: createAmpline({ columns: 120 }), equalizer: eq, body: makeEl('div'), line });

  advance(2000); // typed and powered up (about 1.9s), first cycle step not yet due
  assert.equal(paints.n, 1, 'powered up');
  const seen = new Set([line.textContent]);
  for (let step = 1; step <= 6; step++) {
    advance(2600);
    assert.equal(paints.n, 1 + step, `cycle step ${step} repainted the line`);
    seen.add(line.textContent);
    assert.equal(heldBars(eq), 0, `no held bar after cycle step ${step}`);
  }
  assert.ok(seen.size > 1, 'the cycle shows different models and efforts');
  assert.deepEqual(eq.calls, [], 'no hold() or release() at any point');
});

test('hero: reduced motion powers up once, with no cycling and no held bar', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  t.after(() => { mock.timers.reset(); delete globalThis.document; delete globalThis.window; });
  installDom({ hidden: false });
  globalThis.window.matchMedia = () => ({ matches: true });
  const eq = spyEqualizer();
  const line = makeEl('div');
  const paints = watchPaints(line);
  startHero({ amp: createAmpline({ columns: 120 }), equalizer: eq, body: makeEl('div'), line });

  advance(30000);
  assert.equal(paints.n, 1, 'painted once, never cycled');
  assert.deepEqual(eq.calls, []);
  assert.equal(heldBars(eq), 0);
});
