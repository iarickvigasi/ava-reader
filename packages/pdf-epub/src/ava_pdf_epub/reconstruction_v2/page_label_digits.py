"""The original complete source token, digit and comma geometry qualification."""

import re

from ..contracts.source import Box
from .geometry import area, overlap
from .observations import NativeLine, PageObservation


def page_label_digits(
    page: PageObservation, line: NativeLine, owner_box: Box, caller: Box, label: str
) -> tuple[int, int] | None:
    tokens = [token for token in re.finditer(r"\S+", line.text) if token.group() == label + ","]
    if len(tokens) != 1:
        return None
    token = tokens[0]
    boundary = token.end() - 1
    selected: set[int] = set()
    comma = False
    cursor = 0
    for glyph in line.glyphs:
        offset = line.text.find(glyph.text, cursor)
        cursor = offset + len(glyph.text)
        if not glyph.text.strip():
            continue
        if not glyph.box.within(page.width_pt, page.height_pt) or area(glyph.box) <= 0:
            return None
        fraction = overlap(glyph.box, caller) / area(glyph.box)
        if token.start() <= offset < boundary:
            if (
                cursor > boundary
                or fraction < 0.9
                or overlap(glyph.box, owner_box) / area(glyph.box) < 0.9
            ):
                return None
            selected.update(range(offset, cursor))
        elif offset == boundary and glyph.text == ",":
            # The exact declared destination label, not this midpoint, provides
            # boundary authority. The midpoint only refuses a comma-centered link.
            center_x = (glyph.box.x0 + glyph.box.x1) / 2
            center_y = (glyph.box.y0 + glyph.box.y1) / 2
            if (
                not 0 < fraction < 0.9
                or caller.x0 <= center_x <= caller.x1
                and caller.y0 <= center_y <= caller.y1
            ):
                return None
            comma = True
        elif fraction > 0:
            return None
    if not comma or selected != set(range(token.start(), boundary)):
        return None
    return token.start(), boundary
