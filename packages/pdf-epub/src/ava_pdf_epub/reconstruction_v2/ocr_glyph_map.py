"""Prove a full OCR owner's source identity, deriving offsets without changing its text."""

from .observations import PageObservation
from .ocr_glyph_owner import ALLOWED_RISKS as ALLOWED_RISKS
from .ocr_glyph_owner import eligible_glyph_owner
from .ocr_glyph_types import GlyphMap
from .segments import Segment
from .source_glyph_map import source_glyph_map


def prove_glyph_map(
    page: PageObservation, owner: Segment, owners: list[Segment], policy: str | None
) -> GlyphMap | None:
    if not eligible_glyph_owner(page, owner, owners, policy):
        return None
    return source_glyph_map(page, owner, owners)
