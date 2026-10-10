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
