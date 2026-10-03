"""Qualify only an observed glyph envelope; never waive the whole-page native guard."""

from typing import Any

from pypdf import PdfReader

from .observations import NativeLine, PageObservation
from .visibility import display_risks


def font_region_safe(
    source_page: Any, reader: PdfReader, page: PageObservation, lines: list[NativeLine]
) -> bool:
    crop = source_page.cropbox
    if (
        page.rotation != 0
        or source_page.rotation % 360 != 0
        or float(crop.left) != 0
        or float(crop.bottom) != 0
        or list(crop) != list(source_page.mediabox)
        or float(crop.width) != page.width_pt
        or float(crop.height) != page.height_pt
    ):
        return False
    glyphs = [g for line in lines for g in line.glyphs]
    if not glyphs or any(not g.visible for g in glyphs):
        return False
    bounds = (
        min(g.box.x0 for g in glyphs),
        page.height_pt - max(g.box.y1 for g in glyphs),
        max(g.box.x1 for g in glyphs),
        page.height_pt - min(g.box.y0 for g in glyphs),
    )
    # The caller separately checks actual text rendering mode/font/opacity safety.
    risks = display_risks(
        source_page, reader, glyph_bounds=bounds, allow_transformed_rectangles=True
    )
    return not (set(risks) - {"nonstandard_text_rendering"})
