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

**Decision:** The hero is a centered stack: wordmark, wave, slogan and subline, copyable install command, meta line, then a faux Claude Code window. The meta line is followed by one "Works on macOS · Linux · Windows" compatibility line (D19).

**Why:** It puts the install command and the live statusline in the first screen on both phones and desktops, with no side-by-side layout to collapse on narrow screens.

**Alternatives:** a two-column hero with the demo beside the text (cramped at phone widths).

### D9. Self-hosted, subset Iosevka Fixed (exposed as "ampline mono")

**Decision:** The monospace face is Iosevka Fixed Regular and Bold v34.9.0 (SIL OFL), subset to Latin plus the statusline glyphs, self-hosted as `mono-400.v2.woff2` and `mono-700.v2.woff2` (the v1 files lacked the 1.0.0 pace marker; see D24) and exposed as the `"ampline mono"` family.

**Why:** Every glyph in the bars must come from one font, or the bars misalign; iOS has no suitable mono, so it has to be shipped. JetBrains Mono v2.304 was the first choice but lacks `↺` (U+21BA), `⎇` (U+2387) and `↳` (U+21B3); DejaVu Sans Mono has `↺` and `↳` but not `⎇`. Iosevka Fixed has all the statusline glyphs (14 when this was decided, 15 since ampline-claude 1.0.0 added `┃`) at the same advance as `M`. Subsetting keeps each file near 12 KB, and self-hosting keeps the page at zero third-party requests.

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

**Decision:** The hero statusline's segments are rendered inside an `inert` wrapper, within the line that is already `aria-hidden`. The line itself stays a normal scroll box, so a swipe still scrolls it sideways on a phone. The figure's visually hidden caption is the text alternative. The product colors are not changed. The tour cards are left alone because every color they show clears 4.5:1; the interactive playground can show colors below it, which D22 covers.

**Why:** The hero is a moving picture of the product, not text to read. It powers up with a fade-in and then cycles through the wheel, and some wheel stops are below 4.5:1 on the terminal background by design (Fable/max `#8000c0` is 2.51:1). Those colors are the product's identity, so they can't be lightened for the page. Lighthouse's contrast check (axe) still measures `aria-hidden` text and ignores roles, so it failed whenever its snapshot caught a half-faded segment or the Fable frame. It skips inert content, which keeps Accessibility at 100. Putting `inert` on the line itself would also stop touch scrolling, because inert content is not hit-tested, so it goes on an inner wrapper instead.

**Trade-off, stated plainly:** Leaving the hero line out of the accessibility tree, and out of text selection, is deliberate. The reasons are above: the product colors fall below 4.5:1 on the dark terminal and are the product's identity, and the demo is decorative. The visually hidden figcaption is the text alternative. It lists what the line contains (model and effort, context, 5-hour and weekly usage, git branch, session cost and the current task). The cost: screen readers get that caption, not the changing line itself, and the sample text in the hero cannot be selected or copied. The tour cards below show the same segments as readable text.

