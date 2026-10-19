"""Intrinsic whole-owner and original-outline authority for a compound chapter heading."""

from pypdf import PdfReader

from .navigation_alias_key import navigation_alias_key
from .observations import PageObservation
from .ocr_glyph_fragments import source_fragments
from .ocr_glyph_frame import glyph_frame_safe
from .ocr_glyph_owner import eligible_glyph_owner
from .ocr_glyph_types import GlyphMap
from .reader_outline_claims import reader_outline_claims
from .segments import Segment
from .target_heading_layout import target_heading_layout
from .target_ligature_map import target_ligature_map


def source_compound_heading_map(
    reader: PdfReader,
    page: PageObservation,
    owner: Segment,
    owners: list[Segment],
    policy: str | None,
) -> GlyphMap | None:
    if not glyph_frame_safe(reader.pages[page.number - 1], page):
        return None
    windows = []
    for candidate in owners:
        if (
            candidate.kind != "heading"
            or candidate.heading_level != 1
            or not candidate.chapter_start
            or candidate.chapter_role != "bodymatter"
            or not eligible_glyph_owner(page, candidate, owners, policy)
        ):
            continue
        parts = source_fragments(page, candidate)
        title = target_heading_layout(page, parts) if parts else None
        proof = target_ligature_map(page, candidate, owners, parts) if title and parts else None
        if proof is not None and title is not None:
            windows.append((candidate, navigation_alias_key(title), proof))
    selected = [entry for entry in windows if entry[0] is owner]
    if len(selected) != 1:
        return None
    _, key, proof = selected[0]
    if sum(other_key == key for _, other_key, _ in windows) != 1:
        return None
    try:
        claims = [c for c in reader_outline_claims(reader) if navigation_alias_key(c.title) == key]
    except (ValueError, TypeError, KeyError, IndexError):
        return None
    if len(claims) != 1 or claims[0].depth != 0 or claims[0].pdf_page != page.number:
        return None
    return proof
