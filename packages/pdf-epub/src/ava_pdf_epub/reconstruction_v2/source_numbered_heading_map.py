"""A complete source/outline-backed numbered chapter heading retains its original glyph map."""

from pypdf import PdfReader

from .heading_outline_identity import heading_outline_identity
from .numbered_heading_layout import numbered_heading_layout
from .observations import PageObservation
from .ocr_glyph_fragments import source_fragments
from .ocr_glyph_frame import glyph_frame_safe
from .ocr_glyph_owner import eligible_glyph_owner
from .ocr_glyph_types import GlyphMap
from .ocr_literal_glyph_map import literal_fragment_map
from .segments import Segment


def source_numbered_heading_map(
    reader: PdfReader,
    page: PageObservation,
    owner: Segment,
    owners: list[Segment],
    policy: str | None,
) -> GlyphMap | None:
    if (
        not glyph_frame_safe(reader.pages[page.number - 1], page)
        or not eligible_glyph_owner(page, owner, owners, policy)
        or owner.kind != "heading"
        or owner.heading_level != 1
        or not owner.chapter_start
        or owner.chapter_role != "bodymatter"
    ):
        return None
    fragments = source_fragments(page, owner)
    title = numbered_heading_layout(page, fragments) if fragments else None
    if not title or fragments is None:
        return None
    proof = literal_fragment_map(page, owner, owners, fragments)
    if proof is None or not heading_outline_identity(
        reader, page, owner, owners, fragments, title, policy
    ):
        return None
    return proof
