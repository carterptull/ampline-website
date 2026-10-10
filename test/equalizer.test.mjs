import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// A tiny fake DOM: just enough surface for mountEqualizer.
function fakeClassList() {
  const set = new Set();
  return {
    set,
    add: (c) => void set.add(c),
    remove: (c) => void set.delete(c),
    toggle(c, force) {
      const on = force === undefined ? !set.has(c) : !!force;
      if (on) set.add(c); else set.delete(c);
      return on;
    },
    contains: (c) => set.has(c),
  };
}
function fakeEl() {
  const props = new Map();
  const calls = [];
  return {
    children: [],
    classList: fakeClassList(),
    style: {
      setProperty(k, v) { props.set(k, v); calls.push([k, v]); },
      props,
      calls,
    },
    appendChild(c) { this.children.push(c); return c; },
    setAttribute() { throw new Error('setAttribute must not be used'); },
    set innerHTML(_v) { throw new Error('innerHTML must not be used'); },
  };
}

const realDocument = globalThis.document;
let mountEqualizer, SNAPSHOT;
const SPEC = [0.30, 0.42, 0.58, 0.74, 0.88, 0.97, 1.00, 0.95, 0.84, 0.70, 0.55, 0.42, 0.33, 0.28, 0.30, 0.38, 0.50, 0.64, 0.78, 0.90];
const wheel = Array.from({ length: 20 }, (_, i) => [i * 10, 255 - i * 5, (i * 37) % 256]);

before(async () => {
  globalThis.document = { createElement: () => fakeEl() };
  ({ mountEqualizer, SNAPSHOT } = await import('../site/js/equalizer.js'));
});
after(() => {
  if (realDocument === undefined) delete globalThis.document;
  else globalThis.document = realDocument;
});

test('SNAPSHOT is the 20-entry spec array', () => {
  assert.equal(SNAPSHOT.length, 20);
  assert.deepEqual(SNAPSHOT, SPEC);
});

test('mounts one bar per wheel entry with --c, --i and --snap', () => {
  const c = fakeEl();
  const eq = mountEqualizer(c, wheel, { size: 'hero' });
  assert.equal(eq.bars.length, 20);
  assert.equal(c.children.length, 20);
  eq.bars.forEach((bar, i) => {
    const [r, g, b] = wheel[i];
    assert.equal(bar.style.props.get('--c'), `rgb(${r}, ${g}, ${b})`);
    assert.equal(bar.style.props.get('--i'), String(i));
    assert.equal(bar.style.props.get('--snap'), String(SPEC[i]));
  });
});

test('container gets vu-hero / vu-nav by size, hero by default', () => {
  const hero = fakeEl(); mountEqualizer(hero, wheel, { size: 'hero' });
  const nav = fakeEl(); mountEqualizer(nav, wheel, { size: 'nav' });
  const dflt = fakeEl(); mountEqualizer(dflt, wheel);
  assert.ok(hero.classList.contains('vu-hero'));
  assert.ok(nav.classList.contains('vu-nav'));
  assert.ok(!nav.classList.contains('vu-hero'));
  assert.ok(dflt.classList.contains('vu-hero'));
});

test('hold(i) leaves exactly bar i held; release() clears all', () => {
  const eq = mountEqualizer(fakeEl(), wheel, { size: 'hero' });
  const held = () => eq.bars.flatMap((b, j) => (b.classList.contains('hold') ? [j] : []));
  eq.hold(7);
  assert.deepEqual(held(), [7]);
  eq.hold(3);
  assert.deepEqual(held(), [3]);
  eq.release();
  assert.deepEqual(held(), []);
});

test('colors are set only through style.setProperty', () => {
  const eq = mountEqualizer(fakeEl(), wheel, { size: 'nav' });
  for (const bar of eq.bars) assert.deepEqual(bar.style.calls.map(([k]) => k), ['--c', '--i', '--snap']);
  const src = readFileSync(new URL('../site/js/equalizer.js', import.meta.url), 'utf8');
  assert.ok(!/innerHTML|setAttribute|cssText|insertAdjacentHTML/.test(src));
});
