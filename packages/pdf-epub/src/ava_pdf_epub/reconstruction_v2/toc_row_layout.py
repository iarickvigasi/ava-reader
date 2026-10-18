"""Witness only a leading decimal ordinal tab and a detached, aligned terminal folio."""

import re
from dataclasses import dataclass

from .geometry import union
from .observations import NativeLine, PageObservation
from .ocr_glyph_fragments import Fragment
from .ocr_glyph_stream import single_stream
from .source_gutters import crosses_source_gutter


@dataclass(frozen=True)
class TocRowLayout:
    title: str
    folio: NativeLine
    ordinal: str


def toc_row_layout(
    page: PageObservation, fragments: list[Fragment], label: str
) -> TocRowLayout | None:
    if len(fragments) < 2:
        return None
    folio, values = fragments[-1]
    if folio.text.strip() != label or "".join(g.text for _, g in values) != label:
        return None
    body = [(line, list(glyphs)) for line, glyphs in fragments[:-1]]
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
        if (
            len(gaps) != 1
            or re.fullmatch(r"[1-9][0-9]{0,2}", prefix) is None
            or glyphs[at][1].box.x0 - glyphs[at - 1][1].box.x1
            > 4 * min(glyphs[at][1].size, glyphs[at - 1][1].size)
        ):
            return None
        prefix_glyphs = at
        body[0] = (first, glyphs[at:])
    if not single_stream(body) or crosses_source_gutter(page, body):
        return None
    titles = []
    for index, (line, selected) in enumerate(body):
        original = [i for i, glyph in enumerate(line.glyphs) if glyph.text.strip()]
        permitted = original[prefix_glyphs:] if index == 0 and prefix else original
        if [i for i, _ in selected] != permitted:
            return None
        text = line.text.strip()
        if index == 0 and prefix and not text.startswith(prefix):
            return None
        titles.append(text)
    last = union([g.box for _, g in body[-1][1]])
    tail = union([g.box for _, g in values])
    size = min(g.size for _, g in [*body[-1][1], *values])
    if (
        tail.x0 <= max(g.box.x1 for _, selected in body for _, g in selected)
        or abs((tail.y0 + tail.y1 - last.y0 - last.y1) / 2) > size / 4
    ):
        return None
    title = " ".join(" ".join(titles).split())
    return TocRowLayout(title, folio, prefix) if title else None
