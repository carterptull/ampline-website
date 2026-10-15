# Page structure

`site/index.html` is one scrolling page. Most of it is static markup. The parts that show
statuslines or move are empty containers that `site/js/main.js` fills after the document is
parsed. `404.html` is a small second page with the same nav and footer.

## Sections in order

```mermaid
flowchart TB
    skip["Skip link<br/>to #main"] --> nav["Nav (sticky)<br/>wordmark + small wave,<br/>Features · Playground · How it works,<br/>GitHub and npm links"]
    nav --> hero["Hero (#top)<br/>wordmark, wave, slogan,<br/>install command + Copy button,<br/>meta line + OS compatibility line,<br/>fake Claude Code terminal"]
    hero --> install["Install (#install)<br/>one command, what it changes,<br/>animated installer terminal + Replay"]
    install --> features["What it shows (#features)<br/>segment tour cards,<br/>customize and FAQ prompts"]
    features --> play["Playground (#playground)<br/>interactive controls re-rendering<br/>the real renderer"]
    play --> how["Under the hood (#how)<br/>four static cards,<br/>FAQ · Configuration · Security ·<br/>Architecture diagrams links"]
    how --> footer["Footer<br/>Buy Me a Beer pill, GitHub · npm ·<br/>Issues · Changelog, copyright,<br/>versions, Anthropic disclaimer"]

```

The Install section plays once when it scrolls into view: it types the install command, prints the
installer's real output and lights a statusline from the runtime, with a Replay button. The Playground
section is fully interactive: model, effort, three sliders, segment toggles, NO_COLOR, a terminal-width
slider and three edge-case presets, all re-rendering the real renderer.

## Which module fills which container

```mermaid
flowchart LR
    main["js/main.js<br/>creates the runtime instances"]

    main --> eq["equalizer.js"]
    main --> copy["copy.js"]
    main --> hero["hero.js"]
    main --> tour["tour.js"]
    main --> play["playground.js"]
    main --> inst["install-demo.js"]
    main --> ver["sets #ampVersion<br/>from the runtime's VERSION"]

    eq --> c1["#navVu and #heroVu<br/>20 bars, colors from the wheel"]
    copy --> c2["#copyBtn and #copyStatus"]
    hero --> c3["#heroBody and #heroSl<br/>typed prompt, then the cycling line"]
    tour --> c4["#tour<br/>one card per segment + subagents"]
    play --> c5["#playMount<br/>controls, preview, hints, JSON"]
    inst --> c6["#installMount<br/>typed command, installer output,<br/>statusline, Replay"]

```

**What is not filled by JavaScript.** The nav, hero text, section headings and leads, the four
"Under the hood" cards, and the whole footer are plain HTML. With JavaScript off, the page
still reads, but the wave bars, the demo statuslines and the tour are empty. The static
`#ampVersion` text is the fallback that `main.js` overwrites.

**The hero wave is independent of the hero line.** Both waves (nav and hero) are mounted once by
`main.js` and animate freely. The cycling line does not hold or highlight a bar for the current
model, so the wave never breaks its rhythm. Only the OG card's still image marks one bar. See D18
in [`DECISIONS.md`](../DECISIONS.md).

**Each statusline container has its own runtime instance** where it matters. The hero line
cycles through models and efforts on a timer (paused while the tab is hidden and off under
`prefers-reduced-motion`). The tour gets a wide instance that it reconfigures per card. The
playground gets two of its own (one with colors, one for NO_COLOR, built on first use). The install
demo gets its own 120-column instance and plays a fixed script once. See [`render-pipeline.md`](render-pipeline.md).

**Two pages outside the flow.** `og-card.html` is a render target: its `og-card.js` builds the
social card from the same runtime, and `site/og.png` is a screenshot of it at 1200x630. It is
marked `noindex` and disallowed in `robots.txt`.

---
_Last verified: 2026-10-15 · site 0.3.0_
