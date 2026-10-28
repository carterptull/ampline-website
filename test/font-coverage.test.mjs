// The self-hosted mono subset must cover every glyph the page draws in "ampline mono", and every
// file under /assets/ must carry a `.vN.` version in its name (D9, D24).
//
// Why this exists: the subset is hand-built (scripts/fonts/README.md), so nothing else notices
// when the renderer starts emitting a new glyph. ampline-claude 1.0.0 added U+2503 (the pace
// marker) and the v1 fonts lacked it; the bars silently fell back to another font and misaligned.
// /assets/ is served `immutable` for a year (vercel.json), so a changed asset also needs a new
// filename, which the last tests enforce.
//
// Zero dependencies: a small WOFF2 reader (header, table directory, one brotli stream via
// node:zlib) and a cmap reader for formats 4 and 12. In WOFF2 only glyf, loca (and hmtx) can be
// transformed; cmap and name are stored untransformed, which the reader asserts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = join(ROOT, 'site');
const FONTS = [
  { file: 'mono-400.v2.woff2', style: 'Regular' },
  { file: 'mono-700.v2.woff2', style: 'Bold' },
];

const cpName = (c) => `U+${c.toString(16).toUpperCase().padStart(4, '0')} (${String.fromCodePoint(c)})`;
const nonAscii = (s) => [...s].map((ch) => ch.codePointAt(0)).filter((c) => c > 0x7e);

// ---------------------------------------------------------------------------------------------
// WOFF2 + cmap reading

// The WOFF2 spec's table-tag index for the 63 well-known tags.
const KNOWN_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

function readBase128(buf, pos) {
  let v = 0;
  for (let i = 0; i < 5; i++) {
    const b = buf[pos.p++];
    v = (v * 128) + (b & 0x7f);
    if (!(b & 0x80)) return v;
  }
  throw new Error('bad UIntBase128');
}

function parseWoff2(buf) {
  assert.equal(buf.toString('latin1', 0, 4), 'wOF2', 'WOFF2 signature');
  const numTables = buf.readUInt16BE(12);
  const compressedSize = buf.readUInt32BE(20);
  const pos = { p: 48 };
  const dir = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[pos.p++];
    let tag;
    if ((flags & 0x3f) === 63) { tag = buf.toString('latin1', pos.p, pos.p + 4); pos.p += 4; }
    else tag = KNOWN_TAGS[flags & 0x3f];
    const transform = (flags >> 6) & 3;
    const origLength = readBase128(buf, pos);
    // glyf/loca are transformed unless version 3; every other table is transformed only if version != 0.
    const transformed = tag === 'glyf' || tag === 'loca' ? transform === 0 : transform !== 0;
    dir.push({ tag, transformed, length: transformed ? readBase128(buf, pos) : origLength });
  }
  const stream = brotliDecompressSync(buf.subarray(pos.p, pos.p + compressedSize));
  const tables = {};
  let off = 0;
  for (const t of dir) { tables[t.tag] = { ...t, data: stream.subarray(off, off + t.length) }; off += t.length; }
  assert.equal(off, stream.length, 'table directory accounts for the whole decompressed stream');
  return tables;
}

function readCmap(cmap) {
  const cps = new Set();
  const numRecords = cmap.readUInt16BE(2);
  for (let i = 0; i < numRecords; i++) {
    const off = cmap.readUInt32BE(4 + i * 8 + 4);
    const format = cmap.readUInt16BE(off);
    if (format === 4) {
      const segX2 = cmap.readUInt16BE(off + 6);
      const ends = off + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = cmap.readUInt16BE(ends + s * 2), start = cmap.readUInt16BE(starts + s * 2);
        const delta = cmap.readInt16BE(deltas + s * 2), rangeOffset = cmap.readUInt16BE(ranges + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let g;
          if (rangeOffset === 0) g = (c + delta) & 0xffff;
          else {
            g = cmap.readUInt16BE(ranges + s * 2 + rangeOffset + (c - start) * 2);
            if (g) g = (g + delta) & 0xffff;
          }
          if (g) cps.add(c); // glyph 0 is .notdef: not a real mapping
        }
      }
    } else if (format === 12) {
      const groups = cmap.readUInt32BE(off + 12);
      for (let k = 0; k < groups; k++) {
        const b = off + 16 + k * 12;
        const start = cmap.readUInt32BE(b), end = cmap.readUInt32BE(b + 4), glyph = cmap.readUInt32BE(b + 8);
        for (let c = start; c <= end; c++) if (glyph + (c - start) !== 0) cps.add(c);
      }
    }
  }
  return cps;
}

function nameRecords(name) {
  const count = name.readUInt16BE(2), storage = name.readUInt16BE(4);
  const out = {};
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12;
    if (name.readUInt16BE(r) !== 3) continue; // Windows platform, UTF-16BE
    const id = name.readUInt16BE(r + 6), len = name.readUInt16BE(r + 8), o = name.readUInt16BE(r + 10);
    const b = name.subarray(storage + o, storage + o + len);
    let s = '';
    for (let j = 0; j < b.length; j += 2) s += String.fromCharCode(b.readUInt16BE(j));
    out[id] = s;
  }
  return out;
}

