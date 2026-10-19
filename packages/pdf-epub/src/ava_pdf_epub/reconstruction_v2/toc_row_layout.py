"""Witness only a leading decimal ordinal tab and an aligned terminal folio."""

import re
from dataclasses import dataclass

from .geometry import union
from .observations import PageObservation
from .ocr_glyph_fragments import Fragment
from .ocr_glyph_stream import single_stream
from .source_gutters import crosses_source_gutter
from .toc_folio_tail import TocFolio
from .toc_row_parts import toc_row_parts
from .toc_row_titles import toc_row_titles


@dataclass(frozen=True)
class TocRowLayout:
    title: str
    folio: TocFolio
    ordinal: str


def toc_row_layout(
    page: PageObservation, fragments: list[Fragment], label: str
) -> TocRowLayout | None:
    parts = toc_row_parts(fragments, label)
    if parts is None:
        return None
    body, folio = parts
    values = folio.glyphs
    prefix = ""
    prefix_glyphs = 0
    first, glyphs = body[0]
    gaps = [
        i
        for i in range(1, len(glyphs))
        if glyphs[i][1].box.x0 - glyphs[i - 1][1].box.x1
        > min(glyphs[i][1].size, glyphs[i - 1][1].size) / 2
    ]
    if gaps:
        at = gaps[0]
        prefix = "".join(g.text for _, g in glyphs[:at])
        token = re.match(r"([1-9][0-9]{0,2})\s", first.text.lstrip())
        if (
            len(gaps) != 1
            or token is None
            or token.group(1) != prefix
            or glyphs[at][1].box.x0 - glyphs[at - 1][1].box.x1
            > 4 * min(glyphs[at][1].size, glyphs[at - 1][1].size)
        ):
            return None
        if not single_stream([(first, glyphs[:at])]):
            return None
        prefix_glyphs = at
        body[0] = (first, glyphs[at:])
    if not single_stream(body) or crosses_source_gutter(page, body):
        return None
    last = union([g.box for _, g in body[-1][1]])
    tail = union([g.box for _, g in values])
    size = min(g.size for _, g in [*body[-1][1], *values])
    if (
        tail.x0 <= max(g.box.x1 for _, selected in body for _, g in selected)
        or abs((tail.y0 + tail.y1 - last.y0 - last.y1) / 2) > size / 4
    ):
        return None
    title = toc_row_titles(body, folio, label, prefix, prefix_glyphs)
    return TocRowLayout(title, folio, prefix) if title else None
