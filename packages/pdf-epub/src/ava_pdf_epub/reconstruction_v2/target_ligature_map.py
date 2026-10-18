"""Atomic typographic ligatures in a complete chapter-target witness, never prose repair."""

from .geometry import overlap
from .observations import PageObservation
from .ocr_glyph_fragments import Fragment
from .ocr_glyph_types import GlyphMap, MappedGlyph
from .ocr_literal_glyph_map import literal_fragment_map
from .segments import Segment

LIGATURES = {"ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "ſt", "ﬆ": "st"}


def target_ligature_map(
    page: PageObservation, owner: Segment, owners: list[Segment], parts: list[Fragment]
) -> GlyphMap | None:
    literal = literal_fragment_map(page, owner, owners, parts)
    if literal is not None:
        return literal
    source = [(line.id, ordinal, glyph) for line, values in parts for ordinal, glyph in values]
    keys = [(g.text, g.box.x0, g.box.y0, g.box.x1, g.box.y1) for _, _, g in source]
    if len(set(keys)) != len(keys) or any(
        other is not owner
        and other.page == page.number
        and any(overlap(g.box, other.box) for _, _, g in source)
        for other in owners
    ):
        return None
    accepted = [(i, c) for i, c in enumerate(owner.text) if not c.isspace()]
    mapped, cursor, expanded = [], 0, False
    for line_id, ordinal, glyph in source:
        text = "".join(c for c in glyph.text if not c.isspace())
        for variant in (text, LIGATURES.get(glyph.text)):
            if variant and [c for _, c in accepted[cursor : cursor + len(variant)]] == list(
                variant
            ):
                break
        else:
            return None
        if variant is None:
            return None
        start, end = accepted[cursor][0], accepted[cursor + len(variant) - 1][0] + 1
        if len(variant) > 1 and owner.text[start:end] != variant:
            return None
        expanded |= variant != text
        mapped.append(MappedGlyph(line_id, ordinal, glyph, start, end))
        cursor += len(variant)
    if not expanded or cursor != len(accepted):
        return None
    return GlyphMap(owner.id, owner.text, tuple(mapped))
