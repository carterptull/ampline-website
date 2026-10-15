# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