**Alternatives:** lighter colors on the page (no longer the real renderer's output); `role="img"` with an `aria-label` on the figure (tried: axe still flags the text inside); no fade-in and no Fable frame in the cycle (hides part of the product); accepting a sub-100 Accessibility score.

### D17. Lighthouse SEO 92 locally: robots.txt audit blocked by `connect-src 'none'`

**Decision (original):** Keep `connect-src 'none'`. The strict CSP is part of the product story: the page makes zero network requests.

**Why:** Lighthouse's robots.txt audit fetches `/robots.txt` from inside the page, which `connect-src 'none'` blocks. Local runs therefore show SEO 92 even though `robots.txt` is valid. A scratch run with `connect-src 'self'` scored 100.

**Alternatives:** loosen to `connect-src 'self'` (no third-party exposure, but a weaker header; `SECURITY.md` and the diagrams would need updating); allow only the `robots.txt` path on the production host (breaks on preview URLs).

**Follow-up:** re-run Lighthouse SEO against the deployed URL, and loosen the header only if it still reports 92 there.

**Resolution (2026-10-12):** The re-check on the deployed URL (`https://ampline-website.vercel.app`) still showed SEO 92, with `robots-txt` the only failing audit, so `connect-src` is now `'self'`. Third-party exposure is unchanged: `'self'` allows only same-origin fetch, XHR and WebSocket, and no site code uses any of them (`html-contract.test.mjs` fails if `site/js/` ever gains one, and pins the header value). Re-run Lighthouse after the deploy to confirm 100.

### D18. Hero wave is not synced to the cycling model

**Decision:** The hero wave animates freely, exactly like the nav wave. It is not tied to the hero statusline's model and effort cycle, and no bar is ever held lit while the page is live. `hero.js` no longer touches the wave, and `mountEqualizer`'s `hold()` / `release()` remain only for the OG card, whose still image marks the Opus/xhigh bar.

**Why:** Holding the bar for the current model pinned one bar full-height and glowing while the other 19 kept moving, which broke the wave's rhythm and was easily mistaken for a glitch. The nav wave, which never holds, reads as the intended motion. This supersedes the earlier design (D7) in which the bar matching the current model and effort held lit.

**Alternatives:** keep the sync with a softer highlight (still interrupts the wave); sync only a color tint to the current model (extra per-frame work for a link few visitors would notice).

### D19. OS compatibility claim enabled

**Decision:** The hero shows one line under the meta line, "● Works on macOS · Linux · Windows", and the JSON-LD carries `"operatingSystem": "macOS, Linux, Windows"`. Those are the only two places the OS names may appear (`html-contract.test.mjs` enforces it). The wording is "Works on", never "Supports", and no OS versions are named. The leading dot is the calm end of the danger ramp (`--danger-1`) and is `aria-hidden`, so the line reads as plain text to assistive tech.

**Why:** ampline has been verified on real hardware on all three: Windows, Linux (via WSL) and macOS. WSL counts as Linux here, which is the only way most Windows users meet a Linux shell anyway. This supersedes the earlier rule that held back any macOS/Linux/Windows claim until macOS was verified; that condition is now met.

**Alternatives:** keep saying nothing (leaves a basic question unanswered above the fold); list OS versions (would need a tested matrix, and goes stale); a "Supports" claim (promises more than has been tested); a longer platform paragraph further down the page (the hero is where people decide to install).

### D20. Explicit HSTS

**Decision:** `vercel.json` sets `Strict-Transport-Security: max-age=31536000` on every response, with no `includeSubDomains` and no `preload`.

**Why:** Vercel adds `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` on its own when the project does not set one. We set the header explicitly so the policy is ours and visible in this repo, not whatever the platform default happens to be. `includeSubDomains` is meaningless here: `ampline.js.org` has no subdomains to cover (and HSTS sent by this host never reaches sibling `*.js.org` hosts). `preload` is a commitment to browser-shipped lists that is hard to undo, on a name that is a subdomain of `js.org`, which Carter does not own, so we do not opt into it. One year is a conservative, standard `max-age`, and it still protects this host. The header test pins the exact value and the full global header set.

**Verify after deploy:** run `curl -sI https://ampline.js.org/` (and the `*.vercel.app` URL) and confirm the response has exactly one `strict-transport-security: max-age=31536000` line and that Vercel did not append its own.

**Note:** the dev server applies the same global headers, so it now also sends HSTS over `http://127.0.0.1`. Browsers ignore HSTS on plain HTTP, so it is harmless there.

**Alternatives:** keep Vercel's default (the policy would not be ours or visible in the repo, `includeSubDomains` covers nothing here, and preload is hard to undo on a name under a domain we do not own); leave HSTS off (the deployed site would still get Vercel's default, so the choice would not be ours); `max-age` of two years to match Vercel (no benefit without preload).

### D21. The installer transcript is the one hand-copied block, and CI keeps it honest

**Decision:** The install demo's terminal output (`INSTALL_TRANSCRIPT` in `site/js/install-demo.js`) is typed into the repo as six literal lines, copied from a real run of the pinned `ampline-claude` installer (`--install`, in a throwaway HOME, exit 0, empty stderr). It is the only text on the page that is not produced by the runtime. `test/install-transcript.test.mjs` spawns the installer from `node_modules` in a fresh temp HOME and requires its stdout to equal the constant line for line. Whenever the pinned version's installer output changes, that test fails and the block is re-captured.

