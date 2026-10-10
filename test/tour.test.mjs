import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAmpline } from '../site/js/runtime/ampline.js';
import { renderTour, watchScrollable } from '../site/js/tour.js';
import { parseAnsi } from '../site/js/ansi.js';
import { statusPayload, subagentPayload } from '../site/js/payloads.js';

// Minimal DOM stand-in: just what tour.js and ansi.renderAnsi call.
function makeDoc() {
  const mk = (tag) => {
    const el = {
      tag, children: [], attrs: {}, style: {}, className: '', _text: null,
      appendChild(c) { this.children.push(c); return c; },
      append(...cs) { for (const c of cs) this.children.push(typeof c === 'string' ? { tag: '#text', text: c } : c); },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      set textContent(v) { this._text = String(v); },
      get textContent() { return this._text !== null ? this._text : this.children.map((c) => (c.tag === '#text' ? c.text : c.textContent)).join(''); },
    };
    return el;
  };
  return {
    createElement: mk,
    createTextNode: (text) => ({ tag: '#text', text, get textContent() { return text; } }),
    // A fragment splices its children into the parent on appendChild, like the real one.
    createDocumentFragment: () => { const f = mk('#fragment'); return f; },
  };
}
// Wrap appendChild so appending a fragment moves its children (real DOM semantics).
function realisticDoc() {
  const doc = makeDoc();
  const create = doc.createElement;
  const patch = (el) => {
    const orig = el.appendChild;
    el.appendChild = function (c) {
      if (c.tag === '#fragment') { for (const k of c.children) orig.call(this, k); c.children = []; return c; }
      return orig.call(this, c);
    };
    return el;
  };
  doc.createElement = (t) => patch(create(t));
  const frag = doc.createDocumentFragment;
  doc.createDocumentFragment = () => patch(frag());
  return doc;
}

const find = (el, pred, out = []) => { if (pred(el)) out.push(el); for (const c of el.children || []) find(c, pred, out); return out; };
const byClass = (el, cls) => find(el, (e) => (e.className || '').split(' ').includes(cls));

function run() {
  const doc = realisticDoc();
  const mount = doc.createElement('div');
  const amp = createAmpline({ columns: 500 });
  renderTour({ amp, mount, doc });
  return { mount, amp };
}
const sample = (card) => byClass(card, 's')[0].textContent.replace(/\s{3,}/g, '|');
const plain = (amp, ansi) => amp.stripAnsi(ansi);

test('renders 7 segment cards plus a wide subagent card, in order', () => {
  const { mount } = run();
  assert.equal(mount.children.length, 8);
  mount.children.forEach((c, i) => assert.equal(c.tag, 'article', `card ${i}`));
  const titles = mount.children.map((c) => find(c, (e) => e.tag === 'h3')[0].textContent);
  assert.deepEqual(titles, ['Model · effort', 'Context window', '5-hour + weekly limits', 'Git', 'Cost + lines', 'PR / MR', 'Current task', 'Subagents get their own lines']);
  const wide = mount.children.filter((c) => c.className.split(' ').includes('span2'));
  assert.equal(wide.length, 1);
  assert.equal(wide[0], mount.children[7]);
  for (const c of mount.children) {
    assert.equal(byClass(c, 's').length, 1);
    assert.equal(byClass(c, 'd').length, 1);
  }
});

test('each card sample is exactly what the real renderer prints for that single segment', () => {
  const { mount } = run();
  const texts = mount.children.map((c) => byClass(c, 's')[0].textContent);
  assert.match(texts[0], /^Opus 5\.5 · xhigh$/);
  assert.equal(texts[1], 'C63 █████░░░');
  assert.match(texts[2], /^H24 ██░░░░░░ ↺ 2h1\dm │ W41 ███░░░░░ ↺ 3d4h$/);
  assert.equal(texts[3], '⎇ feat/cache-layer ↑2↓1 ●');
  assert.equal(texts[4], '$1.87 +156/-23');
  assert.equal(texts[5], '#1234   !42');
  assert.equal(texts[6], 'Refactor the bar renderer');
  assert.equal(texts[7], '↳ Explore the cache layer haiku 8.4k\n↳ Review the diff sonnet 120.4k\n↳ Write tests opus 2.4M');
});

test('PR and MR render as safe, colored links; no other card has links', () => {
  const { mount } = run();
  const links = (card) => find(card, (e) => e.tag === 'a');
  const [pr, mr] = links(mount.children[5]);
  assert.equal(pr.textContent, '#1234');
  assert.match(pr.attrs.href, /^https:\/\/github\.com\/.+\/pull\/1234$/);
  assert.equal(pr.attrs.rel, 'noopener noreferrer');
  assert.equal(pr.style.color, 'rgb(96, 200, 120)', 'approved is green');
  assert.equal(mr.textContent, '!42');
  assert.match(mr.attrs.href, /^https:\/\/gitlab\.com\/.+\/merge_requests\/42$/);
  assert.equal(mr.attrs.rel, 'noopener noreferrer');
  assert.equal(mr.style.color, 'rgb(245, 196, 61)', 'pending is yellow');
  mount.children.forEach((c, i) => { if (i !== 5) assert.equal(links(c).length, 0, `card ${i}`); });
});

