import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  configFor, buildPlaygroundInput, renderPlayground, instanceFor, defaultState, applyPreset,
  captureDefaults, amplinercJson, PRESETS, NARROW_COLUMNS, h,
} from '../site/js/playground.js';
import { createAmpline } from '../site/js/runtime/ampline.js';
import { parseAnsi } from '../site/js/ansi.js';

const base = { family: 'opus', effort: 'high', context: 63, fiveHour: 37, weekly: 88,
  segments: { git: true, cost: true, pr: true, task: false }, noColor: false, columns: 120, preset: null };

const instances = () => ({ color: createAmpline({ columns: 120 }), plain: createAmpline({ noColor: true, columns: 120 }) });
const text = (inst, state, narrow = false, now = Date.now()) =>
  instanceFor(state, inst).stripAnsi(renderPlayground(state, inst, now, narrow));

test('narrow config: model+context on line 1, H/W bars on line 2', () => {
  const amp = createAmpline({ columns: 60 });
  amp.setConfig(configFor({ ...base, segments: { git: false, cost: false, pr: false, task: false } }, true));
  const lines = amp.stripAnsi(amp.renderStatusline(buildPlaygroundInput(base, Date.now()))).split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^Opus 5\.5 · high │ C63/);
  assert.match(lines[1], /^H37 .* │ W88/);
});

