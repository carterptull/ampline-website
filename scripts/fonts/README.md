# Rebuilding the mono font subset

`site/assets/fonts/mono-400.v2.woff2` and `mono-700.v2.woff2` are subsets of Iosevka Fixed v34.9.0
Regular and Bold (SIL OFL, `site/assets/fonts/OFL.txt`). Why, and the exact hashes, are in
`DECISIONS.md` (D24). `test/font-coverage.test.mjs` fails when the renderer or the site draws a
glyph these files lack, so rebuild when that happens.

Nothing here is a project dependency: the tools live in a throwaway directory outside the repo.

```sh
# 1. Scratch directory and tools (outside the repo)
mkdir font-build && cd font-build
python -m venv venv
venv/bin/pip install fonttools brotli          # Windows: venv/Scripts/pip   (built with fonttools 4.68.0, brotli 1.2.1)

# 2. Source: the hinted TTF archive from the official release, into its own empty directory.
#    Treat it as untrusted data: extract only the two TTFs, never run anything from it.
mkdir dl src
curl -L -o dl/PkgTTF-IosevkaFixed-34.9.0.zip \
  https://github.com/be5invis/Iosevka/releases/download/v34.9.0/PkgTTF-IosevkaFixed-34.9.0.zip
sha256sum dl/*.zip        # c3204f46863af9e7f0ae06f0bd0b3414697c424dba8573daf37c3053a76213b7
unzip -j dl/PkgTTF-IosevkaFixed-34.9.0.zip IosevkaFixed-Regular.ttf IosevkaFixed-Bold.ttf -d src
sha256sum src/*.ttf       # Bold b7a2e8ca..., Regular c90a6bce... (full values in D24)

# 3. Subset. Default layout features on purpose (see D24); do not add --layout-features='*'.
U="U+0020-007E,U+00B7,U+2026,U+2191,U+2193,U+2197,U+21B3,U+21BA,U+2265,U+2387,U+2502,U+2503,U+2588,U+2591,U+25CF,U+26A0,U+2713"
venv/bin/pyftsubset src/IosevkaFixed-Regular.ttf --unicodes="$U" --flavor=woff2 --output-file=mono-400.v2.woff2
venv/bin/pyftsubset src/IosevkaFixed-Bold.ttf    --unicodes="$U" --flavor=woff2 --output-file=mono-700.v2.woff2
sha256sum mono-*.v2.woff2 # compare with D24
```

Unicode list: ASCII U+0020-007E, then `· … ↑ ↓ ↗ ↳ ↺ ≥ ⎇ │ ┃ █ ░ ● ⚠ ✓`.

When the list or the source version changes:

1. Write the new files under the next version token (`mono-400.v3.woff2`, ...). `/assets/` is served
   `immutable` for a year, so a changed file must have a new name.
2. Update the `@font-face` urls in `site/css/tokens.css`, the preloads in `site/index.html` and
   `site/og-card.html`, the file names in `site/assets/fonts/OFL.txt`, `CLAUDE.md`, and
   `test/serve.test.mjs`; delete the old files with `git rm`.
3. Record the new recipe and hashes as a new entry in `DECISIONS.md`, and add a CHANGELOG line.
4. Run `npm test`.
