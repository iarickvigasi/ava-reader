# Cyrillic companions

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
