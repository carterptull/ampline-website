// ampline only ever emits: ESC[38;2;R;G;Bm, ESC[0m, ESC[1m, ESC[2m and OSC 8 links ending in BEL
// (lib/colors.js, lib/segments/pr.js). This parser handles exactly those and drops anything else.
const SEQ = /\u001b\[([0-9;]*)m|\u001b\]8;;([^\u0007\u001b]*)(?:\u0007|\u001b\\)|\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;

export function parseAnsi(str) {
  const tokens = [];
  const st = { fg: null, bold: false, dim: false, href: null };
  let last = 0;
  const push = (text) => {
    if (!text) return;
    const prev = tokens[tokens.length - 1];
    if (prev && prev.fg === st.fg && prev.bold === st.bold && prev.dim === st.dim && prev.href === st.href) prev.text += text;
    else tokens.push({ text, fg: st.fg, bold: st.bold, dim: st.dim, href: st.href });
  };
  String(str).replace(SEQ, (m, sgr, href, idx) => {
    push(str.slice(last, idx));
    last = idx + m.length;
    if (sgr !== undefined) {
      const p = sgr === '' ? [0] : sgr.split(';').map(Number);
      for (let i = 0; i < p.length; i++) {
        if (p[i] === 0) { st.fg = null; st.bold = false; st.dim = false; }
        else if (p[i] === 1) st.bold = true;
        else if (p[i] === 2) st.dim = true;
        else if (p[i] === 38 && p[i + 1] === 2) { st.fg = [p[i + 2], p[i + 3], p[i + 4]]; i += 4; }
      }
    } else if (href !== undefined) {
      st.href = href || null;
    }
    return m;
  });
  push(str.slice(last));
  return tokens.map((t) => ({ ...t, fg: t.fg ? t.fg.slice() : null }));
}

export function renderAnsi(tokens, doc, { safeLinkUrl }) {
  const frag = doc.createDocumentFragment();
  for (const t of tokens) {
    const href = t.href ? safeLinkUrl(t.href) : null;
    const el = doc.createElement(href ? 'a' : 'span');
    if (href) {
      el.setAttribute('href', href);
      el.setAttribute('rel', 'noopener noreferrer');
      el.setAttribute('target', '_blank');
    }
    if (t.fg) el.style.color = `rgb(${t.fg[0]}, ${t.fg[1]}, ${t.fg[2]})`;
    if (t.bold) el.style.fontWeight = '700';
    if (t.dim) el.className = 'ansi-dim';
    el.textContent = t.text;
    frag.appendChild(el);
  }
  return frag;
}
