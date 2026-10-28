import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusPayload, subagentPayload, wheelIndex, HERO_CYCLE, FAMILIES } from '../site/js/payloads.js';
import { createAmpline, subagentRows } from '../site/js/runtime/ampline.js';

test('wheelIndex maps family x effort onto the 20-step wheel', () => {
  assert.equal(wheelIndex('haiku', 'low'), 0);
  assert.equal(wheelIndex('opus', 'high'), 12);
  assert.equal(wheelIndex('fable', 'max'), 19);
  assert.equal(wheelIndex('haiku', null), 4); // no effort -> haiku flat blue = haiku max stop
  assert.equal(wheelIndex('opus', null), 12); // other families fall back to their `high` color
});

test('wheelIndex color matches the runtime WHEEL', () => {
  const { colors } = createAmpline();
  for (const [fam, eff] of HERO_CYCLE) assert.ok(colors.WHEEL[wheelIndex(fam, eff)]);
});

test('countdowns are always in the future, so they always render', () => {
  const amp = createAmpline({ columns: 200 });
  for (const fam of FAMILIES) {
    const out = amp.stripAnsi(amp.renderStatusline(statusPayload({ family: fam, effort: 'high' })));
    assert.match(out, /H\d+ .* ↺ 2h13m/);
    assert.match(out, /W\d+ .* ↺ 3d4h/);
  }
});

test('rateLimits:false yields an API-key-style line without H/W bars', () => {
  const amp = createAmpline({ columns: 200 });
  const out = amp.stripAnsi(amp.renderStatusline(statusPayload({ rateLimits: false })));
  assert.doesNotMatch(out, /\bH\d+|\bW\d+/);
});

test('subagent sample is believable: a task that has not started carries no token count', () => {
  const { tasks } = subagentPayload();
  const waiting = tasks.filter((t) => t.status === 'queued' || t.status === 'pending');
  assert.ok(waiting.length >= 1);
  for (const t of waiting) assert.equal(t.tokenCount, undefined);
  for (const t of tasks.filter((x) => x.status === 'running')) assert.ok(t.tokenCount > 0 && t.tokenCount < 1_000_000);
});

test('subagent tasks carry unique string ids (1.0.0 leaves a task without one out of the output)', () => {
  const { tasks } = subagentPayload();
  assert.ok(tasks.length >= 3);
  for (const t of tasks) assert.ok(typeof t.id === 'string' && t.id !== '');
  assert.equal(new Set(tasks.map((t) => t.id)).size, tasks.length);
  const amp = createAmpline({ columns: 200 });
  assert.equal(subagentRows(amp.renderSubagentLine(subagentPayload())).length, tasks.length);
});

test('statusPayload: elapsed options set resets_at in whole seconds from the 5-hour and 7-day windows', () => {
  const now = 1_800_000_000_000;
  const s = Math.floor(now / 1000);
  const p = statusPayload({ now, fiveHourElapsed: 0.2, weeklyElapsed: 0.5 });
  assert.equal(p.rate_limits.five_hour.resets_at, s + 4 * 3600, '80% of 5 hours left');
  assert.equal(p.rate_limits.seven_day.resets_at, s + 3.5 * 86400, 'half of 7 days left');
  const odd = statusPayload({ now, fiveHourElapsed: 0.333, weeklyElapsed: 0.123 });
  for (const w of [odd.rate_limits.five_hour, odd.rate_limits.seven_day]) assert.ok(Number.isInteger(w.resets_at));
  assert.equal(odd.rate_limits.five_hour.resets_at, s + Math.round(0.667 * 18000));
});

test('statusPayload: without the elapsed options the offsets are today\'s (2h13m30s and 3d4h30s)', () => {
  const now = 1_800_000_000_000;
  const s = Math.floor(now / 1000);
  const p = statusPayload({ now });
  assert.equal(p.rate_limits.five_hour.resets_at, s + 2 * 3600 + 13 * 60 + 30);
  assert.equal(p.rate_limits.seven_day.resets_at, s + 3 * 86400 + 4 * 3600 + 30);
});

test('statusPayload: the pace marker moves with the elapsed fraction (through the real runtime)', () => {
  const amp = createAmpline({ columns: 200 });
  const cell = (label, input) => {
    const m = amp.stripAnsi(amp.renderStatusline(input)).match(new RegExp(`${label}\\d+ (.{8})`));
    return m[1].indexOf('┃');
  };
  const at = (f, w) => cell(w, statusPayload({ fiveHourElapsed: f, weeklyElapsed: f }));
  assert.deepEqual([0.1, 0.5, 0.9].map((f) => at(f, 'H')), [0, 4, 7]);
  assert.deepEqual([0.1, 0.5, 0.9].map((f) => at(f, 'W')), [0, 4, 7]);
});
