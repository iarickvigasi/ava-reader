"""Map complete, literal source glyphs to immutable accepted character offsets."""

from .geometry import overlap
from .observations import PageObservation
from .ocr_glyph_fragments import Fragment
from .ocr_glyph_types import GlyphMap, MappedGlyph
from .segments import Segment


def literal_fragment_map(
    page: PageObservation, owner: Segment, owners: list[Segment], fragments: list[Fragment]
) -> GlyphMap | None:
    accepted = [(i, c) for i, c in enumerate(owner.text) if not c.isspace()]
    source = [(line.id, ordinal, glyph) for line, values in fragments for ordinal, glyph in values]
    keys = [(g.text, g.box.x0, g.box.y0, g.box.x1, g.box.y1) for _, _, g in source]
    if len(set(keys)) != len(keys):
        return None
    if any(
        other is not owner
        and other.page == page.number
        and any(overlap(g.box, other.box) for _, _, g in source)
        for other in owners
    ):
        return None
    if [c for _, _, g in source for c in g.text if not c.isspace()] != [c for _, c in accepted]:
        return None
    mapped, cursor = [], 0
    for line_id, ordinal, glyph in source:
        length = sum(not c.isspace() for c in glyph.text)
        start, end = accepted[cursor][0], accepted[cursor + length - 1][0] + 1
        if length > 1 and owner.text[start:end] != glyph.text:
            return None
        mapped.append(MappedGlyph(line_id, ordinal, glyph, start, end))
        cursor += length
    return GlyphMap(owner.id, owner.text, tuple(mapped))
