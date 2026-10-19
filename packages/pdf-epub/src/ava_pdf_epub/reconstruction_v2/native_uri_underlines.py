"""Corroborate a single marginal Artifact URI underline before rasterizing its text."""

import math
from statistics import median
from typing import Any

from PIL import Image

from ..contracts.source import Box
from ..pdf_navigation import navigation_uri
from .native_paint import _color, _plain_color
from .observations import NativeLine


def native_uri_underline(
    obj: dict[str, Any],
    box: Box,
    lines: list[NativeLine],
    width: float,
    height: float,
    image: Image.Image,
) -> str | None:
    color = obj.get("non_stroking_color")
    if isinstance(color, list):
        color = tuple(color)
    if (
        obj.get("ncs") not in {"DeviceRGB", "DeviceGray"}
        or obj.get("object_type") != "rect"
        or obj.get("tag") != "Artifact"
        or obj.get("fill") is not True
        or obj.get("stroke") is not False
        or not _plain_color(color)
    ):
        return None
    ink = _color(color)
    matches = []
    for line in lines:
        if not (line.box.y1 <= height * 0.08 or line.box.y0 >= height * 0.92):
            continue
        label = line.text.strip()
        if not label.startswith(("www.", "https://", "http://")):
            continue
        try:
            navigation_uri(label)
        except ValueError:
            continue
        glyphs = [g for g in line.glyphs if g.text.strip()]
        if not glyphs or not all(
            g.visible and g.source_artifact and g.paint_ink_color == ink for g in glyphs
        ):
            continue
        size = median(g.size for g in glyphs)
        bottom = median(g.box.y1 for g in glyphs)
        if (
            max(g.box.y1 for g in glyphs) - min(g.box.y1 for g in glyphs) <= 0.1
            and abs(box.x0 - min(g.box.x0 for g in glyphs)) <= 0.1
            and abs(box.x1 - max(g.box.x1 for g in glyphs)) <= 0.1
            and 0 < box.y1 - box.y0 <= size * 0.1
            and bottom - size * 0.25 <= box.y0 < box.y1 <= bottom
        ):
            matches.append(line.id)
    if len(matches) != 1:
        return None
    # The page raster independently confirms whole visible rectangle ink; an
    # image/vector-only clip can be irrelevant to text yet invalidate this style.
    sx, sy = image.width / width, image.height / height
    interior = (
        math.ceil(box.x0 * sx),
        math.ceil(box.y0 * sy),
        math.floor(box.x1 * sx),
        math.floor(box.y1 * sy),
    )
    if image.mode != "RGB" or interior[0] >= interior[2] or interior[1] >= interior[3]:
        return None
    pixels = image.crop(interior)
    target = tuple(int(ink[i : i + 2], 16) for i in [1, 3, 5])
    if any(abs(channel - target[index % 3]) > 3 for index, channel in enumerate(pixels.tobytes())):
        return None
    return matches[0]
