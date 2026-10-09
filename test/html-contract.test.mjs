import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const SITE = new URL('../site/', import.meta.url);
const pages = ['index.html', '404.html'].map((f) => [f, readFileSync(new URL(f, SITE), 'utf8')]);
const css = readdirSync(new URL('css/', SITE)).map((f) => readFileSync(new URL(`css/${f}`, SITE), 'utf8')).join('\n');
const js = readdirSync(new URL('js/', SITE), { recursive: true }).filter((f) => f.endsWith('.js'))
  .map((f) => [f, readFileSync(new URL(`js/${f}`, SITE), 'utf8')]);

for (const [name, html] of pages) {
  test(`${name}: no inline event handlers or style attributes (CSP)`, () => {
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
    assert.doesNotMatch(html, /\sstyle\s*=/i);
  });
  test(`${name}: every <script> is same-origin or JSON-LD`, () => {
    for (const tag of html.match(/<script\b[^>]*>/gi) || []) {
      assert.ok(/\bsrc="\/[^/]/.test(tag) || /type="application\/ld\+json"/.test(tag), `bad script tag: ${tag}`);
    }
  });
  test(`${name}: no third-party stylesheets, scripts, fonts or images`, () => {
    // <link rel="canonical"> is a URL, not a fetch, so only resource-loading tags are checked
    for (const tag of html.match(/<(link|script|img|source|iframe|video|audio)\b[^>]*>/gi) || []) {
      if (/rel="canonical"/.test(tag)) continue;
      assert.doesNotMatch(tag, /(href|src)="(https?:)?\/\//i, `third-party resource: ${tag}`);
    }
  });
  test(`${name}: lang, viewport, theme-color, disclaimer`, () => {
    assert.match(html, /<html lang="en"/);
    assert.match(html, /name="viewport"/);
    assert.match(html, /name="theme-color" content="#000000"/);
    assert.match(html, /not affiliated with, endorsed by, or sponsored by Anthropic, PBC/);
  });
  test(`${name}: target=_blank links carry rel=noopener`, () => {
    for (const a of html.match(/<a\b[^>]*target="_blank"[^>]*>/gi) || []) assert.match(a, /rel="noopener noreferrer"/);
  });
}

test('index.html: SEO + social meta present', () => {
  const html = pages[0][1];
  for (const re of [/<title>ampline · a statusline for Claude Code<\/title>/, /name="description"/, /rel="canonical" href="https:\/\/ampline\.js\.org\/"/,
    /property="og:image" content="https:\/\/ampline\.js\.org\/og\.png"/, /name="twitter:card" content="summary_large_image"/,
    /Paymon Software/]) assert.match(html, re);
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(ld, 'JSON-LD missing');
  const data = JSON.parse(ld[1]);
  assert.equal(data['@type'], 'SoftwareApplication');
  assert.equal(data.aggregateRating, undefined); // never invent ratings
});

test('CSS loads no remote resources', () => {
  assert.doesNotMatch(css, /url\(\s*['"]?(https?:)?\/\//i);
  assert.doesNotMatch(css, /@import/i);
});

test('site JS never writes markup or style attributes', () => {
  for (const [name, src] of js) {
    if (name.endsWith('factories.generated.js')) continue; // vendored, emits strings only
    assert.doesNotMatch(src, /\.innerHTML\s*=|insertAdjacentHTML|outerHTML\s*=/, `${name} writes HTML`);
    assert.doesNotMatch(src, /setAttribute\(\s*['"]style['"]/, `${name} sets style attribute`);
    assert.doesNotMatch(src, /\beval\(|new Function\(/, `${name} uses eval`);
  }
});
