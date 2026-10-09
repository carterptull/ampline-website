// Entry point. Module scripts run after the document is parsed, so every mount point exists.
import { createAmpline } from './runtime/ampline.js';

const amp = createAmpline({ columns: 120 });
document.getElementById('ampVersion').textContent = amp.version;

// Wiring that later tasks add here, each with its own import:
//   equalizer.js  mountEqualizer(#navVu, amp.colors.WHEEL, { size: 'nav' }), and the same for #heroVu ('hero')
//   copy.js       wireCopy(#copyBtn, 'npx ampline-claude --install', #copyStatus)
//   hero.js       startHero({ amp, equalizer: <hero equalizer>, body: #heroBody, line: #heroSl })
//   tour.js       renderTour({ amp: createAmpline({ columns: 500 }), mount: #tour })
//                 (its own instance: the tour reconfigures segments per card, and shared
//                 config would leak into the hero's cycling line)
