// Entry point. Module scripts run after the document is parsed, so every mount point exists.
import { createAmpline } from './runtime/ampline.js';
import { mountEqualizer } from './equalizer.js';
import { wireCopy } from './copy.js';
import { startHero } from './hero.js';

const amp = createAmpline({ columns: 120 });
document.getElementById('ampVersion').textContent = amp.version;

// The logo line is colored from the runtime's own wheel, so it can't drift from the product.
const wheel = amp.colors.WHEEL;
mountEqualizer(document.getElementById('navVu'), wheel, { size: 'nav' });
const heroVu = mountEqualizer(document.getElementById('heroVu'), wheel, { size: 'hero' });

wireCopy(document.getElementById('copyBtn'), 'npx ampline-claude --install', document.getElementById('copyStatus'));
startHero({ amp, equalizer: heroVu, body: document.getElementById('heroBody'), line: document.getElementById('heroSl') });

// Wiring that later tasks add here, each with its own import:
//   tour.js       renderTour({ amp: createAmpline({ columns: 500 }), mount: #tour })
//                 (its own instance: the tour reconfigures segments per card, and shared
//                 config would leak into the hero's cycling line)
