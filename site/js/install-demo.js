import { parseAnsi, renderAnsi } from './ansi.js';
import { statusPayload } from './payloads.js';
import { h } from './playground.js';

export const INSTALL_COMMAND = 'npx ampline-claude --install';
const SECOND_COMMAND = 'claude';

// The one hand-copied block on the site (DECISIONS.md D21): the installer's stdout, line for line, captured from
// the pinned ampline-claude. test/install-transcript.test.mjs runs the real installer and fails if this drifts.
export const INSTALL_TRANSCRIPT = [
  '✓ ampline-claude installed.',
  '',
  'Restart Claude Code or start a new session.',
  '',
  'Customize with ~/.amplinerc.json or a project .amplinerc.json:',
  'https://github.com/carterptull/ampline-claude#configuration',
];

// Milliseconds. Typing matches the hero (38ms a character).
const T = { start: 300, key: 38, afterCommand: 350, line: 120, beforePrompt: 500, afterPrompt: 350 };

// Like the hero line, this one is decorative and aria-hidden: no links, so no focusable <a> inside it.
const NO_LINKS = () => null;

// Declared at module level so it is easy to see what the page promises assistive tech: one static paragraph, no
// live region, with the same text the terminal ends up showing.
const spokenSummary = () => `Running ${INSTALL_COMMAND} prints: ${INSTALL_TRANSCRIPT.filter(Boolean).join(' ')}`;

// `amp` is its own createAmpline() instance (main.js), never shared with the hero's cycling line.
// The script is a queue of {delay, run} steps. Only the step at the head has a timer, and only while the tab is
// visible, so hiding the tab pauses the script exactly where it is and showing it re-arms the same step.
export function mountInstallDemo({ amp, mount, win = window, doc = win.document }) {
  const body = h(doc, 'div', { class: 'term-body' });
  const sl = h(doc, 'div', { class: 'sl sl-off', tabindex: '-1' });
  const figure = h(doc, 'figure', { class: 'term term-install', 'aria-hidden': 'true' },
    h(doc, 'div', { class: 'chrome' }, h(doc, 'i'), h(doc, 'i'), h(doc, 'i'), h(doc, 'span', { class: 'title', text: '~' })),
    body, sl);
  const summary = h(doc, 'p', { class: 'visually-hidden', text: spokenSummary() });
  const replay = h(doc, 'button', { class: 'copy', type: 'button', text: 'Replay' });
  mount.replaceChildren(figure, summary, h(doc, 'div', { class: 'install-actions' }, replay));

  const reduce = () => !!(typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const prompt = () => h(doc, 'span', { class: 'p', text: '$ ' });
  const text = (s) => doc.createTextNode(s);

  let nodes = [];
  const put = (...ns) => { nodes.push(...ns); body.replaceChildren(...nodes); };
  const drop = (n) => { nodes = nodes.filter((x) => x !== n); body.replaceChildren(...nodes); };

  function paintStatusline(animate) {
    const segs = h(doc, 'span');
    segs.inert = true;
    segs.appendChild(renderAnsi(parseAnsi(amp.renderStatusline(statusPayload())), doc, { safeLinkUrl: NO_LINKS }));
    sl.replaceChildren(segs);
    sl.classList.remove('sl-off');
    if (animate) [...segs.children].forEach((c, k) => { c.classList.add('seg-in'); c.style.animationDelay = `${k * 60}ms`; });
    sl.classList.toggle('is-scrollable', sl.scrollWidth > sl.clientWidth);
  }

  function clearScreen() {
    nodes = [];
    body.replaceChildren();
    sl.replaceChildren();
    sl.classList.add('sl-off');
    sl.classList.remove('is-scrollable');
  }

  function showFinal() {
    clearScreen();
    put(prompt(), text(`${INSTALL_COMMAND}\n`), text(`${INSTALL_TRANSCRIPT.join('\n')}\n`), prompt(), text(SECOND_COMMAND));
    paintStatusline(false);
  }

  let steps = [];
  let idx = 0;
  let timer = null;
  let io = null;

  const disarm = () => { if (timer !== null) { clearTimeout(timer); timer = null; } };
  function arm() {
    if (timer !== null || idx >= steps.length || doc.hidden) return;
    const step = steps[idx];
    timer = setTimeout(() => { timer = null; idx++; step.run(); arm(); }, step.delay);
  }
  doc.addEventListener('visibilitychange', () => (doc.hidden ? disarm() : arm()));

  function play() {
    if (io) { io.disconnect(); io = null; }
    disarm();
    steps = [];
    idx = 0;
    clearScreen();

    const step = (delay, run) => steps.push({ delay, run });
    const typeInto = (node, s, first) => {
      for (let n = 1; n <= s.length; n++) step(n === 1 ? first : T.key, () => { node.data = s.slice(0, n); });
    };

    const caret = h(doc, 'span', { class: 'caret' });
    const typed = text('');
    put(prompt(), typed, caret);
    typeInto(typed, INSTALL_COMMAND, T.start);
    step(T.afterCommand, () => { drop(caret); put(text('\n')); });
    for (const line of INSTALL_TRANSCRIPT) step(T.line, () => put(text(`${line}\n`)));

    const caret2 = h(doc, 'span', { class: 'caret' });
    const typed2 = text('');
    step(T.beforePrompt, () => put(prompt(), typed2, caret2));
    typeInto(typed2, SECOND_COMMAND, T.key);
    step(T.afterPrompt, () => { drop(caret2); paintStatusline(true); });
    arm();
  }

  replay.addEventListener('click', play);

  if (reduce()) {
    showFinal();
    replay.hidden = true;
  } else if (typeof win.IntersectionObserver === 'function') {
    io = new win.IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) play(); }, { threshold: 0.4 });
    io.observe(figure);
  } else {
    play();
  }

  return { play };
}
