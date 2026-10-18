"""Prove the complete physical stream and literal immutable owner offsets."""

from .observations import PageObservation
from .ocr_glyph_fragments import source_fragments
from .ocr_glyph_stream import single_stream
from .ocr_glyph_types import GlyphMap
from .ocr_literal_glyph_map import literal_fragment_map
from .segments import Segment
from .source_gutters import crosses_source_gutter


def source_glyph_map(
    page: PageObservation, owner: Segment, owners: list[Segment]
) -> GlyphMap | None:
    fragments = source_fragments(page, owner)
    if fragments is None or not single_stream(fragments) or crosses_source_gutter(page, fragments):
        return None
    return literal_fragment_map(page, owner, owners, fragments)
