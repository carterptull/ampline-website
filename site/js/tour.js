import { parseAnsi, renderAnsi } from './ansi.js';
import { statusPayload, subagentPayload } from './payloads.js';

// Every sample below is real renderer output for a single-segment config. Only the prose is typed.
const CARDS = [
  { seg: 'model', title: 'Model · effort', desc: 'Colored by model and effort from a 20-step wheel (4 model families × 5 efforts). Identity, not urgency: only max goes bold.', payload: { family: 'opus', effort: 'xhigh' } },
  { seg: 'context', title: 'Context window', desc: 'Percent used as of the last completed API call, on its own green to red danger scale. Bold from 85%, a warning sign from 95%.', payload: { context: 63 } },
  { seg: ['fiveHour', 'weekly'], title: '5-hour + weekly limits', desc: 'Plan usage with a live reset countdown. Needs a Claude.ai subscription.', payload: { fiveHour: 24, weekly: 41 } },
  { seg: 'git', title: 'Git', desc: 'Branch, ahead / behind, dirty. One cached, hook-proof git call.', payload: {} },
  { seg: 'cost', title: 'Cost + lines', desc: "Claude Code's own client-side estimate of the session cost, plus lines changed. Not your bill.", payload: {} },
  { seg: 'pr', title: 'PR / MR', desc: 'The PR/MR data comes from Claude Code; ampline runs neither gh nor glab. Clickable, colored by review state; on a GitLab MR, green means mergeable.', payloads: [{ pr: { number: 1234, review_state: 'approved' } }, { pr: { kind: 'mr', number: 42, review_state: 'pending' } }] },
  { seg: 'task', title: 'Current task', desc: 'The todo Claude is working on right now.', payload: {} },
];

function card(doc, title, desc, lineFragments, wide) {
  const c = doc.createElement('article'); c.className = 'card' + (wide ? ' span2' : '');
  const h = doc.createElement('h3'); h.textContent = title;
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
  for (const def of CARDS) {
    // line2From is the card's first segment, so nothing splits onto a second line.
    amp.setConfig({ segments: [].concat(def.seg), line2From: [].concat(def.seg)[0] });
    const payloads = def.payloads || [def.payload];
    mount.appendChild(card(doc, def.title, def.desc, payloads.map((p) => frag(amp.renderStatusline(statusPayload(p))))));
  }
  amp.setConfig({});
  const sub = amp.renderSubagentLine(subagentPayload({ columns: 100 }));
  mount.appendChild(card(doc, 'Subagents get their own lines', 'One row per subagent, colored by status: running, queued, done, failed.', [frag(sub)], true));
}

// Samples keep their exact columns and scroll inside their own box; flag the ones that overflow so the
// CSS edge fade hints at the hidden part. Re-checked on resize and once the mono font has loaded.
export function watchScrollable(mount, win = window) {
  const mark = () => {
    for (const s of mount.querySelectorAll('.s')) {
      const over = s.scrollWidth > s.clientWidth;
      s.classList.toggle('is-scrollable', over);
      // keyboard users can only scroll a focusable region
      if (over) s.setAttribute('tabindex', '0'); else s.removeAttribute('tabindex');
    }
  };
  mark();
  win.addEventListener('resize', mark);
  if (win.document && win.document.fonts && win.document.fonts.ready) win.document.fonts.ready.then(mark);
}
