"""Require source glyph/line/style agreement before deterministic layout correction."""

import unicodedata

from .font_traits import font_traits
from .observations import NativeLine, PageObservation


def qualified_line(line: NativeLine) -> bool:
    ink = [g for g in line.glyphs if g.text.strip()]
    if not ink or not line.text.strip() or line.style.family is None:
        return False
    cursor = 0
    for glyph in line.glyphs:
        if not glyph.text.strip():
            continue  # Parser envelopes may retain trailing source whitespace.
        if (
            not glyph.visible
            or font_traits(glyph.font).family is None
            or glyph.paint_ink_color is None
        ):
            return False
        at = line.text.find(glyph.text, cursor)
        if at < cursor or line.text[cursor:at].strip():
            return False
        cursor = at + len(glyph.text)
    return not line.text[cursor:].strip()


def qualified_layout(page: PageObservation) -> bool:
    if page.risks or page.required_regions or page.rotation or not page.lines:
        return False
    meaningful = [line for line in page.lines if line.text.strip()]
    if not meaningful:
        return False
    return all(
        qualified_line(line) and not any(unicodedata.category(c) == "Sm" for c in line.text)
        for line in meaningful
    )
