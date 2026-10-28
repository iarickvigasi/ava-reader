# Primary fonts (local builds)

`primary.ts` loads Abhaya Libre (400/700/800), Afacad (400–700), Inter (100–900), and
Noto Serif (400/700, normal/italic) with `next/font/local`, preserving the CSS variables.
Full upstream glyph inventories are retained, including Noto Serif/Inter Cyrillic and Greek,
Noto Serif Vietnamese, and Abhaya Libre Sinhala. Inter's optical size is fixed at 14 and
Noto Serif's width at 100, matching the former Google loader defaults. Other axes stay variable.
Fallback faces use Arial for sans text and Times New Roman for serif text; `next/font/local`
calculates their metric adjustments. Existing script-only companion adjustments are unchanged.

Sources are pinned to Google Fonts commit `9862abc066c9b83bf84c3e8ed1fc2d8d48f9bbf0`.
The adjacent `abhayalibre-OFL.txt`, `afacad-OFL.txt`, `inter-OFL.txt`, and `notoserif-OFL.txt`
contain each family's upstream license. No build-time request to Google Fonts is needed.
To reproduce the WOFF2 assets, install the same fonttools/brotli versions in README.md in a temporary
virtual environment, then run `python apps/web/app/fonts/build-primary.py` from the repo root.
It downloads pinned TTF files and licenses, prints source SHA-256 hashes, fixes the named axes,
and writes WOFF2 files without removing glyphs. This is a maintenance step, never part of builds.
