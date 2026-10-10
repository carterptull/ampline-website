// Render target for site/og.png. Everything on the card comes from the real runtime, like the page itself.
import { createAmpline } from './runtime/ampline.js';
import { mountEqualizer } from './equalizer.js';
import { parseAnsi, renderAnsi } from './ansi.js';
import { statusPayload, wheelIndex } from './payloads.js';

const amp = createAmpline({ columns: 120 });
const vu = mountEqualizer(document.getElementById('ogVu'), amp.colors.WHEEL, { size: 'hero' });
vu.hold(wheelIndex('opus', 'xhigh'));

// No links: the card is a picture.
document.getElementById('ogSl').appendChild(renderAnsi(parseAnsi(amp.renderStatusline(statusPayload())), document, { safeLinkUrl: () => null }));
