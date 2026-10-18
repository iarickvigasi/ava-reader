"""A coordinate target retains its original page before regional source visibility proof."""

from pypdf import PdfReader

from ..pdf_navigation import NavigationTarget
from .observations import PageObservation
from .ocr_glyph_types import GlyphMap
from .segments import Segment
from .source_visible_glyph_map import source_visible_glyph_map


def visible_target_glyph_map(
    reader: PdfReader,
    target: NavigationTarget,
    page: PageObservation,
    owner: Segment,
    owners: list[Segment],
    policy: str | None,
) -> GlyphMap | None:
    if target.page != page.number or target.url is not None:
        return None
    return source_visible_glyph_map(reader, page, owner, owners, policy)
