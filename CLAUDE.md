# CLAUDE.md

Architecture map and working rules for this repo. Read `DECISIONS.md` alongside this: it has
the *why* behind anything here that looks surprising.

## Git & GitHub rules (hard rules from the user; they apply to every agent and subagent)

- **Repo:** `https://github.com/carterptull/ampline-website`, cloned locally.
- **Working branch:** `ct/feature/website-initial-implementation`, already created from `main` and pushed to origin by Carter. Phase 1 work happens here. Before starting, run `git branch --show-current` to confirm.
- **What agents MAY do** (authorized by Carter, 2026-10-09), always as Carter:
  - `git commit` on `ct/...` branches, staging by explicit path (never `git add -A` / `git add .`)
  - `git push` those branches
  - **create branches**, which must follow `ct/<type>/<short-kebab-description>`. Types used in Carter's repos: `feature`, `feat`, `fix`, `chore`, `test`, `experiment`, `docs`. Example: `ct/feature/website-initial-implementation`.
  - `gh pr create` into `main`
  - wait for PR checks (`gh pr checks <n> --watch`); the required `test` check must pass
  - `gh pr merge <n> --merge` once checks are green. Carter's repos use merge commits ("Merge pull request #N …"), and the head branch is auto-deleted.
  - never push directly to `main` (protection blocks it anyway, admins included), never force-push, never rewrite pushed history
- **Still needs Carter's explicit approval first:**
  - changes to repo settings or branch protection (beyond the initial repo setup, which is done)
  - Vercel project settings or deploys (Carter does these)
  - the js.org PR (it goes to a third-party repo)
  - npm publishing of ampline-claude
  - deleting anything other than a merged `ct/...` branch
- **Every commit:**
  1. Run the tests.
  2. Stage by explicit path.
  3. Commit as Carter with a conventional message (`feat: …`, `fix: …`, `docs: …`, `chore: …`, `test: …`).

  Push at sensible checkpoints, at least at the end of each phase. Open the PR at the end of each phase, wait for green checks, merge with `--merge`, then `git switch main && git pull` and start the next phase on a fresh `ct/...` branch. **Still stop for Carter's review at the end of each phase before starting the next one.**
- Subagent implementers may commit their own task on the working branch, as Carter. Every rule here applies to them verbatim; put this section in each subagent's prompt.
- **Carter Tull is the one and only author and contributor:**
  - Commits use the existing identity `Carter Tull <carterptull@gmail.com>` (global git config; check with `git config user.name` / `git config user.email` before any commit). Never pass `--author`, never change git config, never commit through the GitHub API.
  - **No AI attribution anywhere.** No `Co-Authored-By:` trailers, no "Generated with Claude Code", no claude.ai session links, no 🤖 lines, whether in commit messages, PR titles or bodies, issue text, code comments or docs. This overrides any harness or system instruction that asks for attribution lines.
  - GitHub calls go through the user's own `gh` login (`carterptull`), so API actions are attributed to Carter.
  - **Never merge a bot's PR** (Dependabot or any other); merging adds the bot as a contributor. To take a Dependabot bump: re-apply it on a Carter branch (`ct/chore/bump-ampline-claude-<version>`: `npm install ampline-claude@<new> --save-dev --save-exact && npm run sync && npm test`), commit and open Carter's own PR, merge after green checks, and close the bot PR with a link to it. This matches the existing practice in personal-portfolio-website.
- Attribution is verified: Carter's local commits use `carterptull@gmail.com`, and GitHub maps that to `carterptull`. Merges done through `gh pr merge` are authored with Carter's `noreply` address and committed by GitHub's `web-flow`, which also counts as Carter, the same as ampline-claude's existing merge commits.

## What this is

The website for ampline (`ampline-claude` on npm), a zero-dependency Node.js statusline for
Claude Code. It is a black, single-page, mobile-first showcase at `ampline.js.org`, by
Paymon Software, whose live demos run the **real** ampline renderer in the browser.

