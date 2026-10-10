import { parseAnsi, renderAnsi } from './ansi.js';
import { statusPayload, HERO_CYCLE, wheelIndex } from './payloads.js';

const PROMPT = 'refactor the cache layer and add tests';
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

// The hero line is decorative (aria-hidden), so it never contains links: a focusable <a> in there would be a
// keyboard trap for screen readers and a tiny tap target. The PR number renders as a plain colored span.
const NO_LINKS = () => null;

function paintLine(amp, line, [family, effort], equalizer) {
  const ansi = amp.renderStatusline(statusPayload({ family, effort }));
  line.replaceChildren(renderAnsi(parseAnsi(ansi), document, { safeLinkUrl: NO_LINKS }));
  line.classList.toggle('is-scrollable', line.scrollWidth > line.clientWidth);
  equalizer.hold(wheelIndex(family, effort));
}

function showPromptDone(body) {
  body.replaceChildren(el('span', 'p', '> '), document.createTextNode(PROMPT), el('br'), el('span', 'ansi-dim', '● Reading lib/cache.js …'));
}

export function startHero({ amp, equalizer, body, line }) {
  let i = 0, timer = null;
  const cycle = () => { i = (i + 1) % HERO_CYCLE.length; paintLine(amp, line, HERO_CYCLE[i], equalizer); };
  const start = () => { if (!timer && !reduce()) timer = setInterval(cycle, 2600); };
  const stop = () => { clearInterval(timer); timer = null; };
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  const powerUp = () => {
    paintLine(amp, line, HERO_CYCLE[0], equalizer);
    line.classList.remove('sl-off');
    if (!reduce()) [...line.children].forEach((c, k) => { c.classList.add('seg-in'); c.style.animationDelay = `${k * 60}ms`; });
    start();
  };

  if (reduce()) { showPromptDone(body); powerUp(); return; }
  let n = 0;
  const caret = el('span', 'caret');
  const typed = document.createTextNode('');
  body.replaceChildren(el('span', 'p', '> '), typed, caret);
  (function step() {
    typed.data = PROMPT.slice(0, n);
    if (n++ < PROMPT.length) return void setTimeout(step, 38);
    setTimeout(() => { showPromptDone(body); powerUp(); }, 350);
  })();
}
