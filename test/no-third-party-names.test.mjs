import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Project rule: never mention other statusline projects by name, or compare against them, anywhere
// in the repo or on the website. The denylist is built from fragments so this file does not contain
// the names it forbids. ("competitor" is deliberately not listed: the rule itself uses the word.)
const j = (...parts) => parts.join('');
export const DENYLIST = [
  j('ctx', 'line'),
  j('cc', 'status', 'line'),
  j('cc', 'usage'),
  j('claude', '-hud'),
  j('status', 'lin', '.es'),
];

const BINARY_EXT = /\.(png|ico|woff2?|ttf|jpe?g|gif|webp)$/i;
const SKIP = new Set(['package-lock.json']);

// Pure scanner: which denylisted names appear in `text`, case-insensitively.
export const findNames = (text, names = DENYLIST) => {
  const hay = text.toLowerCase();
  return names.filter((n) => hay.includes(n.toLowerCase()));
};

const ROOT = new URL('../', import.meta.url);
const tracked = () => execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
  .split('\0').filter(Boolean);

test('scanner flags a denylisted name in any letter case, and only those', () => {
  for (const name of DENYLIST) {
    assert.deepEqual(findNames(`see ${name} for details`), [name]);
    assert.deepEqual(findNames(`See ${name.toUpperCase()} for details`), [name]);
  }
  assert.deepEqual(findNames('ampline is a statusline for Claude Code'), []);
  assert.deepEqual(findNames(''), []);
});

test('the denylist is not empty and holds no blank entries', () => {
  assert.ok(DENYLIST.length >= 5);
  for (const n of DENYLIST) assert.ok(n.trim().length > 3);
});

test('no git-tracked file or file name mentions another statusline project', () => {
  const files = tracked();
  assert.ok(files.length > 20, 'git ls-files returned too few files');
  const hits = [];
  for (const f of files) {
    if (SKIP.has(f)) continue;
    for (const n of findNames(f)) hits.push(`${f} (path): ${n}`);
    if (BINARY_EXT.test(f)) continue;
    let text;
    try { text = readFileSync(new URL(f, ROOT), 'utf8'); } catch { continue; } // deleted in the working tree
    if (text.includes('\0')) continue;
    for (const n of findNames(text)) hits.push(`${f}: ${n}`);
  }
  assert.deepEqual(hits, []);
});
