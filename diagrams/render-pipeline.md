# Render pipeline: from the npm package to pixels

Every statusline on the page is output of ampline-claude's own renderer, never a hand-typed
string. The renderer is CommonJS written for Node, and the site's CSP forbids `eval`, so the
sync script pre-wraps each file as a factory function at development time. A small `require`
registry in the browser runs those factories with stubs for the Node-only parts. The renderer's
output is an ANSI string, which is parsed into tokens and turned into DOM nodes (never HTML
strings).

## Source to screen

```mermaid
flowchart LR
    npm["ampline-claude on npm<br/>pinned devDependency"] --> sync["scripts/sync-ampline.mjs<br/>pre-wraps 12 CommonJS<br/>files as factories"]
    sync --> gen["runtime/factories.generated.js<br/>committed, CI-checked"]
    gen --> rt["runtime/ampline.js<br/>require registry + shims + fakes"]
    pay["payloads.js<br/>time-relative demo input"] --> rt
    rt -->|"ANSI string"| parse["ansi.js parseAnsi"]
    parse -->|"tokens"| dom["ansi.js renderAnsi<br/>DOM nodes + CSSOM colors"]
    dom --> page["hero.js · tour.js · playground.js"]
    dom --> card["og-card.js<br/>renders the social card"]

    style gen fill:transparent,stroke:#2E7D32,stroke-width:2px
```

**What `sync-ampline.mjs` copies.** Twelve files from `ampline-claude/lib`, byte for byte: `colors`,
`bar`, `layout`, `usage`, `config`, `render` and the segments `model`, `context`, `rateLimits`,
`cost`, `pr`, `subagents`. It deliberately does not copy `git`, `task`, `cache`, `claudeDir` or
`install`, because they need `fs` or `child_process`. `npm run sync:check` (run in CI) fails when
the committed file differs from what the script would write now. Nothing hand-edits the
generated file.

**What the runtime replaces.** `createAmpline()` in `runtime/ampline.js` gives each instance its
own registry. These requests do not reach the vendored code as written:

| Request | What the browser gets |
| --- | --- |
| `cache` | an in-memory `Map` with the same `read` / `write` / `remove` shape |
| `config` `loadConfig()` | the instance's current config (`setConfig()`), validated by the real `validateAndMerge` |
| `segments/git`, `segments/task` | fakes from `runtime/fakes.js` that read the payload's demo-only `__demo` field |
| `fs`, `crypto`, `child_process` | stubs that throw if anything calls them |
| `path`, `os`, `claudeDir` | small shims (`/home/you`, with `.claude` under it) |

**The page uses several instances on purpose.** `main.js` makes a 120-column instance for the
hero, a separate 500-column one for the tour (which reconfigures segments per card) and
its own for the playground, so config set for one never leaks into another.
`createAmpline({ noColor })` exists in the runtime API because `colors.js` reads `NO_COLOR`
once when it loads, so no-color output needs its own instance. The playground creates one
the first time NO_COLOR is switched on. Each playground render clears the instance's
in-memory cache first (`resetCache()`), so the output depends only on the controls.

**The wave logo uses the renderer's wheel but is not part of the render path.** `main.js` passes
`amp.colors.WHEEL` (from the vendored `colors` module) to `equalizer.js`, which colors the 20 bars
in the nav and the hero. `hero.js` only drives the statusline cycle and never touches the waves,
so both animate freely and no bar is held for the current model (D18 in
[`DECISIONS.md`](../DECISIONS.md)).

## How it is kept honest

```mermaid
flowchart TB
    subgraph tests["test/ (node:test, run by npm test and CI)"]
        direction TB
        parity["runtime-parity.test.mjs<br/>runtime output must equal<br/>the real binary's output"]
        fakes["fakes.test.mjs<br/>git and task fakes must equal<br/>bytes captured from the real binary"]
        syncT["sync.test.mjs<br/>generated file is current and<br/>every vendored file is verbatim"]
    end

    bin["node_modules/ampline-claude/bin<br/>the real binary, run per payload"]
    rt["createAmpline()<br/>the browser runtime under test"]
    cap["Captured real bytes<br/>inline in fakes.test.mjs"]
    fk["runtime/fakes.js"]
    gen["runtime/factories.generated.js"]

    parity --> bin
    parity --> rt
    fakes --> cap
    fakes --> fk
    syncT --> gen

    style tests fill:transparent,stroke:#2E7D32,stroke-width:2px
```

**Parity.** For each demo payload, `runtime-parity.test.mjs` spawns the real ampline-claude
binary from `node_modules` with the payload on stdin, renders the same payload through
`createAmpline()`, and asserts the two strings are identical. The demo-only `__demo` field is
stripped first, because the real binary has no repo or todo file to read in that sandbox.

**Fakes are pinned separately.** Because parity cannot cover the git and task segments, the
output format of the two fakes is pinned to bytes captured from the real binary in
`fakes.test.mjs`. If ampline-claude changes how those segments render, the test fails and the
fakes get updated by hand.

**The last step has its own tests.** `ansi.test.mjs` covers `parseAnsi` and `renderAnsi`,
`payloads.test.mjs` covers the wheel index and the demo payload builders, and `tour.test.mjs`
checks each tour card against the renderer's real single-segment output. The page-level
contract (CSP-safe HTML, no third-party resources) is `html-contract.test.mjs`.

---
_Last verified: 2026-10-12 · site 0.2.0_
