# ampline website

The website for [ampline](https://github.com/carterptull/ampline-claude), a zero-dependency Node.js statusline for Claude Code, by **Paymon Software**.

**Live at [ampline.js.org](https://ampline.js.org)**

[![CI](https://github.com/carterptull/ampline-website/actions/workflows/ci.yml/badge.svg)](https://github.com/carterptull/ampline-website/actions/workflows/ci.yml)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fampline.js.org&up_message=online&label=ampline.js.org)](https://ampline.js.org)

Technical decision log: [DECISIONS.md](./DECISIONS.md) · Release history: [CHANGELOG.md](./CHANGELOG.md) · Vulnerability reporting: [SECURITY.md](./SECURITY.md) · License: [LICENSE](./LICENSE)

## What's here

A plain static site: HTML, CSS and native ES modules in `site/`, served by Vercel with no build step. There are no runtime dependencies and no framework. The only devDependency is `ampline-claude` itself, pinned to an exact version.

The page shows ampline's statusline running live in the browser, explains each signal it shows, and makes the "no network, no credentials, zero dependencies" claim checkable: the site itself makes zero third-party requests, ships a strict Content-Security-Policy and has no analytics.

## How the demos work

Every statusline on the page is produced by the real ampline renderer, not typed by hand. `npm run sync` copies the renderer's source byte-for-byte out of the pinned `ampline-claude` package into one generated ES module, pre-wrapped as functions because the Content-Security-Policy forbids `eval`. A tiny in-browser `require` registry runs it with small stand-ins for the Node-only parts (git and task lookups), and its ANSI output is turned into DOM nodes, never HTML strings. CI fails if the generated module is stale. See [diagrams/render-pipeline.md](./diagrams/render-pipeline.md).

## Develop

```sh
npm install
npm run dev     # http://localhost:4173
```

The dev server serves `site/` with the same security headers as production.

## Test

```sh
npm test
```

Tests use `node:test` and `node:assert/strict` only. `npm run sync:check` verifies the generated renderer module is up to date.

## Updating to a new ampline release

1. Bump the `ampline-claude` devDependency in `package.json` (exact version, no `^`).
2. `npm run sync`
3. Update the two static ampline-claude version spans (`#ampVersion`) in `site/index.html` and `site/404.html` to the new version. The tests enforce that they match the pinned devDependency.
4. `npm test`
5. If the statusline output changed, re-render `site/og.png`. It is a 1200x630 screenshot of `site/og-card.html` and is not covered by CI.

## Deploy

Vercel, framework preset "Other", output directory `site`, no build command.

## License

[MIT](./LICENSE)

---

© 2026 Paymon Software · Not affiliated with Anthropic.
