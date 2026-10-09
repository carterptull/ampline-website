export function wireCopy(button, text, statusEl) {
  const reset = () => { button.textContent = 'Copy'; statusEl.textContent = ''; };
  const fallback = () => {
    const code = document.getElementById('installCmd');
    const range = document.createRange(); range.selectNodeContents(code);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    button.textContent = 'Selected';
    statusEl.textContent = 'Command selected. Press and hold, or Ctrl+C, to copy.';
    setTimeout(reset, 2500);
  };
  button.addEventListener('click', () => {
    if (!navigator.clipboard || !window.isSecureContext) return fallback();
    navigator.clipboard.writeText(text).then(() => {
      button.textContent = 'Copied';
      statusEl.textContent = 'Install command copied to clipboard.';
      setTimeout(reset, 1600);
    }, fallback);
  });
}
