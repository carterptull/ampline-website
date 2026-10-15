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
  assert.equal(data.operatingSystem, "macOS, Linux, Windows"); // verified on real hardware (D19)
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

test('index.html: the features section says which samples use stand-in data', () => {
  const html = pages[0][1];
  assert.match(html, /<p class="note">Git and task samples use stand-in data with the real formatting; every other segment runs ampline's own code on a sample payload\.<\/p>/);
});

// Accuracy of the under-the-hood copy: ampline also runs one cached `git status`, reads .git/HEAD,
// its own config and the session todo file, so "reads only the JSON" would be false.
test('index.html: under-the-hood copy does not overclaim what ampline reads', () => {
  const html = pages.find(([n]) => n === 'index.html')[1];
  assert.doesNotMatch(html, /Reads only the JSON/);
  assert.doesNotMatch(html, /repo config/);
  assert.ok(html.includes('Reads the JSON Claude Code pipes in, plus local git and todo files. Never reads credentials, never makes a network request.'));
  assert.ok(html.includes('Branch names, todo text and labels are sanitized before they reach your terminal.'));
});

test('index.html: the hero figcaption says what the statusline contains', () => {
  const html = pages.find(([n]) => n === 'index.html')[1];
  const cap = html.match(/<figcaption[^>]*id="heroCaption"[^>]*>([^<]*)<\/figcaption>/)?.[1] || '';
  for (const word of ['model and effort', 'context', '5-hour and weekly usage', 'git branch', 'session cost', 'current task']) {
    assert.ok(cap.includes(word), `heroCaption should mention "${word}"`);
  }
});

// #heroSl is an aria-hidden scroll box. Chrome makes overflowing scrollers keyboard-focusable
// (it did at 390px), which would put an aria-hidden element in the tab order.
test('index.html: the decorative hero statusline is out of the tab order', () => {
  const html = pages.find(([n]) => n === 'index.html')[1];
  const tag = html.match(/<div\b[^>]*id="heroSl"[^>]*>/)?.[0] || '';
  assert.match(tag, /\btabindex="-1"/);
  assert.match(tag, /\baria-hidden="true"/);
});

test('index.html: a noscript note tells no-JS visitors the demos need JavaScript', () => {
  const html = pages.find(([n]) => n === 'index.html')[1];
  const m = html.match(/<noscript>([\s\S]*?)<\/noscript>/);
  assert.ok(m, 'missing <noscript>');
  assert.ok(m[1].includes("ampline's demos run in your browser and need JavaScript. The page text below still works without it."));
  assert.ok(html.indexOf('<noscript>') > html.indexOf('<main'), 'noscript note lives inside <main>');
  assert.ok(html.indexOf('<noscript>') < html.indexOf('id="features"'), 'and near the top of it');
});

// connect-src is 'self' so Lighthouse's in-page fetch of /robots.txt works (DECISIONS.md D17). That is only
// safe while no site code opens a connection of its own, so the next test guards the code and this one the header.
const CSP = (() => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const value = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy').value;
  return Object.fromEntries(value.split(';').map((d) => d.trim()).filter(Boolean).map((d) => { const [name, ...vals] = d.split(/\s+/); return [name, vals]; }));
})();

test("CSP: connect-src is exactly 'self' and no directive allows a remote host or unsafe keyword", () => {
  assert.deepEqual(CSP['connect-src'], ["'self'"]);
  assert.deepEqual(CSP['default-src'], ["'none'"]);
  for (const [name, vals] of Object.entries(CSP)) {
    for (const v of vals) {
      assert.doesNotMatch(v, /^(https?:|wss?:|\*)/i, `${name} allows ${v}`);
      assert.doesNotMatch(v, /unsafe-/i, `${name} allows ${v}`);
    }
  }
});

test('site JS opens no connections (fetch, XHR, WebSocket, beacons, EventSource), so connect-src can stay on self', () => {
  for (const [name, src] of js) {
    if (name.endsWith('factories.generated.js')) continue; // vendored; its Node-only I/O is stubbed by the runtime
    assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|sendBeacon|\bEventSource\b/, `${name} makes a network request`);
  }
});

