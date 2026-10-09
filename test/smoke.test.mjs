import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('package has no runtime dependencies', () => {
  assert.equal(pkg.dependencies, undefined);
});

test('ampline-claude devDependency is pinned exactly', () => {
  assert.match(pkg.devDependencies['ampline-claude'], /^\d+\.\d+\.\d+$/);
});

test('license names Paymon Software', () => {
  assert.match(readFileSync(new URL('../LICENSE', import.meta.url), 'utf8'), /Copyright \(c\) 2026 Paymon Software/);
});
