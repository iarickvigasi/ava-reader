"""Rederive glyph/frame/font/transform identity from the same actual PDF resources."""

from collections import Counter
from math import ulp
from statistics import median
from typing import Any

from pypdf import PdfReader
from pypdf.generic import ContentStream, DictionaryObject, IndirectObject

from .font_region_safety import font_region_safe
from .font_source_safety import font_source_safe
from .native_indent_rows import glyph_key
from .observations import NativeLine, PageObservation
from .ocr_glyph_frame import glyph_frame_safe
from .segments import Segment


def source_metric_face(
    reader: PdfReader,
    source_chars: list[dict[str, Any]],
    page: PageObservation,
    rows: list[NativeLine],
    owner: Segment,
) -> tuple[int, int, float, tuple[float, ...]] | None:
    original = reader.pages[page.number - 1]
    if not (
        glyph_frame_safe(original, page)
        and font_source_safe(original, reader, allow_raster_settings=True)
        and font_region_safe(original, reader, page, rows, allow_raster_settings=True)
    ):
        return None
    glyphs = [g for r in rows for g in r.glyphs if g.text.strip()]
    if not glyphs or len({(g.font, g.paint_bold) for g in glyphs}) != 1:
        return None
    font, size = glyphs[0].font, median(g.size for g in glyphs)
    if any(abs(g.size - size) > 4 * (ulp(g.box.y0) + ulp(g.box.y1)) for g in glyphs):
        return None
    resources: Any = original.get("/Resources", {}).get("/Font", {})
    fonts = [
        v for v in resources.values() if str(v.get_object().get("/BaseFont", "")) == "/" + font
    ]
    if len(fonts) != 1 or not isinstance(fonts[0], IndirectObject):
        return None  # Same font names in different resources do not establish identity.
    resolved = fonts[0].get_object()
    if not isinstance(resolved, DictionaryObject) or resolved.get("/Subtype") not in {
        "/Type1",
        "/TrueType",
        "/Type0",
    }:
        return None
    # Glyph observations omit text-state scale/rise/render mode. Decline those
    # cases rather than grant authority from a font name and nominal size alone.
    for values, operator in ContentStream(original.get_contents(), reader).operations:
        if operator in {b"Tr", b"Ts", b"Tz"} and (
            len(values) != 1 or float(values[0]) != (100 if operator == b"Tz" else 0)
        ):
            return None
    keys = Counter(
        (
            str(c["text"]),
            str(c.get("fontname", "")),
            float(c["size"]),
            float(c["x0"]),
            float(c["top"]),
            float(c["x1"]),
            float(c["bottom"]),
        )
        for c in source_chars
    )
    lookup = {
        (
            str(c["text"]),
            str(c.get("fontname", "")),
            float(c["size"]),
            float(c["x0"]),
            float(c["top"]),
            float(c["x1"]),
            float(c["bottom"]),
        ): c
        for c in source_chars
    }
    # Reobserve the whole owner from actual PDF characters, so an omitted source
    # glyph cannot be hidden by a self-consistent but incomplete saved row.
    box = owner.box
    actual = Counter(
        k
        for k in keys
        for _ in range(keys[k])
        if k[0].strip()
        and min(k[5], box.x1) > max(k[3], box.x0)
        and min(k[6], box.y1) > max(k[4], box.y0)
    )
    if actual != Counter(glyph_key(g) for g in glyphs):
        return None
    transforms = set()
    for glyph in glyphs:
        key = glyph_key(glyph)
        if keys[key] != 1:
            return None
        char = lookup[key]
        matrix = tuple(float(v) for v in char.get("matrix", ())[:4])
        if (
            not char.get("upright")
            or len(matrix) != 4
            or matrix[1:3] != (0, 0)
            or min(matrix[0], matrix[3]) <= 0
        ):
            return None
        transforms.add(matrix)
    if len(transforms) != 1:
        return None
    return fonts[0].idnum, fonts[0].generation, size, next(iter(transforms))
