# Font assets

## Main fonts

The root layout uses committed `next/font/local` faces, so a build no longer downloads Google
Fonts CSS or depends on the extensionless URL parsing affected by
[Next issue #99114](https://github.com/vercel/next.js/issues/99114). The previous Google loader already
self-hosted browser requests; this changes the build dependency, not the font designs or a runtime
Google request. Existing CSS family names, variables, configured styles/weights and fallback geometry
are preserved. `fallbacks.css` retains the previous generated Arial/Times New Roman metric overrides
rather than allowing the local loader to recalculate them.

| Asset | Family | CSS weight/style | Retained variable axes | Bytes |
| --- | --- | --- | --- | ---: |
| `abhaya-libre-400.woff2` | Abhaya Libre | 400 normal | none | 120,144 |
| `abhaya-libre-700.woff2` | Abhaya Libre | 700 normal | none | 123,920 |
| `abhaya-libre-800.woff2` | Abhaya Libre | 800 normal | none | 123,304 |
| `afacad-normal.woff2` | Afacad | 400–700 normal | wght:400–700 | 43,616 |
| `inter-normal.woff2` | Inter | 100–900 normal | wght:100–900 | 236,444 |
| `noto-serif-normal.woff2` | Noto Serif | separate 400/700 normal faces | wght:100–900 | 466,684 |
| `noto-serif-italic.woff2` | Noto Serif | separate 400/700 italic faces | wght:100–900 | 577,220 |

Noto's two files are each registered twice with discrete 400/700 CSS descriptors, matching the old
loader; intermediate weight interpolation is not newly introduced. The original Google calls
requested no nonweight axes. Inter's optical-size default 14 and Noto's width default 100 are fixed
in the rebuilt assets, matching the previous compiled faces, while all original weight variation
remains. Noto normal/italic versions are 2.015/2.013; Inter 4.001; Afacad 1.000; Abhaya 1.050.

Every original Unicode cmap entry is retained; there is no glyph subsetting. Inter and both Noto
faces include all 66 Ukrainian upper/lowercase letters, Greek and combining accents. Their coverage
includes the previously delivered script faces: `subsets: ["latin"]` controlled Google preloading,
not which scripts could be rendered. The calibrated Cyrillic companions below remain unchanged.

The seven main assets total 1,691,332B (previous delivered main subsets total 1,494,436B; previous
Latin preload assets total 191,700B in the inspected build). They use `preload: false` and `display: swap`
so CSS requests the used face from AVA's origin without an HTML preload for the whole inventory.
First use can swap from the preserved fallback face. The build manifest also lists every emitted
WOFF/WOFF2 asset; the service worker attempts to cache all of them in the background on activation,
including unused italic faces. This adds the full font inventory to that background transfer. Asset
precaching is best effort: a listed file alone does not prove a completed browser cache or an offline
reading result. This is a deliberate loading change, not a claim of equal transfer size, identical
rendered layout or browser qualification. Verify cached faces and actual offline reading before release.

### Main sources and rebuild

Official [Google Fonts commit bd8f81d](https://github.com/google/fonts/tree/bd8f81ddb5c74d5c8897b36ad88b440266245103/ofl)
was retrieved 2026-10-11. Download the seven original relative paths listed in `build-main.py` plus
each family's `OFL.txt` from that immutable commit, preserving the family directories. The script
checks every original SHA-256 and license SHA-256 before producing output. The four adjacent main
`*-OFL.txt` files are unmodified SIL OFL 1.1 originals. It does not borrow unbound `.next` binaries.

Use an isolated Python 3.12 environment with `fonttools[woff]==4.65.0`, `brotli==1.2.0` and
`zopfli==0.4.3`:

```sh
python apps/web/app/fonts/build-main.py /path/to/pinned-originals /path/to/rebuilt-fonts
```

The output is seven complete WOFF2 files and four licenses. Fixed timestamps, pinned tools,
unchanged cmap checks and original-byte checks make the result reproducible. Compare the output
with committed files before copying it into the app; normal web builds use only committed assets
and require no font-conversion tools or font network requests.

## Cyrillic companions

Latin keeps Afacad (body) and Abhaya Libre (display). The local, script-only faces precede
their fallback stacks, so Cyrillic cannot fall through to Arial/Times. Inter UI and Noto
Serif reader text already support Ukrainian. Companions load on demand, from the app origin.

| Face | Fixed axes | Weights | Size adjustment | Size |
| --- | --- | --- | --- | --- |
| Nunito Sans | YTLC 480, opsz 12, wdth 100 | 400–700 | 88.65% | 20,616 B |
| Source Serif 4 | opsz 20 | 400–800 | 87.4% | 40,352 B |

Both WOFF2 files retain all 66 Ukrainian uppercase/lowercase letters, including Ґґ Єє Іі Її.
Available Cyrillic extensions, combining accents and the hryvnia sign are also retained;
the fonts do not cover every extended Cyrillic character. Latin alphabet cmap entries are excluded.
Both faces are upright, matching the original Latin imports.

## Calibration

Regular-weight outline heights as fractions of an em (lowercase / capital):

- Afacad: .416667 / .625; tuned Nunito Sans: .470 / .705 before scaling.
- Abhaya Libre: .415039 / .585938; Source Serif 4: .475 / .670 before scaling.

The tuned Nunito lowercase-height axis matches both heights within 0.1% at regular weight.
`size-adjust` scales glyphs without changing CSS font sizes. Ascent/descent overrides preserve
the Latin line metrics: Afacad 1440/480 on 1440 UPM; Abhaya 860/348 on 1024 UPM; zero line gaps.
Heavier weights vary slightly: Nunito at 700 has .473/.705; Source Serif at 700 has .48329/.657565.

Compared in Chrome with mixed Latin/Ukrainian strings. Jost was rejected because its actual
binaries lack Ґґ Єє Іі Її. Manrope has too little cap height when its lowercase matches Afacad;
Ysabeau is more calligraphic. Lora was the closest display alternative.

## Sources and rebuild

Downloaded 2026-09-13 from [Google Fonts](https://github.com/google/fonts).
Upstream: [Nunito Sans](https://github.com/Fonthausen/NunitoSans) and
[Source Serif 4](https://github.com/adobe-fonts/source-serif). SIL Open Font License 1.1;
copyright and licenses are included in the adjacent `*-OFL.txt` files.

Install `fonttools[woff]` in an isolated Python environment (used: fonttools 4.65.0, brotli 1.2.0).
Download the originals to a temporary source directory, then run the adjacent build script:

```sh
curl -fsSL 'https://raw.githubusercontent.com/google/fonts/main/ofl/nunitosans/NunitoSans%5BYTLC,opsz,wdth,wght%5D.ttf' -o nunito-sans.ttf
curl -fsSL 'https://raw.githubusercontent.com/google/fonts/main/ofl/sourceserif4/SourceSerif4%5Bopsz,wght%5D.ttf' -o source-serif.ttf
python /path/to/app/fonts/build-cyrillic.py /path/to/sources /path/to/app/fonts
```

Verify these original SHA-256 hashes before reproducing the current assets:

- Nunito Sans: `f934d7142fb4784bf828da485b7dcbd90c0c80d514e9d49a5da0ed3a1ae2491d`
- Source Serif 4: `97b2d4da6e3cb494b5a1e66ae176914d852ccabef49e0c02c0df25f3e39aca0b`