**Why:** The runtime renders statuslines, but the installer is a different program that talks to the filesystem, so it cannot run in the browser. A demo that invents what the installer prints would be a claim about the product that nothing checks. Copying the real output, and running the real installer in CI against the copy, makes the claim as strong as the statusline demos: a bump that changes the wording cannot ship a stale transcript. The test runs the installer with an allowlisted environment (PATH, SYSTEMROOT, TEMP and TMP, matched case-insensitively, plus HOME and USERPROFILE set to the throwaway directory), with that directory as the working directory and a 30-second timeout, so it never sees `CLAUDE_CONFIG_DIR` or the developer's real Claude settings.

**Alternatives:** generate the transcript at build time (there is no build step); read it from a vendored file (adds a second generated artifact for six lines); describe the install in prose with no transcript (the demo is the point of the section); capture it once and trust it (drifts silently on the next bump).

### D22. The playground shows the real colors the visitor picks, including ones below 4.5:1

**Decision:** The playground preview renders whatever the controls select with the product's own colors, unchanged. D16's earlier statement that the tour and the playground only show colors that clear 4.5:1 on the terminal background is superseded for the playground: a visitor can pick wheel stops that measure well below it on #0b0b0b (Haiku/low 3.92:1, Opus/max 3.93:1, Fable/xhigh 3.66:1, Fable/max 2.51:1) and a context or usage value at 95% or more shows the danger red (163, 45, 45) at 2.78:1. Product colors are never altered for the page.

**Why:** The point of the playground is to show the real renderer's output, and those colors are the product's identity (see D16). The mitigations are structural: the preview text stays in the accessibility tree (it is a labelled group, not hidden), a debounced polite live region announces each change as plain text, and the NO_COLOR toggle gives a plain-text view of the same line. Lighthouse and axe only score the default state, which clears the threshold; they do not drive the sliders.

**Alternatives:** lighten the low-contrast stops on the page (no longer the real output, and it would misstate the product); clamp the controls so only passing colors can be picked (hides part of the product and makes the demo dishonest); mark the preview `aria-hidden` like the hero (the playground is an interactive tool, so it must be readable).

### D23. The portfolio at cartertull.com may frame the site

**Decision:** The CSP's `frame-ancestors` is `https://cartertull.com https://www.cartertull.com`, replacing `'none'`. Nothing else in the CSP changes. `html-contract.test.mjs` pins the exact two origins and `serve.test.mjs` checks the served header.

**Why:** The portfolio at cartertull.com shows this site inside a desktop window, which is an iframe, and `frame-ancestors 'none'` left it blank. Only the two origins that serve the portfolio (apex and www) are listed, with no `'self'` and no wildcard, so the allowance is the least that makes the embed work and every other site still cannot frame this one. `frame-ancestors` governs who may embed this page, not what it loads, so the "no remote host in the CSP" rule from D17 does not apply to it; the test that enforces that rule skips this one directive and still rejects `unsafe-` keywords there.

**Alternatives:** keep `'none'` and have the portfolio link out (the window would be a bare link, and the embed is the point); `'self'` (does not help, since the framing page is on another origin); a wildcard or `https:` (lets anyone frame the site, which invites clickjacking for no gain).

**Consequence:** The portfolio's own CSP `frame-src` must allow `https://ampline.js.org`. If the portfolio moves to another domain, this header has to change with it.

### D24. Font v2: the pace marker `┃` and `≥`, rebuilt from the Iosevka source, and a new filename

