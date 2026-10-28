import { parseAnsi, renderAnsi } from './ansi.js';
import { subagentRows } from './runtime/ampline.js';
import { statusPayload, subagentPayload } from './payloads.js';

// Every sample below is real renderer output for a single-segment config. Only the prose is typed.
const CARDS = [
  { seg: 'model', title: 'Model · effort', desc: 'Colored by model and effort from a 20-step wheel (4 model families × 5 efforts). Identity, not urgency: only max goes bold.', payload: { family: 'opus', effort: 'xhigh' } },
  { seg: 'context', title: 'Context window', desc: 'Percent used as of the last completed API call, on its own green to red danger scale. Bold from 85%, a warning sign from 95%.', payload: { context: 63 } },
  { seg: ['fiveHour', 'weekly'], title: '5-hour + weekly limits', desc: 'Plan usage with a live reset countdown. The ┃ pace marker shows how much of the window has passed, assuming 5-hour and 7-day windows (left out when the reset time is unknown or the bar is stale). Needs a Claude.ai subscription.', payload: { fiveHour: 24, weekly: 41 } },
  { seg: 'git', title: 'Git', desc: 'Branch, ahead / behind and dirty state, from one cached git call.', payload: {} },
  { seg: 'cost', title: 'Cost + lines', desc: "Claude Code's own client-side estimate of the session cost, plus lines changed. Not your bill.", payload: {} },
  { seg: 'pr', title: 'PR / MR', desc: 'PR/MR data comes from Claude Code (ampline runs neither gh nor glab). Colored by review state, clickable in terminals that support links; on a GitLab MR, green means mergeable.', payloads: [{ pr: { number: 1234, review_state: 'approved' } }, { pr: { kind: 'mr', number: 42, review_state: 'pending' } }] },
  { seg: 'task', title: 'Current task', desc: "What Claude is working on right now: the in-progress item from its todo list, read locally from your Claude config folder and cut at 40 characters. Hidden when there isn't one.", payload: {} },
];

function card(doc, id, title, desc, lineFragments, wide) {
  const c = doc.createElement('article'); c.className = 'card' + (wide ? ' span2' : '');
  const h = doc.createElement('h3'); h.setAttribute('id', id); h.textContent = title;
  const s = doc.createElement('div'); s.className = 's';
  lineFragments.forEach((f, i) => { if (i) s.appendChild(doc.createTextNode('   ')); s.appendChild(f); });
  const p = doc.createElement('p'); p.className = 'd'; p.textContent = desc;
  c.append(h, s, p);
  return c;
}

// `doc` defaults to the page's document; tests pass a stand-in.
export function renderTour({ amp, mount, doc = document }) {
  const frag = (ansi) => renderAnsi(parseAnsi(ansi), doc, { safeLinkUrl: amp.safeLinkUrl });
  // amp is a dedicated instance at 500 columns (see main.js): one segment per card never wraps.
  let n = 0;
  for (const def of CARDS) {
    // line2From is the card's first segment, so nothing splits onto a second line.
    amp.setConfig({ segments: [].concat(def.seg), line2From: [].concat(def.seg)[0] });
    const payloads = def.payloads || [def.payload];
    mount.appendChild(card(doc, `tour-h-${n++}`, def.title, def.desc, payloads.map((p) => frag(amp.renderStatusline(statusPayload(p))))));
  }
  amp.setConfig({});
  // The renderer answers with JSON lines; the rows' ANSI content is what Claude Code shows.
  const sub = subagentRows(amp.renderSubagentLine(subagentPayload({ columns: 100 }))).join('\n');
  mount.appendChild(card(doc, `tour-h-${n}`, 'Subagents get their own lines', "Shown in Claude Code's subagent panel while subagents run (the installer sets that up too). One row per subagent: arrow and label colored by status (running, queued, failed; done is dim), model colored by family.", [frag(sub)], true));
}

// Shared overflow watcher: `elements()` yields the scrollable boxes, `onChange(el, over)` applies the
// element's own accessibility attributes. Re-checked on resize (one pending frame at a time) and once the mono
// font has loaded. Returns `mark` so callers can re-measure after they change the content.
export function watchOverflow(elements, onChange, win = window) {
  const mark = () => {
    for (const el of elements()) {
      const over = el.scrollWidth > el.clientWidth;
      el.classList.toggle('is-scrollable', over);
      onChange(el, over);
    }
  };
  let pending = false;
  const onResize = () => {
    if (pending) return;
    pending = true;
    win.requestAnimationFrame(() => { pending = false; mark(); });
  };
  mark();
  win.addEventListener('resize', onResize);
  if (win.document && win.document.fonts && win.document.fonts.ready) win.document.fonts.ready.then(mark);
  return mark;
}

// Samples keep their exact columns and scroll inside their own box; flag the ones that overflow so the
// CSS edge fade hints at the hidden part.
export function watchScrollable(mount, win = window) {
  return watchOverflow(() => mount.querySelectorAll('.s'), (s, over) => {
    // A scrollable region must be keyboard-focusable and have an accessible name (the card's heading).
    if (over) {
      s.setAttribute('tabindex', '0');
      s.setAttribute('role', 'group');
      const h = s.previousElementSibling;
      if (h && h.id) s.setAttribute('aria-labelledby', h.id);
    } else {
      for (const a of ['tabindex', 'role', 'aria-labelledby']) s.removeAttribute(a);
    }
  }, win);
}
