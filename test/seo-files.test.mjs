import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../site/${f}`, import.meta.url), 'utf8');

test('robots.txt allows the site, hides the OG card source page and points at the sitemap', () => {
  const lines = read('robots.txt').split('\n').map((l) => l.trim()).filter(Boolean);
  assert.deepEqual(lines, ['User-agent: *', 'Allow: /', 'Disallow: /og-card.html', 'Sitemap: https://ampline.js.org/sitemap.xml']);
});

test('sitemap.xml lists exactly the home page', () => {
  assert.deepEqual(read('sitemap.xml').match(/<loc>[^<]*<\/loc>/g), ['<loc>https://ampline.js.org/</loc>']);
});

test('site.webmanifest parses and describes ampline on black', () => {
  const m = JSON.parse(read('site.webmanifest'));
  assert.equal(m.name, 'ampline');
  assert.equal(m.background_color, '#000000');
  assert.equal(m.theme_color, '#000000');
  assert.deepEqual(m.icons, [{ src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' }]);
});

test('icon.svg: four wheel-colored bars (45/70/100/80%) on a black rounded square, no script or style', () => {
  const svg = read('icon.svg');
  assert.doesNotMatch(svg, /<script|<style|\son[a-z]+\s*=|https?:\/\/(?!www\.w3\.org)/i);
  assert.match(svg, /<rect[^>]*rx="14"[^>]*fill="#000000"/);
  const bars = [...svg.matchAll(/<rect x="[\d.]+" y="[\d.]+" width="8" height="([\d.]+)"[^>]*fill="(#[0-9A-F]{6})"/g)];
  assert.deepEqual(bars.map((b) => b[2]), ['#7DB8E8', '#E8B23D', '#D8203D', '#8000C0']);
  assert.deepEqual(bars.map((b) => Math.round((Number(b[1]) / 40) * 100)), [45, 70, 100, 80]);
});

const png = (f) => {
  const b = readFileSync(new URL(`../site/${f}`, import.meta.url));
  return { sig: b.subarray(1, 4).toString(), w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length };
};

test('og.png is a 1200x630 PNG under 600KB (the size the og:image meta declares)', () => {
  const p = png('og.png');
  assert.equal(p.sig, 'PNG');
  assert.deepEqual([p.w, p.h], [1200, 630]);
  assert.ok(p.bytes < 600 * 1024, `og.png is ${p.bytes} bytes`);
});

test('apple-touch-icon.png is 180x180 and favicon.ico is a 32x32 PNG (D15)', () => {
  const a = png('apple-touch-icon.png');
  assert.equal(a.sig, 'PNG');
  assert.deepEqual([a.w, a.h], [180, 180]);
  const f = png('favicon.ico');
  assert.equal(f.sig, 'PNG');
  assert.deepEqual([f.w, f.h], [32, 32]);
});
