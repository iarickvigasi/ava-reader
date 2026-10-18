"""A caller selects whole proved glyphs, retaining exact OCR whitespace and gaps."""

from ..contracts.source import Box
from .geometry import area, overlap
from .glyph_caller_ranges import glyph_caller_ranges
from .observations import PageObservation
from .ocr_glyph_map import prove_glyph_map
from .segments import Segment


def ocr_glyph_ranges(
    page: PageObservation, owners: list[Segment], caller: Box, policy: str | None
) -> list[tuple[str, int, int]] | None:
    touched = [
        (line.id, i, glyph)
        for line in page.lines
        for i, glyph in enumerate(line.glyphs)
        if glyph.text.strip()
        and (area(glyph.box) <= 0 or overlap(glyph.box, caller) / area(glyph.box) > 0.05)
    ]
    if not touched or len(touched) > 20000:
        return None
    proofs = [
        proof
        for owner in owners
        if any(overlap(g.box, owner.box) for _, _, g in touched)
        and (proof := prove_glyph_map(page, owner, owners, policy)) is not None
    ]
    return glyph_caller_ranges(touched, proofs, caller)
