# Decisions

Lightweight ADR-style entries. Each one gives the decision, why it was made, and what was
considered instead. Reversing any of them is cheap unless noted.

---

### D1. A separate repo for the website

**Decision:** The site lives in its own repo, `carterptull/ampline-website`, not inside `ampline-claude`.

**Why:** `ampline-claude` ships to npm, and its zero-dependency, nothing-extra package is the point. A website adds assets, a dev server and hosting config that have no place in the published package, and it deploys on its own schedule. The site depends on the package (pinned devDependency), never the other way round.

**Alternatives:** a `site/` folder inside `ampline-claude` (bloats the package repo and couples release cadence); a monorepo (tooling cost for two small projects).

### D2. Vercel hosting, `ampline.js.org` via js.org with `// noCF`

**Decision:** Host on Vercel and serve it at `ampline.js.org`. The js.org entry is `"ampline": "cname.vercel-dns.com", // noCF`.

**Why:** Vercel gives free static hosting, preview deploys on every PR and header control through `vercel.json`. `// noCF` is mandatory because Vercel cannot sit behind js.org's Cloudflare proxy. js.org suits a Node.js package and costs nothing.

**Alternatives:** GitHub Pages (no custom headers, so no real Content-Security-Policy); Netlify (equivalent, but Vercel was already in use). If js.org rejects the request, a cheap registered domain pointed at Vercel needs no site changes.

### D3. No build step, native ES modules

**Decision:** The site is plain HTML, CSS and ES modules, plus one committed generated file. No bundler, no framework, no `build` script.

**Why:** It matches ampline's zero-dependency ethos, keeps the Vercel config trivial (output directory `site`, no build command) and keeps every file reviewable as written. Never add a `build` script without revisiting this decision.

**Alternatives:** Vite or Next.js (a toolchain and dependency tree for a single page); a bundler only for the runtime (the sync script already does the one transformation needed).

### D4. The real renderer via a sync script and pre-wrapped factories

**Decision:** `scripts/sync-ampline.mjs` copies the renderer's CommonJS source byte-for-byte out of the pinned `ampline-claude` package and wraps each file into a function inside one generated module, `site/js/runtime/factories.generated.js`. A small in-browser `require` registry runs those factories. The generated file is never hand-edited, and CI fails if it is stale.

**Why:** The demos must show what the product really prints, and drift between a reimplementation and the real thing would be a lie. The Content-Security-Policy forbids `eval` and `new Function`, so the wrapping has to happen at sync time, not at runtime.

**Alternatives:** reimplementing the renderer for the web (drifts, and misrepresents the product); loading CommonJS with `eval` (blocked by the CSP); bundling at deploy time (adds a build step, see D3).

### D5. DOM-only ANSI rendering

**Decision:** Statusline ANSI output is parsed into tokens and turned into DOM nodes with `textContent`. Colors are set through the CSSOM (`el.style.color`, `el.style.setProperty`). No `innerHTML` with markup, no `style=` attributes, no `on*=` attributes anywhere in `site/`.

**Why:** `style-src 'self'` without `'unsafe-inline'` silently drops inline style strings, so colors would vanish in production only. Building nodes also means untrusted text can never become markup.

**Alternatives:** generating HTML strings with inline styles (needs `'unsafe-inline'`, weakening the CSP); `'unsafe-inline'` with nonces (not possible on a static host without a build step).

### D6. The Michroma wordmark ships as an SVG

**Decision:** The "ampline" wordmark is set in Michroma (SIL OFL), converted once to outlined SVG paths and committed.

**Why:** The site then loads no display font at all, which keeps the zero-third-party and fast-first-paint goals simple. Outlines render identically on every platform.

**Alternatives:** self-hosting the Michroma font (an extra font file for one word); a system font (loses the brand).

### D7. A "D2 wave" logo

