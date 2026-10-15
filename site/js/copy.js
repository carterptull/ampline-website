// Copy-to-clipboard with a select-it-yourself fallback and an aria-live confirmation.
//   text      string, or a function returning the string (read at click time)
//   statusEl  the aria-live element that receives the confirmation
//   opts      { label = 'Copy', fallbackEl = #installCmd (element, or function returning one),
//               copiedMessage, selectedMessage }
export function wireCopy(button, text, statusEl, opts = {}) {
  const {
    label = 'Copy',
    fallbackEl = () => document.getElementById('installCmd'),
    copiedMessage = 'Install command copied to clipboard.',
    selectedMessage = 'Command selected. Press and hold, or Ctrl+C, to copy.',
  } = opts;
  let timer = null;
  const reset = () => {
    timer = null;
    button.textContent = label;
    button.classList.remove('is-copied');
    statusEl.textContent = '';
  };
  // One pending reset at a time, so a later click is never cut short by an earlier timer.
  const schedule = (ms) => { clearTimeout(timer); timer = setTimeout(reset, ms); };
  const fallback = () => {
    const code = typeof fallbackEl === 'function' ? fallbackEl() : fallbackEl;
    const range = document.createRange(); range.selectNodeContents(code);
    const sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(range); } // no selection API: still announce, never throw
    button.textContent = 'Selected';
    button.classList.remove('is-copied'); // selecting is not a copy: stays neutral
    statusEl.textContent = selectedMessage;
    schedule(2500);
  };
  button.addEventListener('click', () => {
    if (!navigator.clipboard || !window.isSecureContext) return fallback();
    const value = typeof text === 'function' ? text() : text;
    navigator.clipboard.writeText(value).then(() => {
      button.textContent = 'Copied';
      button.classList.add('is-copied');
      statusEl.textContent = copiedMessage;
      schedule(3000);
    }, fallback);
  });
}
