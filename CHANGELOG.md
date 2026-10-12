# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- The hero wave now animates freely instead of holding one bar for the current model.

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
