"""Select only complete, uniquely proved glyphs in an unchanged caller rectangle."""

from ..contracts.source import Box
from .geometry import area, overlap
from .observations import Glyph
from .ocr_glyph_types import GlyphMap


def glyph_caller_ranges(
    touched: list[tuple[str, int, Glyph]], proofs: list[GlyphMap], caller: Box
) -> list[tuple[str, int, int]] | None:
    result: list[tuple[str, int, int]] = []
    for line_id, ordinal, glyph in touched:
        if area(glyph.box) <= 0 or overlap(glyph.box, caller) / area(glyph.box) < 0.9:
            return None
        matches = [
            (proof, mapped)
            for proof in proofs
            for mapped in proof.glyphs
            if mapped.line_id == line_id and mapped.ordinal == ordinal
        ]
        if len(matches) != 1:
            return None
        proof, mapped = matches[0]
        if result and result[-1][0] == proof.owner_id:
            _, start, end = result[-1]
            if end == mapped.start or proof.text[end : mapped.start].isspace():
                result[-1] = (proof.owner_id, start, mapped.end)
                continue
        result.append((proof.owner_id, mapped.start, mapped.end))
    return result
