// One-off: node scripts/make-wordmark.mjs <tempDirWithOpentype> <Michroma-Regular.ttf>
// Converts "ampline" to outlined paths so the site needs no web font for the logo.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const [, , tempDir, ttf] = process.argv;
const opentype = createRequire(`${tempDir}/package.json`)('opentype.js');
const font = opentype.loadSync(ttf);
const size = 100;
const path = font.getPath('ampline', 0, size * 0.8, size, { kerning: true, letterSpacing: 0.02 }); // .02em, matching the approved mockup's letter-spacing
const bb = path.getBoundingBox();
const w = Math.ceil(bb.x2 - bb.x1), h = Math.ceil(bb.y2 - bb.y1);
path.commands.forEach((c) => { for (const k of ['x', 'x1', 'x2']) if (k in c) c[k] -= bb.x1; for (const k of ['y', 'y1', 'y2']) if (k in c) c[k] -= bb.y1; });
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="ampline"><title>ampline</title><path fill="#ffffff" d="${path.toPathData(2)}"/></svg>\n`;
writeFileSync(new URL('../site/assets/wordmark.v1.svg', import.meta.url), svg);
console.log(`wordmark.v1.svg ${w}x${h}`);
