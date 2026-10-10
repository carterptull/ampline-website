export function wireCopy(button, text, statusEl) {
  let timer = null;
  const reset = () => {
    timer = null;
    button.textContent = 'Copy';
    button.classList.remove('is-copied');
    statusEl.textContent = '';
  };
  // One pending reset at a time, so a later click is never cut short by an earlier timer.
  const schedule = (ms) => { clearTimeout(timer); timer = setTimeout(reset, ms); };
  const fallback = () => {
    const code = document.getElementById('installCmd');
    const range = document.createRange(); range.selectNodeContents(code);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    button.textContent = 'Selected';
    button.classList.remove('is-copied'); // selecting is not a copy: stays neutral
    statusEl.textContent = 'Command selected. Press and hold, or Ctrl+C, to copy.';
    schedule(2500);
  };
  button.addEventListener('click', () => {
    if (!navigator.clipboard || !window.isSecureContext) return fallback();
    navigator.clipboard.writeText(text).then(() => {
      button.textContent = 'Copied';
      button.classList.add('is-copied');
      statusEl.textContent = 'Install command copied to clipboard.';
      schedule(3000);
    }, fallback);
  });
}
