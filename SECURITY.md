# Security Policy

Please do not open public issues for security problems. Report them privately, to the repository that owns the problem. Private vulnerability reporting is enabled on both repositories.

## A vulnerability in the statusline itself

ampline runs on users' machines, so a problem in the statusline is the more serious kind. Report it to **ampline-claude**:

<https://github.com/carterptull/ampline-claude/security/advisories/new>

Follow [ampline-claude's SECURITY.md](https://github.com/carterptull/ampline-claude/blob/main/SECURITY.md). Most reports belong there.

## A problem with the website only

Examples: a gap in the headers or Content-Security-Policy, a demo that renders untrusted input unsafely, a broken or misleading link. Report it privately on this repository:

<https://github.com/carterptull/ampline-website/security/advisories/new>

## The site's security posture

- **Zero third-party requests.** No CDN, web fonts, analytics or embeds. Everything the browser loads comes from the site's own origin, and every outbound link is a plain `<a>`.
- **Strict Content-Security-Policy.** `default-src 'none'`, with scripts, styles, images, fonts and the manifest limited to `'self'`. No `unsafe-inline`, no `unsafe-eval`, `connect-src 'self'` (same-origin only; no site code opens a connection, and a test enforces that), `frame-ancestors 'none'`. The renderer is pre-wrapped at sync time, so nothing is `eval`'d at runtime.
- **No analytics and no trackers.**
- **The dev server listens on localhost only** (`127.0.0.1`), unless you set `HOST` yourself.
- **Untrusted text stays text.** Demo output enters the DOM through `textContent` and DOM nodes, never `innerHTML`. Links in statusline output are only turned into anchors when the renderer's own link check approves them.
