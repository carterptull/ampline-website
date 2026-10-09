import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusPayload, wheelIndex, HERO_CYCLE, FAMILIES } from '../site/js/payloads.js';
import { createAmpline } from '../site/js/runtime/ampline.js';

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
