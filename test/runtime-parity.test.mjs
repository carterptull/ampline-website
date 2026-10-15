import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAmpline } from '../site/js/runtime/ampline.js';
import { statusPayload, subagentPayload } from '../site/js/payloads.js';

const BIN = fileURLToPath(new URL('../node_modules/ampline-claude/bin/ampline-claude.js', import.meta.url));

function realRender(input, { columns, args = [], noColor = false }) {
  const home = mkdtempSync(join(tmpdir(), 'ampline-parity-'));
  try {
    const env = { PATH: process.env.PATH, HOME: home, USERPROFILE: home, COLUMNS: String(columns) };
    if (noColor) env.NO_COLOR = '1';
    return execFileSync(process.execPath, [BIN, ...args], {
      input: JSON.stringify(input), cwd: home, env, encoding: 'utf8',
    });
  } finally { rmSync(home, { recursive: true, force: true }); }
}

const now = Date.now();
// Strip the demo-only git/task data: the real binary can't render it (no repo, no todo file),
// and the fakes are pinned to real bytes separately in test/fakes.test.mjs.
const real = (opts) => { const { __demo, ...rest } = statusPayload({ now, ...opts }); return rest; };
const CASES = [
  ['hero opus xhigh', real({ family: 'opus', effort: 'xhigh' }), 200],
  ['hero wraps at 100 cols', real({ family: 'opus', effort: 'xhigh' }), 100],
  ['haiku no effort', real({ family: 'haiku', effort: null }), 200],
  ['fable max bold', real({ family: 'fable', effort: 'max' }), 200],
  ['84.9 not bold', real({ context: 84.9 }), 200],
  ['85 bold', real({ context: 85 }), 200],
  ['97 warn', real({ context: 97, fiveHour: 97 }), 200],
  ['api-key account (no rate limits)', real({ rateLimits: false }), 200],
  ['gitlab mr', real({ pr: { kind: 'mr', number: 42, review_state: 'pending' } }), 200],
  ['pr changes requested', real({ pr: { number: 128, review_state: 'changes_requested' } }), 200],
];

for (const [name, input, columns] of CASES) {
  test(`parity: ${name}`, () => {
    const amp = createAmpline({ columns });
    assert.equal(amp.renderStatusline(input), realRender(input, { columns }).replace(/\n$/, ''));
  });
}

test('parity: NO_COLOR instance', () => {
  const input = real({});
  const amp = createAmpline({ columns: 200, noColor: true });
  assert.equal(amp.renderStatusline(input), realRender(input, { columns: 200, noColor: true }).replace(/\n$/, ''));
});

test('parity: subagent rows', () => {
  const input = subagentPayload();
  const amp = createAmpline({ columns: 200 });
  assert.equal(amp.renderSubagentLine(input), realRender(input, { columns: 200, args: ['--subagent'] }).replace(/\n$/, ''));
});

test('resetCache: stale usage is served from the in-memory cache until it is cleared', () => {
  const amp = createAmpline({ columns: 200 });
  amp.renderStatusline(statusPayload({ now, fiveHour: 91 })); // live payload seeds the cache
  const noLimits = statusPayload({ now, rateLimits: false });
  assert.match(amp.stripAnsi(amp.renderStatusline(noLimits)), /H91 /, 'served from the cache');
  amp.resetCache();
  assert.doesNotMatch(amp.stripAnsi(amp.renderStatusline(noLimits)), /\bH\d+|\bW\d+/, 'nothing cached after the reset');
});
