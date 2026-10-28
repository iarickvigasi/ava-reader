"""Rebuild primary WOFF2 assets from pinned Google Fonts sources (see README.md)."""

import hashlib
import io
from pathlib import Path
from urllib.request import urlopen

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

REVISION = "9862abc066c9b83bf84c3e8ed1fc2d8d48f9bbf0"
BASE = f"https://raw.githubusercontent.com/google/fonts/{REVISION}/ofl"
OUTPUT = Path(__file__).parent
SOURCES = [
    ("abhayalibre", "AbhayaLibre-Regular.ttf", "abhaya-libre-400", {}),
    ("abhayalibre", "AbhayaLibre-Bold.ttf", "abhaya-libre-700", {}),
    ("abhayalibre", "AbhayaLibre-ExtraBold.ttf", "abhaya-libre-800", {}),
    ("afacad", "Afacad[wght].ttf", "afacad", {}),
    ("inter", "Inter[opsz,wght].ttf", "inter", {"opsz": 14}),
    ("notoserif", "NotoSerif[wdth,wght].ttf", "noto-serif", {"wdth": 100}),
    (
        "notoserif",
        "NotoSerif-Italic[wdth,wght].ttf",
        "noto-serif-italic",
        {"wdth": 100},
    ),
]


def download(folder, filename):
    url = f"{BASE}/{folder}/{filename.replace('[', '%5B').replace(']', '%5D')}"
    with urlopen(url, timeout=60) as response:
        return response.read()


def build_fonts():
    for folder, filename, target, axes in SOURCES:
        source = download(folder, filename)
        font = TTFont(io.BytesIO(source))
        if axes:
            instantiateVariableFont(font, axes, inplace=True)
        font.flavor = "woff2"
        font.save(OUTPUT / f"{target}.woff2")
        print(f"{filename}: sha256 {hashlib.sha256(source).hexdigest()}")
    for folder in dict.fromkeys(row[0] for row in SOURCES):
        (OUTPUT / f"{folder}-OFL.txt").write_bytes(download(folder, "OFL.txt"))


if __name__ == "__main__":
    build_fonts()
