"""Authored native line with one sub-threshold missing word separator."""

from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.observations import Glyph, NativeLine
from ava_pdf_epub.reconstruction_v2.spacing_capture import glyph_metric_key
from ava_pdf_epub.reconstruction_v2.spacing_metric import SpacingMetric


def spacing_fixture(*, gap=1.7, tracking=0.0, text="AlphaBeta continues ordinary prose words"):
    glyphs = []
    metrics = {}
    x = 20.0
    for index, char in enumerate(text):
        if index:
            x += tracking + (gap if index == 5 else 0)
        box = Box(coordinate_space="page_points_top_left", x0=x, y0=20, x1=x + 4, y1=30)
        glyph = Glyph(
            text=char, box=box, font="Helvetica", size=10, visible=True, paint_ink_color="#000000"
        )
        glyphs.append(glyph)
        metrics[glyph_metric_key(glyph)] = SpacingMetric(1, 2.5, 10, tracking)
        x += 4
    line = NativeLine(
        id="p1-line0",
        box=Box(coordinate_space="page_points_top_left", x0=20, y0=20, x1=x, y1=30),
        text=text,
        glyphs=glyphs,
        style=Style(id="body", family="sans-serif"),
    )
    return line, metrics
