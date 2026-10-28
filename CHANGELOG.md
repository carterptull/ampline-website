# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- The tour's 5-hour and weekly card now explains the `┃` pace marker (how much of the window has passed, assuming 5-hour and 7-day windows), and the `.amplinerc.json` note mentions opt-in pace colors.
- The playground has a `paceColors` toggle (off by default; the copied `.amplinerc.json` shows `"paceColors": true` only when it is on) and two "window elapsed" sliders that move the pace marker on the 5-hour and weekly bars, with a short accuracy note. `statusPayload` takes `fiveHourElapsed` / `weeklyElapsed`.
- `test/font-coverage.test.mjs`: parses both mono woff2 files and fails if the renderer or the site draws a glyph they lack, and checks that every file under `/assets/` exists and carries a `.vN.` version in its name (the assets are served `immutable`).
- `scripts/fonts/README.md` and D24: the exact recipe for rebuilding the mono subset from Iosevka Fixed v34.9.0.

### Changed

- The stale-cache preset's hint now says the pace marker is left out on dimmed stale bars.
- `test/install-transcript.test.mjs` ignores the Node line and re-run note that the installer prints when Node lives in a version-named directory (nvm, Homebrew, fnm, volta, asdf, snap), so it passes on developer machines with a version manager. The six normal lines are still compared exactly.
- README "Updating to a new ampline release" and `diagrams/release-sync.md` list every step: the font glyph check and `.vN` rename, re-capturing the install transcript, tour copy and tests, diagram stamps and the CHANGELOG.
- The self-hosted mono font is now `mono-400.v2.woff2` / `mono-700.v2.woff2`, adding `┃` (U+2503, the pace marker ampline-claude 1.0.0 draws in the usage bars) and `≥` (U+2265, the hero meta line). The v1 files are removed; the new filename is needed because `/assets/` is cached for a year (D24).

## [0.3.1] - 2026-10-23

### Changed

- `frame-ancestors` now allows `https://cartertull.com` and `https://www.cartertull.com` instead of `'none'`, so the portfolio can show the site in a window. Every other origin still cannot frame it (D23).

### Fixed

- Playground PR link underlined so links don't rely on color alone (Lighthouse link-in-text-block).

## [0.3.0] - 2026-10-15

### Added

- Install demo section: a terminal that types `npx ampline-claude --install`, prints the installer's real output and lights the runtime statusline when it scrolls into view, with Replay. `test/install-transcript.test.mjs` keeps the copied output equal to the pinned installer's (D21).
- Interactive playground on the real renderer: model and effort, context, 5-hour and weekly sliders, git, cost, PR and task toggles, NO_COLOR, a terminal-width slider that flips between one and two lines, and Stale cache, 85% edge and API-key account presets, with a copyable `.amplinerc.json`.

### Changed

- `wireCopy` takes a string or a function and an options object (label, fallback element, messages); the install button behaves as before.
- `createAmpline` gains `resetCache()`, so a render can be made independent of earlier ones.
- The playground's static preview and "coming soon" copy are replaced by the interactive controls.

## [0.2.0] - 2026-10-12

### Added

- A "Works on macOS · Linux · Windows" line under the hero meta line, and `operatingSystem` in the JSON-LD (D19). Verified on Windows, Linux (via WSL) and macOS hardware.
- Customize and FAQ prompts after the segment tour.

### Changed

- An explicit `Strict-Transport-Security: max-age=31536000` header, without `includeSubDomains` or `preload`, so Vercel's default (which adds both) does not apply (D20).
- The hero wave now animates freely instead of holding one bar for the current model (D18).
- Content-Security-Policy `connect-src` is `'self'` (was `'none'`) so Lighthouse can validate robots.txt; third-party requests stay blocked (D17).

### Fixed

- The install command was clipped on phones (for example "npx ampline-claude --insta" at 412px). The whole command is now visible from 320px up, with Copy beside it.

## [0.1.0] - 2026-10-09

### Added

- Single-page landing site for ampline at `ampline.js.org`: black, mobile-first, with no build step (static HTML, CSS and native ES modules served from `site/`).
- Hero with a typed Claude Code prompt and a statusline that powers up and cycles through model and effort colors.
- Wave logo (equalizer) colored from ampline's own 20-step wheel, in the nav and the hero, held in sync with the hero line.
- Segment tour: one card per segment (model and effort, context, 5-hour and weekly limits, git, cost and lines, PR/MR, current task) plus the subagent rows, each with accurate notes.
- Static playground preview, with interactive controls to follow.
- "Under the hood" cards and links to the FAQ, configuration, security policy and architecture diagrams.
- Footer with the "Buy Me a Beer" pill, the site version, the renderer version and the Anthropic disclaimer, mirrored on the 404 page.
- In-browser runtime that runs ampline-claude's real renderer, copied byte-for-byte from the pinned package by `npm run sync`, with byte-parity tests against the real binary and a CI check that the copy is current.
- Strict Content-Security-Policy and security headers in `vercel.json`, with zero third-party requests, plus a zero-dependency dev server that applies the same headers.
- Self-hosted subset mono font, the wordmark SVG, an Open Graph card, a favicon set and a web manifest.
- Hand-maintained Mermaid architecture diagrams.
- CI on Node 24 (sync check and tests) and Dependabot configuration.
- The install Copy button turns green while it confirms "Copied".