const loaded = FONTS.map((f) => {
  const path = join(SITE, 'assets', 'fonts', f.file);
  assert.ok(existsSync(path), `${f.file} exists`);
  const tables = parseWoff2(readFileSync(path));
  return { ...f, tables, cmap: readCmap(tables.cmap.data), names: nameRecords(tables.name.data) };
});

// ---------------------------------------------------------------------------------------------
// What the page draws in mono

// Minimal JS scanner: returns the text of every string and template literal, skipping comments and
// regex literals. Conservative: a template literal's `${...}` is scanned as literal text too, which
// can only add characters to the required set, never hide one.
function stringLiterals(src) {
  const out = [];
  const n = src.length;
  let i = 0;
  let prev = ''; // last significant (non-space, non-comment) character
  let prevWord = '';
  const regexStart = () => prev === '' || '(,=:[!&|?{};+-*%<>~^'.includes(prev) || /^(return|typeof|case|in|of|delete|void|throw|new)$/.test(prevWord);
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1, s = '';
      while (j < n && src[j] !== c) { if (src[j] === '\\') { s += src[j + 1] ?? ''; j += 2; } else s += src[j++]; }
      out.push(s);
      i = j + 1; prev = c; prevWord = '';
      continue;
    }
    if (c === '/' && regexStart()) {
      let j = i + 1, inClass = false;
      while (j < n && (src[j] !== '/' || inClass)) {
        if (src[j] === '\\') j++;
        else if (src[j] === '[') inClass = true;
        else if (src[j] === ']') inClass = false;
        j++;
      }
      i = j + 1; prev = '/'; prevWord = '';
      while (/[a-z]/.test(src[i] ?? '')) i++; // flags
      continue;
    }
    if (/\s/.test(c)) { i++; continue; }
    if (/[A-Za-z_$]/.test(c)) { let j = i; while (/[\w$]/.test(src[j] ?? '')) j++; prevWord = src.slice(i, j); prev = 'a'; i = j; continue; }
    prev = c; prevWord = ''; i++;
  }
  return out;
}

function walk(dir, ext, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.test(p)) out.push(p);
  }
  return out;
}

// Visible text of an HTML file: comments, <script>, <style> and tags removed.
function htmlText(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, ' ');
}

const GENERATED = join(SITE, 'js', 'runtime', 'factories.generated.js');
const rel = (p) => p.slice(ROOT.length).replaceAll('\\', '/');

// Characters that appear in string literals or page text but are NOT drawn in "ampline mono", so
// the font does not need them. Each entry says why. Adding to this list is a deliberate act: a glyph
// that does land in a statusline or a mono element must be added to the font instead. (The em dashes
// in the renderer's source sit in comments and install messages, not in string literals the scan
// sees, so they need no entry.)
const NOT_MONO = new Map([
  [0x00d7, 'multiplication sign: tour card prose in the sans body font ("4 model families × 5 efforts")'],
  [0x00a9, 'copyright sign: footer text, sans'],
  [0x1f37a, 'beer emoji: the footer pill, drawn by the system emoji font'],
]);

// The glyph set the v1 fonts shipped (D9), still required.
const V1_SET = [0x00b7, 0x2026, 0x2191, 0x2193, 0x2197, 0x21b3, 0x21ba, 0x2387, 0x2502, 0x2588, 0x2591, 0x25cf, 0x26a0, 0x2713];

const rendererChars = new Set(nonAscii(stringLiterals(readFileSync(GENERATED, 'utf8')).join('')));
const siteChars = new Map(); // code point -> files it appears in
const noteSite = (c, file) => { if (!siteChars.has(c)) siteChars.set(c, new Set()); siteChars.get(c).add(file); };
for (const p of walk(join(SITE, 'js'), /\.js$/)) {
  if (p === GENERATED) continue;
  for (const c of nonAscii(stringLiterals(readFileSync(p, 'utf8')).join(''))) noteSite(c, rel(p));
}
for (const p of walk(SITE, /\.html$/)) for (const c of nonAscii(htmlText(readFileSync(p, 'utf8')))) noteSite(c, rel(p));

// ---------------------------------------------------------------------------------------------

test('the scanner sees the glyphs the renderer is known to emit', () => {
  // Guards the test itself: if the literal scan ever returned nothing, the coverage checks below
  // would pass vacuously.
  for (const c of [0x2588, 0x2591, 0x2503, 0x2502, 0x2026, 0x00b7, 0x21ba, 0x21b3, 0x26a0]) {
    assert.ok(rendererChars.has(c), `renderer literal ${cpName(c)} found by the scan`);
  }
  assert.ok(siteChars.has(0x2265), '≥ found in the site text');
  assert.ok(siteChars.has(0x2713) && siteChars.has(0x25cf) && siteChars.has(0x2387), 'fakes/hero glyphs found');
});