// The whole install command (30 mono glyphs = 15em) must stay visible on phones, so under 480px the
// font shrinks to the room left beside the Copy button. A fixed size clipped it at 412px.
test('phones: the install command font scales to the available width instead of clipping', () => {
  const site = readFileSync(new URL('css/site.css', SITE), 'utf8');
  const rule = atBlock(site, '@media (max-width: 480px)').match(/\.install \{([^}]*)\}/);
  assert.ok(rule, '.install rule missing in the 480px block');
  assert.match(rule[1], /font-size:\s*min\(calc\(15px \* var\(--mk\)\),\s*calc\(\(100vw - 2 \* var\(--gutter\)/);
  assert.doesNotMatch(site, /\.install code \{[^}]*text-overflow/);
});

// D19: the OS compatibility claim is allowed in exactly two places, the hero line and the JSON-LD.
const COMPAT = '<p class="compat"><span class="compat-dot" aria-hidden="true">●</span> Works on macOS · Linux · Windows</p>';

test('index.html: the hero compat line appears exactly once, right after the meta line', () => {
  const html = pages.find(([n]) => n === 'index.html')[1];
  assert.equal(html.split(COMPAT).length - 1, 1);
  assert.equal(html.match(/class="compat"/g).length, 1);
  assert.match(html, /<p class="meta">[^<]*<\/p>\n\s*<p class="compat">/);
  assert.ok(html.indexOf(COMPAT) < html.indexOf('<figure class="term term-hero">'), 'compat line sits above the terminal');
  assert.doesNotMatch(html, /\bSupports\b/);
});

test('OS names appear only in the hero compat line and the JSON-LD operatingSystem', () => {
  const OS = /macOS|Linux|Windows/;
  for (const [name, html] of pages) {
    let rest = html;
    if (name === 'index.html') {
      assert.match(html, /"operatingSystem":"macOS, Linux, Windows"/);
      rest = rest.replace(COMPAT, '').replace('"operatingSystem":"macOS, Linux, Windows"', '');
    }
    assert.doesNotMatch(rest, OS, `${name} names an OS outside the hero compat line`);
  }
  assert.ok(!pages.find(([n]) => n === '404.html')[1].includes('class="compat"'));
  for (const [name, src] of js) {
    if (name.endsWith('factories.generated.js')) continue;
    assert.doesNotMatch(src, OS, `${name} names an OS`);
  }
});

// D20: HSTS is set explicitly so the policy is ours and visible in the repo, not Vercel's default
// (includeSubDomains; preload). includeSubDomains would cover nothing (ampline.js.org has no subdomains), and
// preload is a hard-to-undo browser-list commitment on a name under js.org, which we do not own.
test('vercel.json: HSTS is exactly max-age=31536000, and the global header set is pinned', () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const global = vercel.headers.find((h) => h.source === '/(.*)').headers;
  assert.deepEqual(global.map((h) => h.key).sort(), [
    'Content-Security-Policy', 'Cross-Origin-Opener-Policy', 'Permissions-Policy',
    'Referrer-Policy', 'Strict-Transport-Security', 'X-Content-Type-Options',
  ]);
  const hsts = global.find((h) => h.key === 'Strict-Transport-Security').value;
  assert.equal(hsts, 'max-age=31536000');
  assert.doesNotMatch(hsts, /includeSubDomains|preload/i);
});

// The customize/FAQ prompts close the "Every signal, one line." section, before the playground.
test('index.html: the features section ends with customize and FAQ prompts that link to the docs', () => {
  const html = pages.find(([n]) => n === 'index.html')[1];
  const features = html.slice(html.indexOf('id="features"'), html.indexOf('id="playground"'));
  const row = features.match(/<p class="learn">([\s\S]*?)<\/p>/)?.[1] || '';
  assert.ok(row, 'the .learn row must sit inside #features, before #playground');
  const links = row.match(/<a\b[^>]*>[^<]*<\/a>/g) || [];
  assert.equal(links.length, 2);
  const want = [
    ['https://github.com/carterptull/ampline-claude#configuration', 'Configure it ↗'],
    ['https://github.com/carterptull/ampline-claude#faq', 'Read the FAQ ↗'],
  ];
  want.forEach(([href, text], i) => {
    assert.equal(links[i], `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`);
  });
});

test('touch: the customize and FAQ links are at least 44px tall', () => {
  const site = readFileSync(new URL('css/site.css', SITE), 'utf8');
  const block = atBlock(site, '@media (pointer: coarse)');
  assert.match(block, /\.learn a[^{]*\{[^}]*min-height: 44px/);
});

// A release must bump all three together: the newest CHANGELOG heading (first `## [x.y.z]` after
// `## [Unreleased]`), package.json "version", and the footer version on index.html and 404.html.
test('release version: top CHANGELOG heading, package.json and both footers agree', () => {
  const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const afterUnreleased = changelog.slice(changelog.indexOf('## [Unreleased]'));
  assert.ok(afterUnreleased.startsWith('## [Unreleased]'), 'CHANGELOG has no Unreleased heading');
  const top = afterUnreleased.match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1];
  assert.ok(top, 'CHANGELOG has no released version heading');
  assert.equal(top, PKG.version, 'CHANGELOG top release differs from package.json version');
  for (const [name, html] of pages.filter(([n]) => n !== CARD)) {
    const footer = html.match(/<span class="ver" id="siteVersion">([^<]*)<\/span>/)?.[1];
    assert.equal(footer, `v${top}`, `${name} footer version differs from the CHANGELOG`);
  }
});

// Lighthouse link-in-text-block: the preview's PR link is colored by the product, so the page distinguishes it
// with an underline instead of changing the color.
test('playground preview links are underlined (not distinguished by color alone)', () => {
  const site = readFileSync(new URL('css/site.css', SITE), 'utf8');
  const rule = site.match(/^\.play \.sl a \{([^}]*)\}/m);
  assert.ok(rule, '.play .sl a rule missing');
  assert.match(rule[1], /text-decoration:\s*underline/);
  assert.doesNotMatch(rule[1], /\bcolor\s*:/, 'product colors stay untouched');
});
