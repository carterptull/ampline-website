import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAmpline, subagentRows } from '../site/js/runtime/ampline.js';
import { statusPayload, subagentPayload } from '../site/js/payloads.js';

const BIN = fileURLToPath(new URL('../node_modules/ampline-claude/bin/ampline-claude.js', import.meta.url));

function realRender(input, { columns, args = [], noColor = false, config = null }) {
  const home = mkdtempSync(join(tmpdir(), 'ampline-parity-'));
  try {
    if (config) writeFileSync(join(home, '.amplinerc.json'), JSON.stringify(config)); // found by the walk up from cwd
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

// Pace marker (1.0.0): the config goes to the binary as .amplinerc.json and to the runtime via setConfig.
// Resets are set explicitly here: seconds left in the 5-hour and 7-day windows.
const withResets = (input, fiveLeft, weekLeft) => {
  const s = Math.floor(now / 1000);
  const out = structuredClone(input);
  if (fiveLeft === null) delete out.rate_limits.five_hour.resets_at; else out.rate_limits.five_hour.resets_at = s + fiveLeft;
  if (weekLeft === null) delete out.rate_limits.seven_day.resets_at; else out.rate_limits.seven_day.resets_at = s + weekLeft;
  return out;
};
const H = 3600;
const PACE_CASES = [
  ['pace marker, mid-window, paceColors off', withResets(real({ fiveHour: 80, weekly: 30 }), 2 * H, 3 * 86400), null],
  ['paceColors on, burning ahead of pace', withResets(real({ fiveHour: 40, weekly: 25 }), 2.5 * H, 4 * 86400), { paceColors: true }],
  ['paceColors on, early window (under 10% elapsed)', withResets(real({ fiveHour: 70, weekly: 40 }), 5 * H - 600, 7 * 86400 - 3600), { paceColors: true }],
  ['no resets_at: no marker, no countdown', withResets(real({ fiveHour: 55, weekly: 20 }), null, null), { paceColors: true }],
];
for (const [name, input, config] of PACE_CASES) {
  test(`parity: ${name}`, () => {
    const amp = createAmpline({ columns: 200 });
    if (config) amp.setConfig(config);
    const expected = realRender(input, { columns: 200, config });
    const got = amp.renderStatusline(input);
    assert.equal(got, expected.replace(/\n$/, ''));
    assert.ok(got.length > 0);
  });
}

test('parity: the pace marker is really drawn, and absent without resets_at', () => {
  const amp = createAmpline({ columns: 200 });
  const marked = amp.stripAnsi(amp.renderStatusline(withResets(real({ fiveHour: 80, weekly: 30 }), 2 * H, 3 * 86400)));
  assert.match(marked, /H80 .*┃.*W30 .*┃/);
  const bare = amp.stripAnsi(amp.renderStatusline(withResets(real({ fiveHour: 55, weekly: 20 }), null, null)));
  assert.match(bare, /H55 /);
  assert.doesNotMatch(bare, /┃/);
});

// 1.0.0 prints one {"id","content"} JSON line per task. An empty result would make runtime === binary
// pass without testing anything, so the output must be non-empty and every line must parse.
test('parity: subagent rows (JSON lines, never vacuous)', () => {
  const input = subagentPayload();
  const amp = createAmpline({ columns: 200 });
  const got = amp.renderSubagentLine(input);
  assert.ok(got.length > 0, 'the runtime printed nothing');
  assert.equal(got, realRender(input, { columns: 200, args: ['--subagent'] }), 'exact bytes, trailing newline included');
  const lines = got.split('\n');
  assert.equal(lines.pop(), '', 'every row ends in a newline');
  assert.equal(lines.length, input.tasks.length);
  lines.forEach((line, i) => {
    const row = JSON.parse(line);
    assert.deepEqual(Object.keys(row).sort(), ['content', 'id']);
    assert.equal(row.id, input.tasks[i].id);
    assert.equal(typeof row.content, 'string');
    assert.ok(row.content.length > 0);
  });
  assert.deepEqual(subagentRows(got), lines.map((l) => JSON.parse(l).content));
});

test('subagentRows skips blank, malformed and content-less lines and never throws', () => {
  assert.deepEqual(subagentRows(''), []);
  assert.deepEqual(subagentRows(null), []);
  assert.deepEqual(subagentRows(undefined), []);
  const raw = '{"id":"a","content":"one"}\n\n   \nnot json\n{"id":"b"}\n{"id":"c","content":7}\n[]\nnull\n{"id":"d","content":"two"}\n';
  assert.deepEqual(subagentRows(raw), ['one', 'two']);
});

test('a task without an id is left out by the real renderer, so the payload must carry ids', () => {
  const { tasks } = subagentPayload();
  assert.ok(tasks.every((t) => typeof t.id === 'string' && t.id !== ''));
  assert.equal(new Set(tasks.map((t) => t.id)).size, tasks.length, 'ids are unique');
  const amp = createAmpline({ columns: 200 });
  assert.equal(amp.renderSubagentLine({ columns: 200, tasks: tasks.map(({ id, ...rest }) => rest) }), '');
});

test('resetCache: stale usage is served from the in-memory cache until it is cleared', () => {
  const amp = createAmpline({ columns: 200 });
  amp.renderStatusline(statusPayload({ now, fiveHour: 91 })); // live payload seeds the cache
  const noLimits = statusPayload({ now, rateLimits: false });
  assert.match(amp.stripAnsi(amp.renderStatusline(noLimits)), /H91 /, 'served from the cache');
  amp.resetCache();
  assert.doesNotMatch(amp.stripAnsi(amp.renderStatusline(noLimits)), /\bH\d+|\bW\d+/, 'nothing cached after the reset');
});

// Guards the cases above against passing without exercising paceColors: it must change the bytes when the
// bar is burning ahead of pace, and must not inside the first 10% of a window.
test('parity: paceColors changes the colors ahead of pace and is inert early in the window', () => {
  const ahead = withResets(real({ fiveHour: 40, weekly: 25 }), 2.5 * H, 4 * 86400);
  const early = withResets(real({ fiveHour: 70, weekly: 40 }), 5 * H - 600, 7 * 86400 - 3600);
  const off = createAmpline({ columns: 200 });
  const on = createAmpline({ columns: 200 });
  on.setConfig({ paceColors: true });
  assert.notEqual(on.renderStatusline(ahead), off.renderStatusline(ahead));
  assert.equal(on.renderStatusline(early), off.renderStatusline(early));
});
