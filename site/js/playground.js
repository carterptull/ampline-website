// The playground: every control re-renders ampline's real renderer. The top half of this file is pure
// (no DOM, safe to import under node); mountPlayground() at the bottom builds the controls and wires them.
import { parseAnsi, renderAnsi } from './ansi.js';
import { statusPayload, FAMILIES, EFFORTS, MODEL_NAMES } from './payloads.js';
import { wireCopy } from './copy.js';
import { watchOverflow } from './tour.js';

// The wrap rule is `visibleWidth > COLUMNS - 2`, so a narrow screen gets a fixed small width: the line
// splits at line2From and line 2 (the H and W bars) fits a ~340px box.
export const NARROW_COLUMNS = 60;
const SEGMENT_KEYS = ['git', 'cost', 'pr', 'task']; // the toggleable ones, in the renderer's own order

export const PRESETS = {
  stale: {
    label: 'Stale cache',
    patch: { fiveHour: 91 },
    hint: 'No rate_limits in this payload, so ampline shows the last known usage from its cache, dimmed.',
  },
  edge85: {
    label: '85% edge',
    patch: { context: 84.9 },
    hint: "84.9% reads C85 but isn't bold: the threshold uses the unrounded value.",
  },
  apikey: {
    label: 'API-key account',
    patch: {},
    hint: 'API-key accounts get no 5-hour or weekly data from Claude Code, so there are no H/W bars.',
  },
};
export const NO_COLOR_HINT = 'NO_COLOR is set: ampline emits no color codes and no hyperlinks, only the plain text.';
export const SUBSCRIPTION_NOTE = '5-hour and weekly bars need a Claude.ai subscription.';

export function defaultState(narrow = false) {
  return {
    family: 'opus', effort: 'high', context: 63, fiveHour: 37, weekly: 88,
    segments: { git: !narrow, cost: !narrow, pr: !narrow, task: false },
    noColor: false, columns: 120, preset: null,
  };
}

// Presets are scenarios, not patches: the three numbers go back to the defaults before the preset's own
// values apply, so Stale then 85% edge does not keep the stale 91%. Presets are mutually exclusive:
// `null` (or the active key clicked again) leaves the state manual, values as they are.
export function applyPreset(state, key) {
  if (!key || !PRESETS[key]) return { ...state, preset: null };
  const { context, fiveHour, weekly } = defaultState();
  return { ...state, context, fiveHour, weekly, ...PRESETS[key].patch, preset: key };
}

export function configFor(state, narrow) {
  const on = SEGMENT_KEYS.filter((k) => state.segments && state.segments[k]);
  const segments = narrow
    ? ['model', 'context', 'fiveHour', 'weekly', ...on]
    : ['dir', ...(on.includes('git') ? ['git'] : []), 'model', 'context', 'fiveHour', 'weekly',
      ...['cost', 'task', 'pr'].filter((k) => on.includes(k))];
  const config = { segments, line2From: 'fiveHour' };
  if (state.noColor) config.color = false; // the real .amplinerc.json equivalent of NO_COLOR
  return config;
}

// `stale` and `apikey` both drop rate_limits; what differs is whether the runtime cache holds earlier values
// (see renderPlayground). Preset patches (91%, 84.9%) are applied to the state by applyPreset, not here.
export function buildPlaygroundInput(state, now) {
  const withLimits = state.preset !== 'stale' && state.preset !== 'apikey';
  return statusPayload({
    family: state.family, effort: state.effort,
    context: state.context, fiveHour: state.fiveHour, weekly: state.weekly,
    rateLimits: withLimits, now,
  });
}

export function instanceFor(state, instances) {
  return state.noColor ? instances.plain : instances.color;
}

// Output is a pure function of (state, narrow, now): the cache is cleared first, and the stale preset seeds
// it with one live render of the same state so the stale payload really is served from the cache.
export function renderPlayground(state, instances, now = Date.now(), narrow = false) {
  const amp = instanceFor(state, instances);
  amp.resetCache();
  amp.setConfig(configFor(state, narrow));
  amp.setColumns(narrow ? NARROW_COLUMNS : state.columns);
  if (state.preset === 'stale') amp.renderStatusline(buildPlaygroundInput({ ...state, preset: null }, now));
  return amp.renderStatusline(buildPlaygroundInput(state, now));
}

// Defaults are captured once from a fresh instance, deep-cloned so later setConfig calls cannot touch them.
export function captureDefaults(amp) {
  return JSON.parse(JSON.stringify(amp.getConfig()));
}

// Only the keys that differ from the defaults, like a hand-written .amplinerc.json. `{}` when none do.
export function amplinercJson(effective, defaults) {
  const out = {};
  for (const key of Object.keys(effective)) {
    if (JSON.stringify(effective[key]) !== JSON.stringify(defaults[key])) out[key] = effective[key];
  }
  return JSON.stringify(out, null, 2);
}

// ---- DOM wiring (browser only) -------------------------------------------------------------------------

