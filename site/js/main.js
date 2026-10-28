// Entry point. Module scripts run after the document is parsed, so every mount point exists.
import { createAmpline } from './runtime/ampline.js';
import { mountEqualizer } from './equalizer.js';
import { wireCopy } from './copy.js';
import { startHero } from './hero.js';
import { renderTour, watchScrollable } from './tour.js';
import { mountPlayground } from './playground.js';
import { mountInstallDemo, INSTALL_COMMAND } from './install-demo.js';

const amp = createAmpline({ columns: 120 });
document.getElementById('ampVersion').textContent = amp.version;

// The logo line is colored from the runtime's own wheel, so it can't drift from the product.
const wheel = amp.colors.WHEEL;
mountEqualizer(document.getElementById('navVu'), wheel, { size: 'nav' });
// Both waves animate freely; the hero wave is not tied to the cycling model line (DECISIONS.md D18).
mountEqualizer(document.getElementById('heroVu'), wheel, { size: 'hero' });

wireCopy(document.getElementById('copyBtn'), INSTALL_COMMAND, document.getElementById('copyStatus'));
startHero({ amp, body: document.getElementById('heroBody'), line: document.getElementById('heroSl') });

// The tour reconfigures segments/columns per card, so it gets its own instance: shared mutable config would leak into the hero's cycling line.
const tour = document.getElementById('tour');
renderTour({ amp: createAmpline({ columns: 500 }), mount: tour });
watchScrollable(tour);

// The playground builds its own instances (never shared with the hero or the tour): every control re-renders
// through the real runtime, and NO_COLOR is a second instance because colors.js reads it once at load.
mountPlayground({ mount: document.getElementById('playMount'), makeAmpline: createAmpline, win: window });

// The install demo also gets its own instance: it plays a fixed script and must not share state with the hero.
mountInstallDemo({ amp: createAmpline({ columns: 120 }), mount: document.getElementById('installMount'), win: window });
