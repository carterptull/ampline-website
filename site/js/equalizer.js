// The ampline logo line: 20 bars, one per wheel stop, colored from the runtime's WHEEL
// so the logo can never drift from the product. Colors are set via CSSOM (CSP-safe).
export const SNAPSHOT = [0.30,0.42,0.58,0.74,0.88,0.97,1.00,0.95,0.84,0.70,0.55,0.42,0.33,0.28,0.30,0.38,0.50,0.64,0.78,0.90];

export function mountEqualizer(container, wheelRgbs, { size = 'hero' } = {}) {
  const bars = wheelRgbs.map(([r, g, b], i) => {
    const s = document.createElement('span');
    s.style.setProperty('--c', `rgb(${r}, ${g}, ${b})`);
    s.style.setProperty('--i', String(i));
    s.style.setProperty('--snap', String(SNAPSHOT[i]));
    container.appendChild(s);
    return s;
  });
  container.classList.add(`vu-${size}`);
  return {
    bars,
    hold(i) { bars.forEach((b, j) => b.classList.toggle('hold', j === i)); },
    release() { bars.forEach((b) => b.classList.remove('hold')); },
  };
}