function h(doc, tag, props = {}, ...kids) {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  if (kids.length) e.append(...kids);
  return e;
}

const fmtPct = (v) => `${Number(v).toFixed(1)}%`;

// `makeAmpline` is createAmpline (injected so main.js owns the instances); both instances here belong to the
// playground alone and are never shared with the hero or the tour.
export function mountPlayground({ mount, makeAmpline, win = window }) {
  const doc = win.document;
  const mq = typeof win.matchMedia === 'function' ? win.matchMedia('(max-width: 820px)') : null;
  let narrow = !!(mq && mq.matches);
  let state = defaultState(narrow);
  let segmentsTouched = false;

  const color = makeAmpline({ columns: 120 });
  const defaults = captureDefaults(color);
  let plain = null; // the NO_COLOR instance is built the first time it is needed
  const instances = { color, get plain() { return plain || (plain = makeAmpline({ noColor: true, columns: 120 })); } };

  // --- controls
  const modelId = 'pg-model';
  const model = h(doc, 'select', { id: modelId });
  for (const f of FAMILIES) model.append(h(doc, 'option', { value: f, text: MODEL_NAMES[f].name }));
  const effortId = 'pg-effort';
  const effort = h(doc, 'select', { id: effortId });
  for (const e of EFFORTS) effort.append(h(doc, 'option', { value: e, text: e }));

  const range = (id, min, max, step) => h(doc, 'input', { id, type: 'range', min, max, step });
  const sliders = {
    context: { id: 'pg-context', label: 'Context used', input: range('pg-context', 0, 100, 0.1) },
    fiveHour: { id: 'pg-fivehour', label: '5-hour limit used', input: range('pg-fivehour', 0, 100, 0.1) },
    weekly: { id: 'pg-weekly', label: 'Weekly limit used', input: range('pg-weekly', 0, 100, 0.1) },
  };
  // aria-live off: <output> is implicitly a live region; only the debounced status region should speak.
  for (const s of Object.values(sliders)) s.output = h(doc, 'output', { for: s.id, 'aria-live': 'off' });
  const widthInput = range('pg-width', 40, 200, 1);
  const widthOutput = h(doc, 'output', { for: 'pg-width', 'aria-live': 'off' });

  const toggle = (text) => h(doc, 'button', { type: 'button', 'aria-pressed': 'false', text });
  const segButtons = {};
  for (const k of SEGMENT_KEYS) segButtons[k] = toggle(k);
  const noColorBtn = toggle('NO_COLOR');
  const presetButtons = {};
  for (const [k, p] of Object.entries(PRESETS)) presetButtons[k] = toggle(p.label);

  const select = (id, text, control) => h(doc, 'div', { class: 'field' }, h(doc, 'label', { for: id, text }), control);
  const slider = (s) => h(doc, 'div', { class: 'field' },
    h(doc, 'div', { class: 'row' }, h(doc, 'label', { for: s.id, text: s.label }), s.output), s.input);
  // The hint paragraph is always rendered (empty when nothing applies) with a reserved height, so choosing a
  // preset never moves anything below it. It sits right under the buttons that cause it.
  const group = (id, title, hint, ...buttons) => h(doc, 'div', { class: 'field', role: 'group', 'aria-labelledby': id },
    h(doc, 'span', { id, text: title }), h(doc, 'div', { class: 'seg-toggles' }, ...buttons), hint);
  const envHint = h(doc, 'p', { class: 'note play-hint' });
  const presetHint = h(doc, 'p', { class: 'note play-hint' });

  const widthField = h(doc, 'div', { class: 'field' },
    h(doc, 'div', { class: 'row' }, h(doc, 'label', { for: 'pg-width', text: 'Terminal width' }), widthOutput), widthInput);

  const ctl = h(doc, 'div', { class: 'ctl' },
    select(modelId, 'Model', model),
    select(effortId, 'Effort', effort),
    slider(sliders.context), slider(sliders.fiveHour), slider(sliders.weekly),
    widthField,
    group('pg-segs', 'Segments', null, ...SEGMENT_KEYS.map((k) => segButtons[k])),
    group('pg-env', 'Environment', envHint, noColorBtn),
    group('pg-presets', 'Edge cases', presetHint, ...Object.keys(PRESETS).map((k) => presetButtons[k])));

  // --- preview, hints, config JSON
  const line = h(doc, 'div', { class: 'sl', id: 'playLine', role: 'group', 'aria-label': 'ampline statusline preview' });
  const chrome = h(doc, 'div', { class: 'chrome', 'aria-hidden': 'true' },
    h(doc, 'i'), h(doc, 'i'), h(doc, 'i'), h(doc, 'span', { class: 'title', text: 'claude · ~/code/widgets' }));
  const figure = h(doc, 'figure', { class: 'term' }, chrome, line);

  const liveStatus = h(doc, 'div', { class: 'sr-status', role: 'status', 'aria-live': 'polite' });
  const copyStatus = h(doc, 'div', { class: 'sr-status', role: 'status', 'aria-live': 'polite' });

  const pre = h(doc, 'pre', { id: 'playJson', tabindex: '0', 'aria-label': 'Current .amplinerc.json' });
  const details = h(doc, 'details', { class: 'play-json' },
    h(doc, 'summary', { text: 'Show .amplinerc.json' }), pre);
  const copyBtn = h(doc, 'button', { type: 'button', class: 'copy', text: 'Copy .amplinerc.json' });
  const subscriptionNote = h(doc, 'p', { class: 'note play-note', text: SUBSCRIPTION_NOTE });
  const after = h(doc, 'div', { class: 'play-after' }, copyBtn, details, copyStatus);

  const out = h(doc, 'div', { class: 'play-out' }, figure, subscriptionNote, after, liveStatus);
  mount.replaceChildren(h(doc, 'div', { class: 'play' }, ctl, out));

  let json = '{}';
  wireCopy(copyBtn, () => json, copyStatus, {
    label: 'Copy .amplinerc.json',
    copiedMessage: '.amplinerc.json copied to clipboard.',
    selectedMessage: 'JSON selected. Press and hold, or Ctrl+C, to copy.',
    fallbackEl: () => { details.open = true; return pre; },
  });

  // The preview scrolls inside its own box when it overflows; only then is it a focus stop.
  const mark = watchOverflow(() => [line], (el, over) => {
    if (over) el.setAttribute('tabindex', '0'); else el.removeAttribute('tabindex');
  }, win);

  // --- state -> DOM
  let announceTimer = null;
  const announce = (text) => {
    win.clearTimeout(announceTimer);
    announceTimer = win.setTimeout(() => { liveStatus.textContent = text; }, 600);
  };

  function sync() {
    model.value = state.family;
    effort.value = state.effort;
    for (const [k, s] of Object.entries(sliders)) {
      s.input.value = String(state[k]);
      s.output.textContent = fmtPct(state[k]);
    }
    widthInput.value = String(state.columns);
    widthOutput.textContent = `${state.columns} cols`;
    widthField.hidden = narrow;
    for (const k of SEGMENT_KEYS) segButtons[k].setAttribute('aria-pressed', String(!!state.segments[k]));
    noColorBtn.setAttribute('aria-pressed', String(state.noColor));
    for (const k of Object.keys(PRESETS)) presetButtons[k].setAttribute('aria-pressed', String(state.preset === k));

    presetHint.textContent = state.preset ? PRESETS[state.preset].hint : '';
    envHint.textContent = state.noColor ? NO_COLOR_HINT : '';
  }

  let quiet = true; // no announcement for the initial render
  function render() {
    const ansi = renderPlayground(state, instances, Date.now(), narrow);
    const amp = instanceFor(state, instances);
    line.replaceChildren(renderAnsi(parseAnsi(ansi), doc, { safeLinkUrl: amp.safeLinkUrl }));
    json = amplinercJson(amp.getConfig(), defaults);
    pre.textContent = json;
    mark();
    if (!quiet) announce(amp.stripAnsi(ansi).split('\n').join('. '));
  }

  // One render per frame, however many input events arrive.
  let framePending = false;
  function schedule() {
    sync();
    if (framePending) return;
    framePending = true;
    win.requestAnimationFrame(() => { framePending = false; render(); });
  }
  // Moving a slider, select or segment clears the active preset: the state is then fully manual.
  const change = (patch, { manual = true } = {}) => {
    quiet = false;
    state = { ...state, ...patch, preset: manual ? null : state.preset };
    schedule();
  };

  model.addEventListener('change', () => change({ family: model.value }));
  effort.addEventListener('change', () => change({ effort: effort.value }));
  for (const [k, s] of Object.entries(sliders)) {
    s.input.addEventListener('input', () => change({ [k]: Number(s.input.value) }));
  }
  widthInput.addEventListener('input', () => change({ columns: Number(widthInput.value) }));
  for (const k of SEGMENT_KEYS) {
    segButtons[k].addEventListener('click', () => {
      segmentsTouched = true;
      change({ segments: { ...state.segments, [k]: !state.segments[k] } });
    });
  }
  noColorBtn.addEventListener('click', () => change({ noColor: !state.noColor }, { manual: false }));
  for (const k of Object.keys(PRESETS)) {
    presetButtons[k].addEventListener('click', () => {
      quiet = false;
      state = applyPreset(state, state.preset === k ? null : k);
      schedule();
    });
  }

  if (mq) {
    const onMode = (e) => {
      narrow = e.matches;
      // Untouched toggles follow the mode's defaults (narrow shows only the two bars lines).
      if (!segmentsTouched) state = { ...state, segments: defaultState(narrow).segments };
      schedule();
    };
    if (mq.addEventListener) mq.addEventListener('change', onMode);
    else if (mq.addListener) mq.addListener(onMode);
  }

  sync();
  render();
}
