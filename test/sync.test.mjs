import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { VENDORED, generate } from '../scripts/sync-ampline.mjs';

test('generated file is up to date with node_modules/ampline-claude', () => {
  const onDisk = readFileSync(new URL('../site/js/runtime/factories.generated.js', import.meta.url), 'utf8');
  assert.equal(onDisk, generate());
});

test('every vendored file is embedded byte-for-byte', () => {
  const out = generate();
  for (const rel of VENDORED) {
    const src = readFileSync(new URL(`../node_modules/ampline-claude/${rel}`, import.meta.url), 'utf8');
    assert.ok(out.includes(src), `${rel} not embedded verbatim`);
  }
});

test('VERSION matches the installed package', async () => {
  const { VERSION } = await import('../site/js/runtime/factories.generated.js');
  const pkg = JSON.parse(readFileSync(new URL('../node_modules/ampline-claude/package.json', import.meta.url), 'utf8'));
  assert.equal(VERSION, pkg.version);
});

test('--check exits 0 when in sync', () => {
  execFileSync(process.execPath, ['scripts/sync-ampline.mjs', '--check'], { stdio: 'pipe' });
});

// Every require() in a vendored file must resolve to another vendored file or to a browser stub
// (STUBBED_MODULES in runtime/ampline.js); otherwise createAmpline() throws "no module" at load time
// (this is how a new lib module such as safeRead would break the site on a pin bump).
test('every require in a vendored file is vendored or stubbed', async () => {
  const { STUBBED_MODULES } = await import('../site/js/runtime/ampline.js');
  const vendoredIds = VENDORED.map((rel) => rel.replace(/^lib\//, '').replace(/\.js$/, ''));
  const resolve = (fromId, request) => {
    if (!request.startsWith('.')) return request;
    const parts = fromId.split('/').slice(0, -1);
    for (const seg of request.split('/')) {
      if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg);
    }
    return parts.join('/');
  };
  const missing = [];
  let seen = 0;
  for (const rel of VENDORED) {
    const id = rel.replace(/^lib\//, '').replace(/\.js$/, '');
    const src = readFileSync(new URL(`../node_modules/ampline-claude/${rel}`, import.meta.url), 'utf8');
    for (const m of src.matchAll(/\brequire\(\s*(['"])([^'"]+)\1\s*\)/g)) {
      seen++;
      const target = resolve(id, m[2]);
      if (!vendoredIds.includes(target) && !STUBBED_MODULES.includes(target)) missing.push(`${rel} requires ${m[2]} (${target})`);
    }
  }
  assert.ok(seen > 10, 'the scan found the require calls');
  assert.deepEqual(missing, []);
});

test('createAmpline() loads every vendored module and renders', async () => {
  const { createAmpline } = await import('../site/js/runtime/ampline.js');
  const { statusPayload, subagentPayload } = await import('../site/js/payloads.js');
  const amp = createAmpline({ columns: 200 });
  assert.ok(amp.stripAnsi(amp.renderStatusline(statusPayload())).length > 0);
  assert.ok(amp.renderSubagentLine(subagentPayload()).length > 0, 'the subagent module loads and prints rows');
});
