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

test('hero: a page that powers up in a hidden tab does not cycle until it becomes visible', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  t.after(() => { mock.timers.reset(); delete globalThis.document; delete globalThis.window; });
  const tab = installDom({ hidden: true });
  const holds = [];
  const line = makeEl('div');
  startHero({ amp: createAmpline({ columns: 120 }), equalizer: { hold: (i) => holds.push(i) }, body: makeEl('div'), line });

  advance(5000); // typing (38ms per character) and the power-up delay are done
  assert.equal(holds.length, 1, 'powered up once');
  assert.ok(line.textContent.length > 0, 'the line is painted');
  assert.equal(line.children.length, 1, 'one wrapper around the segments');
  assert.equal(line.children[0].inert, true, 'the segments sit in an inert wrapper');

  advance(26000);
  assert.equal(holds.length, 1, 'no cycling while the tab is hidden');

  tab.setHidden(false);
  advance(2600);
  assert.equal(holds.length, 2, 'cycling starts once the tab is visible');

  tab.setHidden(true);
  advance(26000);
  assert.equal(holds.length, 2, 'and pauses again when it is hidden');
});
