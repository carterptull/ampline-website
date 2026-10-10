// Phase 1 stand-in for the playground: one static terminal, rendered by the real runtime like the hero line.
// Phase 2's playground.js replaces this file's mount. No links: the preview is a picture of the output.
import { parseAnsi, renderAnsi } from './ansi.js';
import { statusPayload } from './payloads.js';

const NO_LINKS = () => null;

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

// `amp` is a dedicated instance (see main.js) so nothing here shares config with the hero or the tour.
export function renderPlayPreview({ amp, mount, win = window }) {
  const fig = el('figure', 'term term-play');
  const chrome = el('div', 'chrome');
  chrome.setAttribute('aria-hidden', 'true');
  chrome.append(el('i'), el('i'), el('i'), el('span', 'title', 'claude · ~/code/widgets'));

  const line = el('div', 'sl');
  const ansi = amp.renderStatusline(statusPayload({ context: 91, weekly: 88 }));
  line.appendChild(renderAnsi(parseAnsi(ansi), document, { safeLinkUrl: NO_LINKS }));

  fig.append(chrome, line);
  const soon = el('p', 'soon', 'Interactive playground coming soon');
  const note = el('p', 'note', '5-hour and weekly bars need a Claude.ai subscription.');
  mount.replaceChildren(fig, soon, note);

  // The line keeps its exact columns and scrolls inside its own box; a scrollable region must be focusable and named.
  const mark = () => {
    const over = line.scrollWidth > line.clientWidth;
    line.classList.toggle('is-scrollable', over);
    if (over) {
      line.setAttribute('tabindex', '0');
      line.setAttribute('role', 'group');
      line.setAttribute('aria-label', 'Example ampline statusline, scrolls sideways');
    } else {
      for (const a of ['tabindex', 'role', 'aria-label']) line.removeAttribute(a);
    }
  };
  let pending = false;
  win.addEventListener('resize', () => {
    if (pending) return;
    pending = true;
    win.requestAnimationFrame(() => { pending = false; mark(); });
  });
  mark();
  if (win.document && win.document.fonts && win.document.fonts.ready) win.document.fonts.ready.then(mark);
}