test('stale preset: bars render dim without danger color even at 91%', () => {
  const amp = createAmpline({ columns: 200 });
  amp.renderStatusline(buildPlaygroundInput({ ...base, fiveHour: 91 }, Date.now())); // seeds the in-memory cache
  const out = amp.renderStatusline(buildPlaygroundInput({ ...base, fiveHour: 91, preset: 'stale' }, Date.now()));
  assert.match(out, /\u001b\[2mH91 /);
  assert.doesNotMatch(out, /\u001b\[1m\u001b\[38;2;232;67;61mH91/);
});

test('api-key preset: no H/W bars', () => {
  const amp = createAmpline({ columns: 200 });
  const out = amp.stripAnsi(amp.renderStatusline(buildPlaygroundInput({ ...base, preset: 'apikey' }, Date.now())));
  assert.doesNotMatch(out, /\bH\d+|\bW\d+/);
});

test('configFor output survives the real validateAndMerge unchanged', () => {
  const amp = createAmpline();
  const user = configFor(base, false);
  const merged = amp.setConfig(user);
  assert.deepEqual(merged.segments, user.segments);
});

test('configFor: wide order, line2From, and the narrow list with toggles after the weekly bar', () => {
  assert.deepEqual(configFor(base, false).segments, ['dir', 'git', 'model', 'context', 'fiveHour', 'weekly', 'cost', 'pr']);
  assert.equal(configFor(base, false).line2From, 'fiveHour');
  assert.deepEqual(configFor(base, true).segments, ['model', 'context', 'fiveHour', 'weekly', 'git', 'cost', 'pr']);
  assert.equal(configFor(base, true).line2From, 'fiveHour');
  assert.equal(configFor(base, false).color, undefined, 'color is only written when NO_COLOR is on');
  assert.equal(configFor({ ...base, noColor: true }, false).color, false);
});

test('same instance: stale preset then api-key preset leaves no H/W bars (Ruling L)', () => {
  const inst = instances();
  const stale = text(inst, { ...base, fiveHour: 91, preset: 'stale' });
  assert.match(stale, /H91 /, 'the stale preset shows the last known usage');
  const apikey = text(inst, { ...base, preset: 'apikey' });
  assert.doesNotMatch(apikey, /\bH\d+|\bW\d+/);
});

test('output is a pure function of state: a stale render does not leak into a later manual render', () => {
  const inst = instances();
  const now = Date.now();
  const manual = { ...base, fiveHour: 10, weekly: 20 };
  const first = text(inst, manual, false, now);
  text(inst, { ...base, fiveHour: 91, preset: 'stale' }, false, now);
  assert.equal(text(inst, manual, false, now), first);
});

test('stale preset through renderPlayground: dim bars, no bold danger, seeded from the same state', () => {
  const inst = instances();
  const out = renderPlayground({ ...base, fiveHour: 91, preset: 'stale' }, inst, Date.now());
  assert.match(out, /\u001b\[2mH91 /);
  assert.doesNotMatch(out, /\u001b\[1m\u001b\[38;2;232;67;61mH91/);
  assert.match(inst.color.stripAnsi(out), /W88 /);
});

test('edge85: 84.9 reads C85 but is not bold, 85 is bold (through the real runtime)', () => {
  const inst = instances();
  const ctx = (context) => parseAnsi(renderPlayground({ ...base, context }, inst, Date.now()))
    .find((t) => t.text.startsWith('C85'));
  const at849 = ctx(84.9);
  const at85 = ctx(85);
  assert.ok(at849 && at85, 'both read C85');
  assert.equal(at849.bold, false);
  assert.equal(at85.bold, true);
});

test('applyPreset: patches state, clears the preset when toggled off, and presets are exclusive', () => {
  const s0 = defaultState(false);
  const stale = applyPreset(s0, 'stale');
  assert.equal(stale.preset, 'stale');
  assert.equal(stale.fiveHour, 91);
  const edge = applyPreset(stale, 'edge85');
  assert.equal(edge.preset, 'edge85');
  assert.equal(edge.context, 84.9);
  assert.equal(applyPreset(edge, 'apikey').preset, 'apikey');
  assert.equal(applyPreset(edge, null).preset, null);
  assert.deepEqual(Object.keys(PRESETS).sort(), ['apikey', 'edge85', 'stale']);
  for (const p of Object.values(PRESETS)) assert.ok(p.hint.length > 10);
  assert.equal(PRESETS.edge85.hint, "84.9% reads C85 but isn't bold: the threshold uses the unrounded value.");
});

test('applyPreset: presets are scenarios, so stale then 85% edge resets the numbers first', () => {
  const stale = applyPreset(defaultState(false), 'stale');
  assert.equal(stale.fiveHour, 91);
  const edge = applyPreset(stale, 'edge85');
  assert.equal(edge.fiveHour, 37);
  assert.equal(edge.weekly, 88);
  assert.equal(edge.context, 84.9);
  const apikey = applyPreset({ ...edge, family: 'sonnet' }, 'apikey');
  assert.deepEqual([apikey.context, apikey.fiveHour, apikey.weekly], [63, 37, 88]);
  assert.equal(apikey.family, 'sonnet', 'model and effort are not part of a scenario');
  assert.equal(applyPreset(edge, null).context, 84.9, 'clearing a preset keeps the current values');
});

test('defaultState: wide shows git, cost and pr; narrow shows none', () => {
  assert.deepEqual(defaultState(false).segments, { git: true, cost: true, pr: true, task: false });
  assert.deepEqual(defaultState(true).segments, { git: false, cost: false, pr: false, task: false });
  assert.equal(defaultState(false).columns, 120);
});

test('copy JSON: all segments on is exactly the defaults, so the diff is {}', () => {
  const amp = createAmpline();
  const defaults = captureDefaults(amp);
  const all = { ...base, segments: { git: true, cost: true, pr: true, task: true } };
  amp.setConfig(configFor(all, false));
  assert.equal(amplinercJson(amp.getConfig(), defaults), '{}');
});

test('copy JSON: only the keys that differ from the defaults, pretty-printed', () => {
  const amp = createAmpline();
  const defaults = captureDefaults(amp);
  amp.setConfig(configFor({ ...base, noColor: true }, false)); // task is off
  const parsed = JSON.parse(amplinercJson(amp.getConfig(), defaults));
  assert.deepEqual(parsed, {
    segments: ['dir', 'git', 'model', 'context', 'fiveHour', 'weekly', 'cost', 'pr'],
    color: false,
  });
  assert.equal(amplinercJson(amp.getConfig(), defaults), JSON.stringify(parsed, null, 2));
});

test('captureDefaults is a deep clone: later setConfig does not mutate it', () => {
  const amp = createAmpline();
  const defaults = captureDefaults(amp);
  const before = JSON.stringify(defaults);
  amp.setConfig({ segments: ['model'] });
  assert.equal(JSON.stringify(defaults), before);
});

test('NO_COLOR: no escape sequences at all and no hyperlink', () => {
  const inst = instances();
  const out = renderPlayground({ ...base, noColor: true }, inst, Date.now());
  assert.doesNotMatch(out, /\u001b/);
  assert.match(out, /#1234/, 'the PR number is still shown as plain text');
  assert.equal(instanceFor({ ...base, noColor: true }, inst), inst.plain);
  assert.equal(instanceFor(base, inst), inst.color);
});

test('width flip: one line at columns = visible width + 2, two lines one column narrower', () => {
  const inst = instances();
  const wide = text(inst, { ...base, columns: 200 });
  assert.ok(!wide.includes('\n'));
  const w = [...wide].length; // every glyph in the default line is one column wide
  const at = (columns) => text(inst, { ...base, columns });
  assert.ok(!at(w + 2).includes('\n'), 'still one line at visible width + 2');
  const two = at(w + 1);
  assert.equal(two.split('\n').length, 2, 'splits one column earlier');
  assert.match(two.split('\n')[1], /^H37 /, 'line 2 starts at the 5-hour bar');
});

test('narrow mode ignores the width slider and renders at the fixed narrow columns', () => {
  const inst = instances();
  assert.equal(NARROW_COLUMNS, 60);
  const a = text(inst, { ...base, columns: 40 }, true);
  const b = text(inst, { ...base, columns: 200 }, true);
  assert.equal(a, b);
});

test('the module touches no DOM at import time', () => {
  assert.equal(typeof globalThis.document, 'undefined');
  assert.equal(typeof globalThis.window, 'undefined');
});

test('h() skips null, undefined and false children (append would render the text "null")', () => {
  // Same coercion as Element.append: a non-node argument becomes a text node of String(arg).
  const mk = (tag) => ({ tag, attrs: {}, kids: [],
    setAttribute(k, v) { this.attrs[k] = String(v); },
    append(...cs) { for (const c of cs) this.kids.push(typeof c === 'object' && c !== null ? c : { text: String(c) }); } });
  const doc = { createElement: mk };
  const child = mk('b');
  const el = h(doc, 'div', { class: 'x', text: 'hi' }, null, child, undefined, false);
  assert.deepEqual(el.kids, [child]);
  assert.equal(h(doc, 'div', {}, null).kids.length, 0, 'append is not called for only-empty children');
});