test('glyph-bearing samples keep their colors and dim styling from the runtime', () => {
  const { mount } = run();
  const spans = (i) => find(byClass(mount.children[i], 's')[0], (e) => e.tag === 'span');
  const ctx = spans(1)[0];
  assert.equal(ctx.style.color, 'rgb(245, 196, 61)');
  const branch = spans(3)[0];
  assert.equal(branch.className, 'ansi-dim');
  assert.equal(branch.textContent, '⎇ feat/cache-layer');
  assert.equal(spans(4).filter((s) => s.className === 'ansi-dim').map((s) => s.textContent).join(''), '$1.87/');
});

test('descriptions state the accuracy rules', () => {
  const { mount } = run();
  const d = mount.children.map((c) => byClass(c, 'd')[0].textContent);
  assert.match(d[0], /20-step wheel/); assert.match(d[0], /only max goes bold/);
  assert.match(d[1], /last completed API call/); assert.match(d[1], /85%/); assert.match(d[1], /95%/);
  assert.match(d[2], /Claude\.ai subscription/); assert.match(d[2], /countdown/);
  assert.match(d[4], /estimate/); assert.match(d[4], /not your bill/i);
  assert.match(d[5], /Claude Code/); assert.match(d[5], /gh/); assert.match(d[5], /glab/); assert.match(d[5], /mergeable/);
  for (const t of d) assert.doesNotMatch(t, /official|endorsed/i);
});

test('the tour leaves its dedicated instance back on the default config', () => {
  const { amp } = run();
  const fresh = createAmpline({ columns: 500 });
  assert.deepEqual(amp.getConfig(), fresh.getConfig());
  const input = statusPayload({ now: 1_800_000_000_000 }); // full payload: every default segment renders
  assert.equal(plain(amp, amp.renderStatusline(input)), plain(fresh, fresh.renderStatusline(input)));
});

test('every card heading has a stable unique id', () => {
  const { mount } = run();
  const ids = mount.children.map((c) => find(c, (e) => e.tag === 'h3')[0].attrs.id);
  assert.deepEqual(ids, ['tour-h-0', 'tour-h-1', 'tour-h-2', 'tour-h-3', 'tour-h-4', 'tour-h-5', 'tour-h-6', 'tour-h-7']);
});

test('no tour card has a token that is both dim and colored (dim is a solid class color that inline color would override)', () => {
  const amp = createAmpline({ columns: 500 });
  const lines = [];
  const seg = (s, p) => { amp.setConfig({ segments: s, line2From: s[0] }); lines.push(amp.renderStatusline(statusPayload(p))); };
  seg(['model'], { family: 'opus', effort: 'xhigh' }); seg(['context'], { context: 63 }); seg(['fiveHour', 'weekly'], { fiveHour: 24, weekly: 41 });
  seg(['git'], {}); seg(['cost'], {}); seg(['pr'], { pr: { number: 1234, review_state: 'approved' } });
  seg(['pr'], { pr: { kind: 'mr', number: 42, review_state: 'pending' } }); seg(['task'], {});
  amp.setConfig({}); lines.push(amp.renderSubagentLine(subagentPayload({ columns: 100 })));
  let tokens = 0;
  for (const l of lines) for (const t of parseAnsi(l)) { tokens++; assert.ok(!(t.dim && t.fg), `dim+fg token: ${JSON.stringify(t)}`); }
  assert.ok(tokens > 20);
});

test('watchScrollable flags overflowing samples (fade, focus, name) and re-checks on resize, one frame at a time', () => {
  const mk = (sw, cw, hid) => {
    const a = new Set(); const at = {};
    return { scrollWidth: sw, clientWidth: cw, a, at, previousElementSibling: { id: hid },
      classList: { toggle: (c, on) => (on ? a.add(c) : a.delete(c)) }, setAttribute: (k, v) => { at[k] = v; }, removeAttribute: (k) => { delete at[k]; } };
  };
  const wide = mk(336, 283, 'tour-h-2'); const narrow = mk(200, 283, 'tour-h-3');
  const listeners = {}; const frames = [];
  const win = { addEventListener: (t, f) => { listeners[t] = f; }, requestAnimationFrame: (f) => { frames.push(f); return frames.length; }, document: {} };
  watchScrollable({ querySelectorAll: () => [wide, narrow] }, win);
  assert.ok(wide.a.has('is-scrollable'));
  assert.deepEqual(wide.at, { tabindex: '0', role: 'group', 'aria-labelledby': 'tour-h-2' });
  assert.ok(!narrow.a.has('is-scrollable')); assert.deepEqual(narrow.at, {});
  wide.clientWidth = 400;
  listeners.resize(); listeners.resize(); listeners.resize();
  assert.equal(frames.length, 1, 'resize bursts schedule a single frame');
  assert.ok(wide.a.has('is-scrollable'), 'not re-measured before the frame runs');
  frames.shift()();
  assert.ok(!wide.a.has('is-scrollable')); assert.deepEqual(wide.at, {}, 'tabindex, role and name removed together');
  listeners.resize();
  assert.equal(frames.length, 1, 'a new frame can be scheduled after the previous ran');
});
