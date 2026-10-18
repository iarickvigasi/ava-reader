"""A positioned destination retains the original target page before source-heading proof."""

from pypdf import PdfReader

from ..pdf_navigation import NavigationTarget
from .observations import PageObservation
from .ocr_glyph_types import GlyphMap
from .segments import Segment
from .source_compound_heading_map import source_compound_heading_map
from .source_numbered_heading_map import source_numbered_heading_map


def numbered_heading_map(
    reader: PdfReader,
    target: NavigationTarget,
    page: PageObservation,
    owner: Segment,
    owners: list[Segment],
    policy: str | None,
) -> GlyphMap | None:
    if target.page != page.number or target.url is not None:
        return None
    return source_numbered_heading_map(
        reader, page, owner, owners, policy
    ) or source_compound_heading_map(reader, page, owner, owners, policy)
