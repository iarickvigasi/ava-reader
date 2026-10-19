#!/usr/bin/env python3
"""Rebuild AVA's complete local main faces from immutable official inputs.

Python3.12, fonttools[woff]==4.65.0, brotli==1.2.0, zopfli==0.4.3.
Usage: python build-main.py SOURCE_DIRECTORY OUTPUT_DIRECTORY
Fetch the listed original relative paths and OFL.txt files from:
https://raw.githubusercontent.com/google/fonts/bd8f81ddb5c74d5c8897b36ad88b440266245103/ofl/
No glyph subsetting. Nonweight axes are fixed to the original Google loader defaults.
"""

import hashlib
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

COMMIT = "bd8f81ddb5c74d5c8897b36ad88b440266245103"
FONTS = [
    {
        "source": "abhayalibre/AbhayaLibre-Regular.ttf",
        "target": "abhaya-libre-400.woff2",
        "sha256": "d4279d38a0012fa54d340979694e70e3235266220dedc0d7000131345fb33bd4",
        "fixed_axes": {},
    },
    {
        "source": "abhayalibre/AbhayaLibre-Bold.ttf",
        "target": "abhaya-libre-700.woff2",
        "sha256": "01fb4cd74841c5f108372737a74cfedeaf0a722ca23e2275dc69f411dc0ad5a6",
        "fixed_axes": {},
    },
    {
        "source": "abhayalibre/AbhayaLibre-ExtraBold.ttf",
        "target": "abhaya-libre-800.woff2",
        "sha256": "a8d05da8766a9bc540e0ea5b63f36a141d629907e8f06c4c2b23bb0bd741b2e1",
        "fixed_axes": {},
    },
    {
        "source": "afacad/Afacad[wght].ttf",
        "target": "afacad-normal.woff2",
        "sha256": "89513fc375cafeecca81110f6a3ef5882d7ac2d871a365b6c93bbfa6039b8230",
        "fixed_axes": {},
    },
    {
        "source": "inter/Inter[opsz,wght].ttf",
        "target": "inter-normal.woff2",
        "sha256": "29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031",
        "fixed_axes": {"opsz": 14},
    },
    {
        "source": "notoserif/NotoSerif[wdth,wght].ttf",
        "target": "noto-serif-normal.woff2",
        "sha256": "4d8e6761424656867019081a1a01336f3cb086982682698714054fc33f782713",
        "fixed_axes": {"wdth": 100},
    },
    {
        "source": "notoserif/NotoSerif-Italic[wdth,wght].ttf",
        "target": "noto-serif-italic.woff2",
        "sha256": "e87acbc6c0efd0d9a20d6a8cbbda2b266c14be3a3a6f5af8ec9d7b2460570ad1",
        "fixed_axes": {"wdth": 100},
    },
]
LICENSES = {
    "abhayalibre": "fe9183a0b7c1ae626b14004cd533c89ec7c192aba017f81ab71ede910256abb2",
    "afacad": "a65e37f173d58cab5d4f8eb6373f4e24ee79ad6c80235dbe845a117917af2d99",
    "inter": "5b9321a4298cfeb6b34354164a1c3afc3db114569984c502b9b35d988fd58c57",
    "notoserif": "cee9892f9f0cc8fe882c9e9537ee6a89621d86ee7ceaf70b02e2b2b1c25c061a",
}


def checked(path, expected):
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise ValueError(f"Upstream hash differs: {path.name}")


def main():
    if len(sys.argv) != 3:
        raise SystemExit(
            "Usage: python build-main.py SOURCE_DIRECTORY OUTPUT_DIRECTORY"
        )
    source, output = map(Path, sys.argv[1:])
    # Check all originals/licenses before creating output; unknown revisions are refused.
    for item in FONTS:
        checked(source / item["source"], item["sha256"])
    for family, sha256 in LICENSES.items():
        checked(source / family / "OFL.txt", sha256)
    output.mkdir(parents=True, exist_ok=True)
    for item in FONTS:
        font = TTFont(source / item["source"], recalcTimestamp=False)
        cmap = font.getBestCmap()
        if item["fixed_axes"]:
            instantiateVariableFont(font, item["fixed_axes"], inplace=True)
        if font.getBestCmap() != cmap:
            raise ValueError(f"Unicode map changed: {item['target']}")
        font.flavor = "woff2"
        target = output / item["target"]
        font.save(target)
        reopened = TTFont(target)
        if reopened.getBestCmap() != cmap:
            raise ValueError(f"Exported Unicode map differs: {item['target']}")
        print(
            f"{item['target']}: {target.stat().st_size} B; {hashlib.sha256(target.read_bytes()).hexdigest()}"
        )
    for family in LICENSES:
        target = (
            "abhaya-libre"
            if family == "abhayalibre"
            else "noto-serif"
            if family == "notoserif"
            else family
        )
        (output / f"{target}-OFL.txt").write_bytes(
            (source / family / "OFL.txt").read_bytes()
        )


if __name__ == "__main__":
    main()