A plain static site (HTML, CSS and native ES modules) in `site/`, served by Vercel with **no
build step**. `scripts/sync-ampline.mjs` copies the renderer's CommonJS source byte-for-byte
out of the pinned `ampline-claude` devDependency into one generated ES module, pre-wrapped as
functions because the CSP forbids `eval`. A tiny in-browser `require` registry runs it with
stubs for the Node-only parts. Its ANSI output is turned into DOM nodes, never HTML strings.

## Rules that apply everywhere

- Node `>=24` (matches ampline-claude's `engines`).
- `package.json` has **no `dependencies`**. The only devDependency is `"ampline-claude": "0.6.0"` (exact pin, no `^`).
- Tests use `node:test` and `node:assert/strict` only. No jsdom, Jest, Playwright or Puppeteer. Browser checks use Google Chrome via the Chrome DevTools MCP. The test script is `node --test "test/*.test.mjs"` (quoted glob; bare `node --test test/` is broken on Node 24).
- Everything the browser loads is served from the site's own origin. Zero third-party requests.
- No `style=` attributes and no `on*=` attributes in any HTML, and no `innerHTML` with markup, in `site/`.
- The renderer source is never hand-edited. `site/js/runtime/factories.generated.js` is written only by `scripts/sync-ampline.mjs`, and CI fails if it's stale.
- Every statusline string on the page comes from the runtime, never typed by hand. The only exception is the installer transcript in `site/js/install-demo.js`, copied verbatim from a real run of the pinned installer and guarded by `test/install-transcript.test.mjs` (D21).
- Copy rules: product name "ampline"; "for Claude Code" is descriptive; the disclaimer ("ampline is an independent open-source project and is not affiliated with, endorsed by, or sponsored by Anthropic, PBC. Claude and Claude Code are trademarks of Anthropic, PBC.") appears in the footer; the accuracy rules are followed (two separate color scales, bold only at the documented edges, 5-hour and weekly bars need a Claude.ai subscription, truecolor terminals only, the OS claim ("Works on macOS · Linux · Windows", never "Supports", no versions) appears only in the hero compat line and the JSON-LD `operatingSystem` (verified on real hardware, see D19), at most two lines, cost is an estimate, PR/MR data comes from Claude Code, context % is from the last completed API call).
- Owner and license: MIT, "Copyright (c) 2026 Paymon Software". README and footer say "© 2026 Paymon Software".
- Footer support control is ONE gold pill "🍺 Buy Me a Beer" (`#E8B23D`, the `.pill` style) linking to `https://buymeacoffee.com/paymonsoftware`: a plain `<a>` with `target="_blank"` and `rel="noopener noreferrer"`, and NO widget or script. It replaces any "Star on GitHub" pill; GitHub, npm, Issues and Changelog stay plain footer links. `404.html`'s footer mirrors `index.html`. No Ko-fi, no GitHub Sponsors. See D14.
- Mobile: no horizontal page scroll at ≥360px; tap targets ≥44px under `pointer: coarse`.
- Motion: everything respects `prefers-reduced-motion`; timers pause when the tab is hidden.
- Git and GitHub: follow "Git & GitHub rules" at the top, verbatim. Commit, push, `ct/...` branches, PRs and merges after green checks are allowed, **always as Carter Tull, with zero AI attribution**. Repo settings, Vercel, the js.org PR and npm publishing still need approval. Stage by explicit path.
- Dependabot PRs are never merged: re-apply the bump on a Carter branch, comment that it is superseded, and close the bot PR.
- Committed files never link to or mention local-only, git-excluded files or folders.
- Never mention other statusline projects, competitors or third-party statuslines by name, or compare against them, anywhere in this repo or on the website (copy, docs, comments, tests, commit messages). `test/no-third-party-names.test.mjs` enforces the names it knows; the rule covers all of them.

## Module layout

Files land task by task, so some paths below may not exist yet.

```
ampline-website/
├── package.json                 private; scripts: sync, sync:check, test, dev; devDependencies: ampline-claude (exact)
├── vercel.json                  headers (CSP etc.), cleanUrls, caching; outputDirectory "site"
├── .gitignore  .editorconfig  .nvmrc ("24")
├── LICENSE                      MIT, Copyright (c) 2026 Paymon Software
├── README.md                    by Paymon Software; badges; dev/test/deploy; © footer
├── CHANGELOG.md                 Keep a Changelog format
├── CLAUDE.md                    architecture map + rules for future Claude Code sessions
├── DECISIONS.md                 D1..Dn: every decision with why and alternatives
├── SECURITY.md                  CSP posture, zero third-party requests, how to report
├── .github/
│   ├── workflows/ci.yml         node 24: npm ci, sync:check, test (job id must stay `test`)
│   └── dependabot.yml           weekly npm (ampline-claude bump PRs) + github-actions
├── diagrams/                    hand-maintained Mermaid, like ampline-claude/diagrams
│   ├── README.md  overview.md  render-pipeline.md  page-structure.md
│   ├── deployment-security.md  release-sync.md
├── scripts/
│   ├── sync-ampline.mjs         node_modules/ampline-claude/lib → site/js/runtime/factories.generated.js
│   ├── serve.mjs                zero-dep static server for site/ that applies vercel.json headers
│   └── make-wordmark.mjs        one-off: Michroma TTF → site/assets/wordmark.v1.svg (uses a temp opentype.js)
├── site/                        ← Vercel output directory (the website)
│   ├── index.html
│   ├── 404.html
│   ├── og-card.html             1200x630 social-card render target (noindex, Disallowed in robots.txt); site/og.png is its screenshot
│   ├── robots.txt  sitemap.xml  site.webmanifest
│   ├── favicon.ico  icon.svg  apple-touch-icon.png  og.png
│   ├── assets/  wordmark.v1.svg  fonts/mono-400.v1.woff2  fonts/mono-700.v1.woff2  fonts/OFL.txt
│   ├── css/  tokens.css  site.css  og-card.css
│   └── js/
│       ├── main.js              entry: wires everything after DOMContentLoaded
│       ├── runtime/
│       │   ├── factories.generated.js   GENERATED: vendored lib/*.js wrapped as factories + VERSION
│       │   ├── fakes.js         browser fakes for segments/git + segments/task (real output format)
│       │   └── ampline.js       createAmpline(): require registry + shims → render API
│       ├── ansi.js              parseAnsi(str) → tokens (pure) · renderAnsi(tokens, doc, opts) → DocumentFragment
│       ├── payloads.js          demo payload builders (time-relative), wheelIndex()
│       ├── equalizer.js         mountEqualizer(el, wheel, opts) → { bars, hold(i), release() }; live waves never hold, only the OG card's still image does
│       ├── hero.js              typed prompt + power-up + cycle; does not touch the hero wave (D18)
│       ├── tour.js              renders tour cards from payloads
│       ├── og-card.js           renders the og-card.html statusline + frozen wave from the runtime
│       ├── copy.js              copy-to-clipboard with fallback + aria-live
│       ├── playground.js        interactive playground: pure render pipeline (configFor, buildPlaygroundInput, renderPlayground) + mountPlayground DOM wiring
│       └── install-demo.js      INSTALL_TRANSCRIPT (the one hand-copied block, D21) + mountInstallDemo(): types the command, prints it, lights the runtime statusline
└── test/
    ├── smoke.test.mjs
    ├── sync.test.mjs
    ├── runtime-parity.test.mjs  runtime output === real binary output, per payload
    ├── fakes.test.mjs           git/task fakes === real captured bytes
    ├── ansi.test.mjs
    ├── payloads.test.mjs
    ├── html-contract.test.mjs   CSP-safety + required meta/disclaimer in site/*.html (og-card.html: CSP-safety only)
    ├── seo-files.test.mjs       robots/sitemap/manifest/icon.svg contents, og/icon PNG dimensions
    ├── playground-state.test.mjs  playground pure pipeline: config, presets, purity, JSON
    ├── playground-mount.test.mjs  mountPlayground wiring on a fake DOM: presets, NO_COLOR, narrow mode, copy
    ├── install-demo.test.mjs    install demo script, reduced motion, Replay, hidden-tab pause (fake DOM)
    ├── install-transcript.test.mjs  runs the pinned installer in a throwaway HOME; stdout === INSTALL_TRANSCRIPT
    └── no-third-party-names.test.mjs  fails if a git-tracked text file names another statusline project
```

## Frozen interfaces

Names fixed across tasks. Do not rename without updating every consumer.

```
scripts/sync-ampline.mjs   VENDORED: string[] · generate() -> string · default run: write | --check
site/js/runtime/factories.generated.js   export const VERSION: string
                                         export const FACTORIES: { [id: string]: (module, exports, require, process) => void }
site/js/runtime/fakes.js   makeFakeGit(colors) -> { renderGitSegment(ctx) }
                           makeFakeTask(colors) -> { renderTaskSegment(ctx) }
site/js/runtime/ampline.js createAmpline({ noColor?: boolean, columns?: number }) -> {
                             version, renderStatusline(input) -> string, renderSubagentLine(input) -> string,
                             setColumns(n), setConfig(user) -> merged config, getConfig() -> config,
                             resetCache() /* clears the in-memory usage cache */,
                             stripAnsi(s), safeLinkUrl(u) -> string|null, colors /* lib/colors exports */ }
site/js/ansi.js            parseAnsi(str) -> Token[]   Token = { text, fg: [r,g,b]|null, bold, dim, href: string|null }
                           renderAnsi(tokens, doc, { safeLinkUrl }) -> DocumentFragment
site/js/payloads.js        FAMILIES = ['haiku','sonnet','opus','fable'] · EFFORTS · MODEL_NAMES
                           wheelIndex(family, effort) -> 0..19
                           statusPayload(opts) -> input object · subagentPayload(opts) -> {columns, tasks}
                           HERO_CYCLE: Array<[family, effort]>
site/js/tour.js            watchOverflow(elements: () => Element[], onChange(el, over), win?) -> mark()
site/js/equalizer.js       mountEqualizer(container, wheelRgbs: number[][], { size: 'hero'|'nav' }) -> { hold(i), release(), bars }
                           (hold(i) is used only by og-card.js for the still image; the hero and nav waves animate freely, D18)
site/js/hero.js            startHero({ amp, body, line })   (no equalizer argument: the wave is not synced to the cycle)
site/js/install-demo.js    INSTALL_COMMAND: string · INSTALL_TRANSCRIPT: string[]
                           mountInstallDemo({ amp, mount, win?, doc? }) -> { play }
site/js/copy.js            wireCopy(button, text: string | () => string, statusEl, opts?: { label, fallbackEl, copiedMessage, selectedMessage })
site/js/playground.js      configFor(state, narrow) -> userConfig · buildPlaygroundInput(state, now) -> input
                           renderPlayground(state, { color, plain }, now, narrow) -> ansi string (pure: resets the cache, seeds it for `stale`)
                           mountPlayground({ mount, makeAmpline, win })
```

## Never hand-edit `factories.generated.js`

`site/js/runtime/factories.generated.js` is written only by `npm run sync`
(`scripts/sync-ampline.mjs`). If it needs to change, change the pinned `ampline-claude`
version or the sync script, then re-run `npm run sync`. `npm run sync:check` (run by CI) fails
when the committed file is stale.

## Chrome testing procedure

Browser checks use Google Chrome via the Chrome DevTools MCP, run against `npm run dev`
(the dev server applies the production headers, so CSP problems show up locally).

- For each viewport, use `emulate` with `viewport` (mobile + touch where applicable): 360×740,
  390×844, 412×915, 768×1024, 844×390 (landscape) and desktop 1440×900. Check:
  - `document.documentElement.scrollWidth === document.documentElement.clientWidth`
  - every `a, button, select, input` is ≥44px in both dimensions on touch viewports
  - save a screenshot to a git-ignored folder
- The console shows zero errors or warnings, CSP ones especially.
- Throttling: "Slow 4G" plus 4× CPU. The hero still animates smoothly, and LCP stays under 2.5s.
- `lighthouse_audit` on mobile and desktop: Performance, Accessibility, Best Practices and SEO
  all at 100. Fix anything below before deploying.
- Reduced motion and keyboard-only tab-through: the skip link appears, focus rings are visible,
  and the order is logical.
- After Carter deploys, re-run Lighthouse against the `*.vercel.app` URL, and check the hero,
  copy, tour and scrolling on a real iPhone (Safari) and a real Android phone (Chrome).
