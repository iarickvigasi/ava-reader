"""Target-only regional ink evidence leaves page risks and ordinary proofs unchanged."""

from pypdf import PdfReader

from ..pdf_navigation import NavigationTarget
from .continuation_presentation_contract import POLICY
from .glyph_owner_structure import glyph_owner_structure
from .isolated_ink_risk import isolated_ink_risk
from .observations import PageObservation
from .ocr_glyph_frame import glyph_frame_safe
from .ocr_glyph_types import GlyphMap
from .segments import Segment
from .source_glyph_map import source_glyph_map


def visible_target_glyph_map(
    reader: PdfReader,
    target: NavigationTarget,
    page: PageObservation,
    owner: Segment,
    owners: list[Segment],
    policy: str | None,
) -> GlyphMap | None:
    if (
        policy != POLICY
        or target.page != page.number
        or target.url is not None
        or not glyph_frame_safe(reader.pages[page.number - 1], page)
        or not glyph_owner_structure(page, owner, owners)
        or not isolated_ink_risk(page, owner)
    ):
        return None
    return source_glyph_map(page, owner, owners)
