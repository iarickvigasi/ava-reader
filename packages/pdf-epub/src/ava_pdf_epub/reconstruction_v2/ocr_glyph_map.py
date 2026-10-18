"""Prove a full OCR owner's source identity, deriving offsets without changing its text."""

from .observations import PageObservation
from .ocr_glyph_fragments import source_fragments
from .ocr_glyph_owner import ALLOWED_RISKS as ALLOWED_RISKS
from .ocr_glyph_owner import eligible_glyph_owner
from .ocr_glyph_stream import single_stream
from .ocr_glyph_types import GlyphMap
from .ocr_literal_glyph_map import literal_fragment_map
from .segments import Segment
from .source_gutters import crosses_source_gutter


def prove_glyph_map(
    page: PageObservation, owner: Segment, owners: list[Segment], policy: str | None
) -> GlyphMap | None:
    if not eligible_glyph_owner(page, owner, owners, policy):
        return None
    fragments = source_fragments(page, owner)
    if fragments is None or not single_stream(fragments) or crosses_source_gutter(page, fragments):
        return None
    return literal_fragment_map(page, owner, owners, fragments)
