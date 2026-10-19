"""One complete original outline title must identify exactly one eligible source heading window."""

from pypdf import PdfReader

from .heading_title_window import heading_title_window
from .navigation_alias_key import navigation_alias_key
from .numbered_heading_layout import numbered_heading_layout
from .observations import PageObservation
from .ocr_glyph_fragments import Fragment, source_fragments
from .ocr_glyph_owner import eligible_glyph_owner
from .ocr_literal_glyph_map import literal_fragment_map
from .reader_outline_claims import reader_outline_claims
from .segments import Segment


def heading_outline_identity(
    reader: PdfReader,
    page: PageObservation,
    owner: Segment,
    owners: list[Segment],
    fragments: list[Fragment],
    title: str,
    policy: str | None,
) -> bool:
    keys = heading_title_window(page, owner, owners, fragments, title, policy)
    try:
        matches = [
            claim
            for claim in reader_outline_claims(reader)
            if navigation_alias_key(claim.title) in keys
        ]
    except (ValueError, TypeError, KeyError, IndexError):
        return False
    if len(matches) != 1 or matches[0].pdf_page != page.number:
        return False
    key = navigation_alias_key(matches[0].title)
    windows = 0
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
        label = numbered_heading_layout(page, parts) if parts else None
        if parts and label and literal_fragment_map(page, candidate, owners, parts) is not None:
            windows += key in heading_title_window(page, candidate, owners, parts, label, policy)
    return windows == 1