**Decision:** The logo mark is a row of 20 equalizer bars, one per stop on the model/effort color wheel, rising and falling in a travelling wave. (An earlier design also held the bar matching the hero statusline's current model and effort lit; D18 removed that.)

**Why:** It is a literal picture of the product's 20-step wheel, so the logo and the statusline cannot drift: the bars read the wheel colors from the vendored renderer at runtime. A frozen snapshot serves the favicon, OG card, README and reduced-motion users.

**Alternatives:** a static wordmark only (nothing links the brand to the product); other wave variants explored during design.

### D8. Hero layout A (centered stack)

**Decision:** The hero is a centered stack: wordmark, wave, slogan and subline, copyable install command, meta line, then a faux Claude Code window.

**Why:** It puts the install command and the live statusline in the first screen on both phones and desktops, with no side-by-side layout to collapse on narrow screens.

**Alternatives:** a two-column hero with the demo beside the text (cramped at phone widths).

### D9. Self-hosted, subset Iosevka Fixed (exposed as "ampline mono")

**Decision:** The monospace face is Iosevka Fixed Regular and Bold v34.9.0 (SIL OFL), subset to Latin plus the statusline glyphs, self-hosted as `mono-400.v1.woff2` and `mono-700.v1.woff2` and exposed as the `"ampline mono"` family.

**Why:** Every glyph in the bars must come from one font, or the bars misalign; iOS has no suitable mono, so it has to be shipped. JetBrains Mono v2.304 was the first choice but lacks `↺` (U+21BA), `⎇` (U+2387) and `↳` (U+21B3); DejaVu Sans Mono has `↺` and `↳` but not `⎇`. Iosevka Fixed has all 14 statusline glyphs at the same advance as `M`. Subsetting keeps each file near 12 KB, and self-hosting keeps the page at zero third-party requests.

**Alternatives:** JetBrains Mono (three glyphs would fall back to another font and break alignment); DejaVu Sans Mono (no `⎇`); a system monospace stack (glyph fallback breaks bar alignment); a font CDN (a third-party request). Iosevka is narrower than JetBrains Mono, so `ch`-based widths are 500/1000 em instead of 600/1000.

### D10. No analytics

**Decision:** No analytics of any kind.

**Why:** npm download counts and GitHub traffic are enough, and it keeps the "0 trackers, 0 third-party requests" claim in the footer true.

**Alternatives:** privacy-friendly analytics (still a third-party request or a script, and still not needed).

### D11. Dark only

**Decision:** The site is dark only, with `color-scheme: dark` and no light mode.

**Why:** Black is the brand, and the only color on the page is meant to come from the ampline wheel and the danger ramp. One theme means one set of contrast checks.

**Alternatives:** a light theme (doubles the visual QA and dilutes the look).

### D12. The narrow-screen playground uses a real config (`line2From`)

**Decision:** On narrow screens the playground renders with a real ampline config: `segments: ["model","context","fiveHour","weekly", ...toggled]` and `line2From: "fiveHour"`.

**Why:** Line 1 is the model and context, and line 2 is the 5-hour and weekly bars, which fit a 340px box. This is the product's own two-line wrap, so nothing is reflowed or faked, and the "Copy .amplinerc.json" output stays valid.

**Alternatives:** shrinking the font (hurts read and tap targets); horizontal scrolling only (hides half the statusline).

### D13. Carter is the sole contributor

**Decision:** Carter Tull is the one and only author and contributor. Agents may commit, push, open PRs and merge them after green checks, but only as Carter and with no AI attribution anywhere (no `Co-Authored-By`, no "Generated with" lines, no session links). Bot PRs, Dependabot included, are never merged: the change is re-applied on a Carter branch and the bot PR is closed with a link to it. Repo settings, Vercel project settings and deploys, the js.org PR and npm publishing still need Carter's explicit approval first.

**Why:** Merging a bot's PR adds the bot as a contributor, and any attribution line adds a co-author. Carter wants the history to show him alone. The full rules are at the top of `CLAUDE.md`.

**Alternatives:** allowing Dependabot merges (adds `dependabot[bot]` as a contributor); no agent commits at all (slower, and nothing about the review gates needs it).

### D14. One gold "Buy Me a Beer" pill for support; the other footer links stay plain

**Decision:** The footer has a single gold "🍺 Buy Me a Beer" pill linking to `https://buymeacoffee.com/paymonsoftware`. It is a plain `<a>` (`target="_blank"`, `rel="noopener noreferrer"`) with no widget or script. There is no "Star on GitHub" pill: GitHub, npm, Issues and Changelog stay plain footer links, and the "Buy Me a Beer" pill is the only pill. There is no Ko-fi and no GitHub Sponsors.

**Why:** It matches blitzcast's footer button and the Paymon Software brand, and one clear support action is enough. Gold is `#E8B23D`, the Sonnet-max color on the wheel, so the "color only from the wheel" rule holds.

**Alternatives:** a Star on GitHub pill (the original plan); several support links (clutters the footer and splits the brand).

### D15. `favicon.ico` is a 32x32 PNG with an `.ico` name

**Decision:** `site/favicon.ico` is a 32x32 PNG file saved under the `.ico` name. `icon.svg` is the primary icon, and `apple-touch-icon.png` is `icon.svg` rendered at 180x180 on solid black. `favicon.ico` and `apple-touch-icon.png` are rendered from `icon.svg`, and `og.png` is rendered from `og-card.html`, all in Chrome, so no image tool is needed.

**Why:** Browsers sniff image content rather than trusting the extension, so a PNG named `favicon.ico` works wherever `/favicon.ico` is requested by default (feed readers, older crawlers). Hand-building a multi-size ICO container, or adding an image library, would buy nothing for a site with no build step and no dependencies.

**Alternatives:** a real multi-resolution ICO (needs a converter dependency or a hand-built binary); no `favicon.ico` (default `/favicon.ico` requests would 404).

### D16. The hero's statusline is an inert picture; the product colors stay as they are

**Decision:** The hero statusline's segments are rendered inside an `inert` wrapper, within the line that is already `aria-hidden`. The line itself stays a normal scroll box, so a swipe still scrolls it sideways on a phone. The figure's visually hidden caption is the text alternative. The product colors are not changed, and the tour cards and the playground preview are left alone because every color they show clears 4.5:1.

**Why:** The hero is a moving picture of the product, not text to read. It powers up with a fade-in and then cycles through the wheel, and some wheel stops are below 4.5:1 on the terminal background by design (Fable/max `#8000c0` is 2.51:1). Those colors are the product's identity, so they can't be lightened for the page. Lighthouse's contrast check (axe) still measures `aria-hidden` text and ignores roles, so it failed whenever its snapshot caught a half-faded segment or the Fable frame. It skips inert content, which keeps Accessibility at 100. Putting `inert` on the line itself would also stop touch scrolling, because inert content is not hit-tested, so it goes on an inner wrapper instead.

**Trade-off, stated plainly:** Leaving the hero line out of the accessibility tree, and out of text selection, is deliberate. The reasons are above: the product colors fall below 4.5:1 on the dark terminal and are the product's identity, and the demo is decorative. The visually hidden figcaption is the text alternative. It lists what the line contains (model and effort, context, 5-hour and weekly usage, git branch, session cost and the current task). The cost: screen readers get that caption, not the changing line itself, and the sample text in the hero cannot be selected or copied. The tour cards below show the same segments as readable text.

**Alternatives:** lighter colors on the page (no longer the real renderer's output); `role="img"` with an `aria-label` on the figure (tried: axe still flags the text inside); no fade-in and no Fable frame in the cycle (hides part of the product); accepting a sub-100 Accessibility score.

### D17. Lighthouse SEO 92 locally: robots.txt audit blocked by `connect-src 'none'`

**Decision:** Keep `connect-src 'none'`. The strict CSP is part of the product story: the page makes zero network requests.

**Why:** Lighthouse's robots.txt audit fetches `/robots.txt` from inside the page, which `connect-src 'none'` blocks. Local runs therefore show SEO 92 even though `robots.txt` is valid. A scratch run with `connect-src 'self'` scored 100.

**Alternatives:** loosen to `connect-src 'self'` (no third-party exposure, but a weaker header; `SECURITY.md` and the diagrams would need updating); allow only the `robots.txt` path on the production host (breaks on preview URLs).

**Follow-up:** re-run Lighthouse SEO against the deployed URL, and loosen the header only if it still reports 92 there.

### D18. Hero wave is not synced to the cycling model

**Decision:** The hero wave animates freely, exactly like the nav wave. It is not tied to the hero statusline's model and effort cycle, and no bar is ever held lit while the page is live. `hero.js` no longer touches the wave, and `mountEqualizer`'s `hold()` / `release()` remain only for the OG card, whose still image marks the Opus/xhigh bar.

**Why:** Holding the bar for the current model pinned one bar full-height and glowing while the other 19 kept moving, which broke the wave's rhythm and was easily mistaken for a glitch. The nav wave, which never holds, reads as the intended motion. This supersedes the earlier design (D7) in which the bar matching the current model and effort held lit.

**Alternatives:** keep the sync with a softer highlight (still interrupts the wave); sync only a color tint to the current model (extra per-frame work for a link few visitors would notice).
