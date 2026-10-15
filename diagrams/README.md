# Architecture diagrams

Visual companions to [`CLAUDE.md`](../CLAUDE.md) (how the repo is laid out) and
[`DECISIONS.md`](../DECISIONS.md) (why it was built this way). The diagrams show the shape of
each decision. The decision log explains the reasoning behind it.

| Diagram | Shows |
| --- | --- |
| [`overview.md`](overview.md) | Start here: the visitor, the static site on Vercel, and the only places the page ever links out to |
| [`render-pipeline.md`](render-pipeline.md) | How ampline-claude's real renderer ends up running in the browser: sync, runtime, payloads, ANSI to DOM, and the tests that keep it honest |
| [`page-structure.md`](page-structure.md) | The sections of `index.html` in order, and which JS module fills which container |
| [`deployment-security.md`](deployment-security.md) | The intended path from a browser to the static files (js.org DNS, Vercel edge), the response headers, the CSP, and the zero-third-party-origins rule |
| [`release-sync.md`](release-sync.md) | What happens when a new ampline-claude version ships: Dependabot, the sync script, CI, preview, and production |

## Keeping these current

These are hand-maintained, not generated. Each file ends with a stamp
(`Last verified: <date> · site <version>`, the version taken from `package.json`), so a stale
diagram is visible rather than silent.

Bump every diagram's footer to the current site version on each release, even ones whose
content didn't change this time. The stamp is a "still accurate as of this version" claim, not
a record of when the file itself was last edited. Content is a separate question from the
stamp. Re-verify what a diagram actually shows only when a change touches one of the areas
below, and update its Mermaid source and prose then, not on every release.

| If you change... | Re-check |
| --- | --- |
| `scripts/sync-ampline.mjs` (the `VENDORED` list) or the pinned `ampline-claude` version | `render-pipeline.md`, `release-sync.md` |
| `site/js/runtime/ampline.js` or `fakes.js` (stubs, fakes, registry) | `render-pipeline.md` |
| `site/js/ansi.js` or `payloads.js` | `render-pipeline.md` |
| a section, container id, or JS module in `site/index.html` and `site/js/main.js` (including Phase 2's `playground.js` and `install-demo.js`) | `page-structure.md`, `render-pipeline.md` |
| `vercel.json` (headers, CSP, caching) | `deployment-security.md` |
| a new outbound link or any new origin the page touches | `overview.md`, `deployment-security.md` |
| `.github/workflows/ci.yml` or `.github/dependabot.yml` | `release-sync.md` |
| the test files in `test/` | `render-pipeline.md`, `release-sync.md` |

A routine fix or copy change doesn't need a diagram update.

## Syntax rules (GitHub's Mermaid renderer)

- No native `C4Context` / `C4Container`: still experimental and inconsistent on GitHub. The
  context view here is a `flowchart` styled by level.
- `flowchart` labels break lines with `<br/>`, never `\n`.
- `sequenceDiagram` messages also use `<br/>` for line breaks. Avoid semicolons and `#` inside
  message text.
- Keep node ids simple alphanumerics, and quote any label containing parentheses, slashes,
  colons, or other special characters.
- Avoid HTML other than `<br/>` and `<b>`. Do not use `<small>`: GitHub's renderer sizes the
  node for the normal font, so the tail of small text gets clipped.
- Planned (not yet built) pieces are drawn with a dashed border and the words "planned
  (Phase 2)", so a diagram never claims something that does not exist yet.
- Keep each diagram to roughly 6 to 14 nodes. Split rather than grow one giant diagram.
- Verify by viewing the rendered file on github.com. Reading the source is not verification.

---
_Last verified: 2026-10-15 · site 0.3.0_
