import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAnsi, renderAnsi } from '../site/js/ansi.js';

test('parses truecolor, bold, dim and reset', () => {
  const t = parseAnsi('\u001b[1m\u001b[38;2;163;45;45m⚠ C97\u001b[0m\u001b[2m ↺ 12m\u001b[0m');
  assert.deepEqual(t, [
    { text: '⚠ C97', fg: [163, 45, 45], bold: true, dim: false, href: null },
    { text: ' ↺ 12m', fg: null, bold: false, dim: true, href: null },
  ]);
});

test('parses OSC 8 links (BEL-terminated) inside a color span', () => {
  const t = parseAnsi('\u001b[38;2;96;200;120m\u001b]8;;https://github.com/a/b/pull/1\u0007#1\u001b]8;;\u0007\u001b[0m');
  assert.deepEqual(t, [{ text: '#1', fg: [96, 200, 120], bold: false, dim: false, href: 'https://github.com/a/b/pull/1' }]);
});

test('keeps newlines (two-line layout) and drops unknown escapes', () => {
  const t = parseAnsi('a\n\u001b[5mb');
  assert.equal(t.map((x) => x.text).join(''), 'a\nb');
});

function fakeDoc() {
  const calls = { innerHTML: 0, setAttributeStyle: 0 };
  const mk = (tag) => {
    const el = { tag, children: [], style: {}, className: '', textContent: '', attrs: {},
      appendChild(c) { this.children.push(c); return c; },
      setAttribute(k, v) { if (k === 'style') calls.setAttributeStyle++; this.attrs[k] = v; },
      set innerHTML(_) { calls.innerHTML++; } };
    return el;
  };
  return { calls, createElement: mk, createDocumentFragment: () => mk('#fragment') };
}

test('renderAnsi builds spans with CSSOM color, never innerHTML/style attributes', () => {
  const doc = fakeDoc();
  const frag = renderAnsi(parseAnsi('\u001b[1m\u001b[38;2;232;67;61mC90 x\u001b[0m'), doc, { safeLinkUrl: () => null });
  const span = frag.children[0];
  assert.equal(span.textContent, 'C90 x');
  assert.equal(span.style.color, 'rgb(232, 67, 61)');
  assert.equal(span.style.fontWeight, '700');
  assert.equal(doc.calls.innerHTML, 0);
  assert.equal(doc.calls.setAttributeStyle, 0);
});

test('links become <a> only when safeLinkUrl approves', () => {
  const tokens = parseAnsi('\u001b]8;;javascript:alert(1)\u0007#1\u001b]8;;\u0007');
  const doc = fakeDoc();
  const frag = renderAnsi(tokens, doc, { safeLinkUrl: () => null });
  assert.equal(frag.children[0].tag, 'span');
  const ok = renderAnsi(parseAnsi('\u001b]8;;https://x.test/1\u0007#1\u001b]8;;\u0007'), fakeDoc(), { safeLinkUrl: (u) => u });
  assert.equal(ok.children[0].tag, 'a');
  assert.equal(ok.children[0].attrs.rel, 'noopener noreferrer');
});
