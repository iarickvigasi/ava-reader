"""Retain only upright CropBox-local glyph observations and visible-pixel evidence."""

import unicodedata
from typing import Any

from PIL import Image, ImageStat

from .geometry import rectangle
from .observations import Glyph


def observe_glyphs(
    chars: list[dict[str, Any]], image: Image.Image, bounds: tuple[float, float, float, float]
) -> tuple[list[Glyph], list[str]]:
    left, top, right, bottom = bounds
    width, height = right - left, bottom - top
    glyphs: list[Glyph] = []
    risks: set[str] = set()
    if len(chars) > 200000:
        raise ValueError("Page glyph bound exceeded")
    for char in chars:
        values = [float(char[k]) for k in ("x0", "top", "x1", "bottom")]
        x0, y0, x1, y1 = values
        text = str(char["text"])
        combining = bool(text) and bool(unicodedata.combining(text[0]))
        if combining and x0 == x1:
            x1 = x0 + 0.1
        if x1 <= left or x0 >= right or y1 <= top or y0 >= bottom:
            continue
        if not (left <= x0 < x1 <= right and top <= y0 < y1 <= bottom):
            risks.add("clipped_glyph")
            continue
        text = str(char["text"])
        if not text:
            continue
        if "\ufffd" in text or "(cid:" in text or not char.get("upright", True):
            risks.add("unreliable_glyph_mapping")
        box = rectangle((x0 - left, y0 - top, x1 - left, y1 - top), width, height)
        pixels = image.crop(
            (
                box.x0 / width * image.width,
                box.y0 / height * image.height,
                box.x1 / width * image.width,
                box.y1 / height * image.height,
            )
        )
        variance = ImageStat.Stat(pixels).var[0] if pixels.width and pixels.height else 0
        visible = combining or not text.strip() or variance > 3
        if not visible:
            risks.add("glyph_without_visible_ink")
        glyphs.append(
            Glyph(
                text=text,
                box=box,
                font=str(char.get("fontname", "")),
                size=float(char["size"]),
                visible=visible,
            )
        )
    return glyphs, sorted(risks)
