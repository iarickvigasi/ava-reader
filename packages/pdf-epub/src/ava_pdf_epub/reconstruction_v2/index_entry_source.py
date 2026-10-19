"""An index page cannot exempt arbitrary prose from source role review."""

import re
from itertools import groupby
from statistics import median

from .index_layout import ENTRY_END, FOLIO, index_rows
from .index_projection_types import IndexSourceRow
from .observations import PageObservation
from .ocr_glyph_types import GlyphMap
from .segments import Segment

NUMERIC_WRAP = re.compile(rf"{FOLIO}(?:\s*[,;]\s*{FOLIO})*(?:\s+passim)?[.,;]?", re.I)


def source_index_entry(
    page: PageObservation,
    owner: Segment,
    proof: GlyphMap,
    source_rows: tuple[IndexSourceRow, ...] = (),
) -> bool:
    fragments = [list(values) for _, values in groupby(proof.glyphs, key=lambda item: item.line_id)]
    if not fragments:
        return False
    if source_rows:
        if (
            len(fragments) != len(source_rows)
            or any(
                [(g.line_id, g.ordinal) for g in fragment]
                != [(row.line.id, i) for i, _ in row.values]
                for fragment, row in zip(fragments, source_rows, strict=True)
            )
            or not ENTRY_END.search(source_rows[0].text)
            or not any(c.isalpha() for c in source_rows[0].text)
        ):
            return False
    elif fragments[0][0].line_id not in {row.id for row in index_rows(page)}:
        return False
    source = {row.id: row for row in page.lines}
    first = fragments[0]
    left = max(item.glyph.box.x1 for item in first) < page.width_pt / 2
    right = min(item.glyph.box.x0 for item in first) > page.width_pt / 2
    if not (left or right):
        return False
    first_x = min(item.glyph.box.x0 for item in first)
    previous_bottom = max(item.glyph.box.y1 for item in first)
    for index, fragment in enumerate(fragments):
        expected = [
            ordinal
            for ordinal, glyph in enumerate(source[fragment[0].line_id].glyphs)
            if glyph.text.strip()
            and (glyph.box.x1 < page.width_pt / 2 if left else glyph.box.x0 > page.width_pt / 2)
        ]
        if [item.ordinal for item in fragment] != expected:
            return False  # A cropped suffix cannot acquire the whole entry's role.
        text = owner.text[fragment[0].start : fragment[-1].end]
        if index == 0:
            if not ENTRY_END.search(text):
                return False
            continue
        size = median(item.glyph.size for item in fragment)
        if (
            NUMERIC_WRAP.fullmatch(text) is None
            or min(item.glyph.box.x0 for item in fragment) - first_x < size / 2
            or not 0 <= min(item.glyph.box.y0 for item in fragment) - previous_bottom <= size * 2
        ):
            return False
        previous_bottom = max(item.glyph.box.y1 for item in fragment)
    return True
