import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const SITE = new URL('../site/', import.meta.url);
const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const pages = ['index.html', '404.html', 'og-card.html'].map((f) => [f, readFileSync(new URL(f, SITE), 'utf8')]);
const css = readdirSync(new URL('css/', SITE)).map((f) => readFileSync(new URL(`css/${f}`, SITE), 'utf8')).join('\n');
const js = readdirSync(new URL('js/', SITE), { recursive: true }).filter((f) => f.endsWith('.js'))
  .map((f) => [f, readFileSync(new URL(`js/${f}`, SITE), 'utf8')]);

// og-card.html is the social-card render target: it must be CSP-clean, but it is not a content page
// (no disclaimer, footer, version or JSON-LD).
const CARD = 'og-card.html';

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
  test(`${name}: no temporary data: placeholders (real icon links only)`, () => {
    assert.doesNotMatch(html, /href="data:/i);
  });
  test(`${name}: every same-origin resource it loads exists in site/`, () => {
    for (const tag of html.match(/<(link|script|img|source)\b[^>]*>/gi) || []) {
      const ref = tag.match(/\b(?:href|src)="(\/[^/"][^"]*)"/);
      if (!ref) continue;
      assert.ok(existsSync(new URL(`.${ref[1]}`, SITE)), `missing file for ${tag}`);
    }
  });
  if (name === CARD) continue;
  test(`${name}: lang, viewport, theme-color, disclaimer`, () => {
    assert.match(html, /<html lang="en"/);
    assert.match(html, /name="viewport"/);
    assert.match(html, /name="theme-color" content="#000000"/);
    assert.match(html, /not affiliated with, endorsed by, or sponsored by Anthropic, PBC/);
  });
  test(`${name}: target=_blank links carry rel=noopener`, () => {
    for (const a of html.match(/<a\b[^>]*target="_blank"[^>]*>/gi) || []) assert.match(a, /rel="noopener noreferrer"/);
  });
  test(`${name}: footer shows the site version from package.json`, () => {
    const m = html.match(/<span class="ver" id="siteVersion">([^<]*)<\/span>/);
    assert.ok(m, 'footer site version missing');
    assert.equal(m[1], `v${PKG.version}`);
  });
  test(`${name}: static ampline-claude version matches the pinned devDependency`, () => {
    // main.js overwrites it from the runtime; this is what shows without JS (and on 404.html)
    const m = html.match(/<span id="ampVersion">([^<]*)<\/span>/);
    assert.ok(m, 'ampVersion missing');
    assert.equal(m[1], PKG.devDependencies['ampline-claude']);
  });
}

test('og-card.html is marked noindex (the card is a render target, not a page)', () => {
  assert.match(pages.find(([n]) => n === CARD)[1], /name="robots" content="noindex"/);
});

const footerOf = (html) => (html.match(/<footer\b[\s\S]*?<\/footer>/) || [''])[0];

test('404.html footer mirrors index.html footer exactly', () => {
  const index = footerOf(pages[0][1]);
  assert.ok(index.includes('https://buymeacoffee.com/paymonsoftware'), 'Buy Me a Beer pill missing');
  assert.equal(footerOf(pages[1][1]), index);
});

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
  assert.equal(data.operatingSystem, undefined); // no OS claim until macOS is verified
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

// The body of an at-rule block, by brace matching (no CSS parser).
const atBlock = (src, header) => {
  const start = src.indexOf(header);
  assert.ok(start >= 0, `${header} block missing`);
  let i = src.indexOf('{', start) + 1, depth = 1;
  const from = i;
  while (depth && i < src.length) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; }
  return src.slice(from, i - 1);
};

test('touch: every tour sample is at least 44px tall (an overflowing one is a focusable scroll region)', () => {
  const site = readFileSync(new URL('css/site.css', SITE), 'utf8');
  assert.match(atBlock(site, '@media (pointer: coarse)'), /(^|[\s}])\.card \.s \{[^}]*min-height: 44px/);
});
