"""Prove a full OCR owner's source identity, deriving offsets without changing its text."""

from .continuation_presentation_contract import POLICY
from .geometry import overlap
from .observations import PageObservation
from .ocr_glyph_fragments import source_fragments
from .ocr_glyph_stream import single_stream
from .ocr_glyph_types import GlyphMap, MappedGlyph
from .segments import Segment
from .source_gutters import crosses_source_gutter

ALLOWED_RISKS = frozenset(
    {
        "language_uncertain",
        "native_spacing_unresolved",
        "native_spacing_unavailable",
        "native_index_layout",
    }
)


def prove_glyph_map(
    page: PageObservation, owner: Segment, owners: list[Segment], policy: str | None
) -> GlyphMap | None:
    if (
        policy != POLICY
        or set(page.risks) - ALLOWED_RISKS
        or page.rotation
        or owner.method != "ocr"
        or owner.native_line_ids
        or owner.kind in {"table", "figure", "furniture", "unsupported"}
        or owner.source_marginal_furniture
        or owner.page != page.number
        or not owner.box.within(page.width_pt, page.height_pt)
        or not 0 < len(owner.text) <= 200000
        or len({s.id for s in owners}) != len(owners)
        or sum(s is owner for s in owners) != 1
        or len({line.id for line in page.lines}) != len(page.lines)
        or any(overlap(r.box, owner.box) for r in page.required_regions)
        or any(overlap(g.box, owner.box) for g in page.graphics)
    ):
        return None
    fragments = source_fragments(page, owner)
    if fragments is None or not single_stream(fragments) or crosses_source_gutter(page, fragments):
        return None
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
