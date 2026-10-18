"""A row slice retains original line identity, ordinal order and literal whitespace."""

from .geometry import area, union
from .index_projection_types import IndexSourceRow
from .index_row_spacing import index_row_spacing
from .observations import Glyph, NativeLine, PageObservation


def index_source_row(
    page: PageObservation, line: NativeLine, values: list[tuple[int, Glyph]], column: int
) -> IndexSourceRow | None:
    if not values:
        return None
    if any(
        not g.visible
        or g.source_artifact
        or area(g.box) <= 0
        or not g.box.within(page.width_pt, page.height_pt)
        or "\ufffd" in g.text
        or "(cid:" in g.text
        for _, g in values
    ):
        return None
    first, last = values[0][0], values[-1][0]
    if [i for i, g in enumerate(line.glyphs) if first <= i <= last and g.text.strip()] != [
        i for i, _ in values
    ]:
        return None
    cursor, positions = 0, {}
    for ordinal, glyph in enumerate(line.glyphs):
        start = line.text.find(glyph.text, cursor)
        if start < cursor or line.text[cursor:start].strip():
            return None
        positions[ordinal] = (start, start + len(glyph.text))
        cursor = start + len(glyph.text)
    if not index_row_spacing(line, values, positions):
        return None
    text = line.text[positions[first][0] : positions[last][1]]
    if any(b.box.x0 < a.box.x0 for (_, a), (_, b) in zip(values, values[1:], strict=False)):
        return None
    return IndexSourceRow(
        line,
        tuple(values),
        column,
        text,
        union([g.box for _, g in values]),
        max(g.size for _, g in values),
    )
