import { parseAnsi, renderAnsi } from './ansi.js';
import { statusPayload, HERO_CYCLE } from './payloads.js';

const PROMPT = 'refactor the cache layer and add tests';
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

// The hero line is decorative (aria-hidden), so it never contains links: a focusable <a> in there would be a
// keyboard trap for screen readers and a tiny tap target. The PR number renders as a plain colored span.
const NO_LINKS = () => null;

// The segments sit in an inert wrapper inside the (still scrollable, aria-hidden) line. The line is a moving
// picture of the product: it fades in and cycles through every wheel color, some of which are below 4.5:1 by
// design. Inert takes the picture out of the accessibility checks, while swipes still hit the line's own
// scroll box underneath. See DECISIONS.md D16.
function paintLine(amp, line, [family, effort]) {
  const ansi = amp.renderStatusline(statusPayload({ family, effort }));
  const segs = el('span');
  segs.inert = true;
  segs.appendChild(renderAnsi(parseAnsi(ansi), document, { safeLinkUrl: NO_LINKS }));
  line.replaceChildren(segs);
  line.classList.toggle('is-scrollable', line.scrollWidth > line.clientWidth);
  return segs;
}

function showPromptDone(body) {
  body.replaceChildren(el('span', 'p', '> '), document.createTextNode(PROMPT), el('br'), el('span', 'ansi-dim', '● Reading lib/cache.js …'));
}

// The hero wave above this line is deliberately not driven from here: it animates freely, exactly like the nav
// wave, and never holds a bar for the current model. See DECISIONS.md D18.
export function startHero({ amp, body, line }) {
  let i = 0, timer = null;
  const cycle = () => { i = (i + 1) % HERO_CYCLE.length; paintLine(amp, line, HERO_CYCLE[i]); };
  // A page opened in a background tab powers up hidden: the cycle waits for the first visibilitychange.
  const start = () => { if (!timer && !reduce() && !document.hidden) timer = setInterval(cycle, 2600); };
  const stop = () => { clearInterval(timer); timer = null; };
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  const powerUp = () => {
    const segs = paintLine(amp, line, HERO_CYCLE[0]);
    line.classList.remove('sl-off');
    if (!reduce()) [...segs.children].forEach((c, k) => { c.classList.add('seg-in'); c.style.animationDelay = `${k * 60}ms`; });
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
