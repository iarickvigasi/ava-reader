"""Witness one separate numbered-heading tab; keep the title's ordinary layout proof."""

import re

from .complete_fragment_lines import complete_fragment_lines
from .geometry import union
from .observations import PageObservation
from .ocr_glyph_fragments import Fragment
from .ocr_glyph_stream import single_stream
from .source_gutters import crosses_source_gutter


def numbered_heading_layout(page: PageObservation, fragments: list[Fragment]) -> str | None:
    if len(fragments) < 2 or not complete_fragment_lines(fragments):
        return None
    ordinal, digits = fragments[0]
    body = fragments[1:]
    if (
        re.fullmatch(r"[1-9][0-9]{0,2}", ordinal.text.strip()) is None
        or "".join(g.text for _, g in digits) != ordinal.text.strip()
        or not single_stream(fragments[:1])
        or not single_stream(body)
        or crosses_source_gutter(page, body)
    ):
        return None
    glyphs = [g for _, values in fragments for _, g in values]
    face, size = glyphs[0].font, glyphs[0].size
    if (
        not face
        or any(g.font != face or abs(g.size - size) > 0.000001 for g in glyphs)
        or any(line.style.bold is not True or line.style.italic is True for line, _ in fragments)
    ):
        return None
    number_box = union([g.box for _, g in digits])
    title_box = union([g.box for _, g in body[0][1]])
    if (
        not 0 < title_box.x0 - number_box.x1 <= 2 * size
        or abs((title_box.y0 + title_box.y1 - number_box.y0 - number_box.y1) / 2) > size / 4
        or any(
            abs(union([g.box for _, g in values]).x0 - title_box.x0) > size / 4
            for _, values in body
        )
    ):
        return None
    return " ".join(line.text.strip() for line, _ in fragments)