**Decision:** The two mono files are rebuilt as `mono-400.v2.woff2` and `mono-700.v2.woff2` from Iosevka Fixed Regular and Bold v34.9.0 (SIL OFL, `site/assets/fonts/OFL.txt` unchanged apart from the file names it lists). The subset is ASCII U+0020-007E plus `· … ↑ ↓ ↗ ↳ ↺ ⎇ │ █ ░ ● ⚠ ✓` (the 14 glyphs of v1) plus `┃` U+2503 (ampline-claude 1.0.0's pace marker, `MARKER` in `lib/bar.js`) and `≥` U+2265 (the hero meta line, "Node.js ≥ 24"). `test/font-coverage.test.mjs` reads both files' cmap and fails if the renderer or the site draws a glyph the fonts lack. The v1 files are deleted.

**Recipe** (also in `scripts/fonts/README.md`; tooling lives in a throwaway venv outside the repo, nothing is added to `package.json`):

- Source: `PkgTTF-IosevkaFixed-34.9.0.zip` from <https://github.com/be5invis/Iosevka/releases/tag/v34.9.0> (sha256 `c3204f46863af9e7f0ae06f0bd0b3414697c424dba8573daf37c3053a76213b7`), the hinted TTFs `IosevkaFixed-Regular.ttf` (sha256 `c90a6bcec3c3c5aa8e32c08a1e22db528185c53606604e1d1fcd30401a59312e`) and `IosevkaFixed-Bold.ttf` (sha256 `b7a2e8ca12dc4cd81e451ed008d76591e7278f3cbda10718b4b40a087b8bee16`). Their name tables read "Iosevka Fixed" and "Version 34.9.0". The licence in the repo matches the upstream `LICENSE.md` at v34.9.0.
- Tools: Python 3.13.1, fonttools 4.68.0, brotli 1.2.1.
- Command, once per weight (`pyftsubset` from fonttools):
  `pyftsubset IosevkaFixed-Regular.ttf --unicodes="U+0020-007E,U+00B7,U+2026,U+2191,U+2193,U+2197,U+21B3,U+21BA,U+2265,U+2387,U+2502,U+2503,U+2588,U+2591,U+25CF,U+26A0,U+2713" --flavor=woff2 --output-file=mono-400.v2.woff2`, and the same with `IosevkaFixed-Bold.ttf` and `mono-700.v2.woff2`.
- Output sha256: `mono-400.v2.woff2` `7df6bd7c671ea6bab0b79e6b7fed8142a22fa7b8658b9ae372743f2f5d71174c` (12,320 bytes), `mono-700.v2.woff2` `4cf9092826b5c046d66d0a46c4e0b472ab099438727bb362b66dcbb4981c4f6b` (12,260 bytes).
- Check on the recipe: the same command with the v1 unicode list (no U+2265, no U+2503) reproduces the committed v1 files byte for byte (sha256 `10ceabe4...` and `c970cdac...`), so v2 differs from v1 only by the added code points.

**Layout features:** the default `pyftsubset` feature set, not `'*'`. The default is exactly what v1 shipped (GSUB `dnom frac locl numr`, no GPOS) and keeps each file at about 12 KB; `--layout-features='*'` pulls in every `cv`/`ss`/`VS` stylistic set and the glyph closure grows to about 2,100 glyphs and 85 KB. Iosevka Fixed has no `liga` or `calt`, so no ligatures can appear in mono text either way. Hinting tables (`cvt`, `fpgm`, `prep`, `gasp`) are kept, as in v1. Adding `≥` also brings U+2264 `≤` into the files through the glyph closure; it is unused and costs a few bytes.

**Why `.v2`:** everything under `/assets/` is served `public, max-age=31536000, immutable` (`vercel.json`), so a browser that has `mono-*.v1.woff2` never asks again for a year. Overwriting the v1 name would leave returning visitors on a font without `┃`, so the bars would misalign on every one of them. A changed asset therefore gets a new filename; `font-coverage.test.mjs` enforces that every file under `site/assets/` carries a `.vN.` token and that CSS, HTML and preloads reference files that exist. Why a new subset at all: with the v1 files every usage bar drew `┃` from the next font in the `--mono` stack (usually 0.6em wide against Iosevka's 0.5em), which is the failure D9 exists to prevent.

**Alternatives:** keep the v1 filename and add `no-cache` to `/assets/` (loses the one-year cache for everything else and does not help visitors who already cached it); a query string such as `?v=2` on the URL (works, but the name-based `.vN.` rule is simpler to test and is the pattern the wordmark already uses); drawing `┃` as CSS or inline SVG (the marker comes out of the real renderer's text, so the glyph has to exist in the font); `--layout-features='*'` (7x the size for features the page never turns on).
