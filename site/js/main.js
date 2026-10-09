// Entry point. Module scripts run after the document is parsed, so every mount point exists.
import { createAmpline } from './runtime/ampline.js';
import { mountEqualizer } from './equalizer.js';
import { wireCopy } from './copy.js';
import { startHero } from './hero.js';
import { renderTour, watchScrollable } from './tour.js';

const amp = createAmpline({ columns: 120 });
document.getElementById('ampVersion').textContent = amp.version;

// The logo line is colored from the runtime's own wheel, so it can't drift from the product.
const wheel = amp.colors.WHEEL;
mountEqualizer(document.getElementById('navVu'), wheel, { size: 'nav' });
const heroVu = mountEqualizer(document.getElementById('heroVu'), wheel, { size: 'hero' });

wireCopy(document.getElementById('copyBtn'), 'npx ampline-claude --install', document.getElementById('copyStatus'));
startHero({ amp, equalizer: heroVu, body: document.getElementById('heroBody'), line: document.getElementById('heroSl') });

// The tour reconfigures segments/columns per card, so it gets its own instance: shared mutable config would leak into the hero's cycling line.
const tour = document.getElementById('tour');
renderTour({ amp: createAmpline({ columns: 500 }), mount: tour });
watchScrollable(tour);

// Phase 2 wiring lands here, each with its own import: playground.js, install-demo.js.