test('both subset fonts are Iosevka Fixed v34.9.0 with a readable, untransformed cmap', () => {
  for (const f of loaded) {
    assert.equal(f.tables.cmap.transformed, false, `${f.file}: cmap stored untransformed`);
    assert.equal(f.names[1], 'Iosevka Fixed', f.file);
    assert.equal(f.names[2], f.style, f.file);
    assert.equal(f.names[5], 'Version 34.9.0', f.file);
    for (let c = 0x20; c <= 0x7e; c++) assert.ok(f.cmap.has(c), `${f.file}: ASCII ${cpName(c)}`);
  }
});

test('the pace marker U+2503 and the hero "≥" are in both fonts', () => {
  for (const f of loaded) {
    assert.ok(f.cmap.has(0x2503), `${f.file} maps U+2503 (┃, ampline-claude 1.0.0 pace marker)`);
    assert.ok(f.cmap.has(0x2265), `${f.file} maps U+2265 (≥, hero meta line)`);
  }
});

test('the v1 glyph set is still in both fonts', () => {
  for (const f of loaded) for (const c of V1_SET) assert.ok(f.cmap.has(c), `${f.file} maps ${cpName(c)}`);
});

test('every non-ASCII character the vendored renderer emits is in both fonts', () => {
  for (const c of rendererChars) {
    if (NOT_MONO.has(c)) continue;
    for (const f of loaded) assert.ok(f.cmap.has(c), `${f.file} is missing ${cpName(c)} (renderer string literal in factories.generated.js)`);
  }
});

test('every non-ASCII character in the site\'s own text and JS is in both fonts, or allowlisted as not mono', () => {
  for (const [c, files] of siteChars) {
    if (NOT_MONO.has(c)) continue;
    for (const f of loaded) assert.ok(f.cmap.has(c), `${f.file} is missing ${cpName(c)} (used in ${[...files].join(', ')})`);
  }
});

test('the NOT_MONO allowlist has no stale entries', () => {
  for (const c of NOT_MONO.keys()) {
    assert.ok(rendererChars.has(c) || siteChars.has(c), `${cpName(c)} is allowlisted but appears nowhere; remove it`);
  }
});

// ---------------------------------------------------------------------------------------------
// Versioned assets: /assets/ is served `public, max-age=31536000, immutable`

test('vercel.json still serves /assets/ immutable (the premise of the naming rule)', () => {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
  const rule = cfg.headers.find((h) => h.source === '/assets/(.*)');
  assert.ok(rule, '/assets/ header rule exists');
  assert.match(rule.headers.find((h) => h.key === 'Cache-Control').value, /immutable/);
});

const ASSET_REF = /\/assets\/[A-Za-z0-9_./-]+/g;
const VERSIONED = /\.v\d+\.[a-z0-9]+$/;

test('every /assets/ file referenced from the site exists and carries a .vN. version in its name', () => {
  const sources = walk(SITE, /\.(html|css|js|svg|json|webmanifest|xml)$/);
  const refs = new Map(); // path -> referencing files
  for (const p of sources) {
    for (const m of readFileSync(p, 'utf8').matchAll(ASSET_REF)) {
      const ref = m[0].replace(/[.,;]+$/, '');
      if (!refs.has(ref)) refs.set(ref, new Set());
      refs.get(ref).add(rel(p));
    }
  }
  assert.ok(refs.size >= 3, 'found the font and wordmark references');
  for (const [ref, from] of refs) {
    assert.ok(existsSync(join(SITE, ref)), `${ref} (referenced from ${[...from].join(', ')}) does not exist`);
    assert.match(basename(ref), VERSIONED, `${ref} needs a .vN. token (immutable cache: a changed asset needs a new name)`);
  }
});

test('every file under site/assets/ is versioned, except the licence text', () => {
  for (const p of walk(join(SITE, 'assets'), /./)) {
    if (basename(p) === 'OFL.txt') continue;
    assert.match(basename(p), VERSIONED, `${rel(p)} needs a .vN. token`);
  }
});

test('the preloads point at the @font-face files, and no unversioned or old font file remains', () => {
  const css = readFileSync(join(SITE, 'css', 'tokens.css'), 'utf8');
  const faces = [...css.matchAll(/url\((\/assets\/fonts\/[^)]+)\)/g)].map((m) => m[1]);
  assert.deepEqual(faces.sort(), FONTS.map((f) => `/assets/fonts/${f.file}`).sort(), '@font-face urls are the v2 files');
  for (const page of ['index.html', 'og-card.html']) {
    const html = readFileSync(join(SITE, page), 'utf8');
    const preloads = [...html.matchAll(/<link rel="preload" href="([^"]+)" as="font"/g)].map((m) => m[1]);
    assert.ok(preloads.length >= 1, `${page} preloads the regular weight`);
    for (const href of preloads) assert.ok(faces.includes(href), `${page} preload ${href} matches an @font-face url`);
  }
  const onDisk = readdirSync(join(SITE, 'assets', 'fonts')).filter((f) => f.endsWith('.woff2')).sort();
  assert.deepEqual(onDisk, FONTS.map((f) => f.file).sort(), 'only the current font versions are shipped');
});
