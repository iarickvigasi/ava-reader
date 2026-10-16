"""Version visible projections without changing accepted books or legacy EPUB bytes."""

from ..contracts.blocks import ListItemBlock
from ..contracts.book import CanonicalBookV2
from ..contracts.page_starts import page_addresses
from .intrinsic_script import needs_script_projection
from .sections import publication_parts

LEGACY_PROFILE = "ava-epub-canonical-2.1"
PAGE_LABEL_PROFILE = "ava-epub-canonical-2.2"
SOURCE_PAGE_PROFILE = "ava-epub-canonical-2.3"
SECTION_FILE_PROFILE = "ava-epub-canonical-2.4"
LIST_BODY_PROFILE = "ava-epub-canonical-2.5"
LITERAL_LABEL_PROFILE = "ava-epub-canonical-2.6"
INTRINSIC_SCRIPT_PROFILE = "ava-epub-canonical-2.7"
PROFILES = (
    INTRINSIC_SCRIPT_PROFILE,
    LITERAL_LABEL_PROFILE,
    LEGACY_PROFILE,
    PAGE_LABEL_PROFILE,
    SOURCE_PAGE_PROFILE,
    SECTION_FILE_PROFILE,
    LIST_BODY_PROFILE,
)


def export_profile(book: CanonicalBookV2, *, split_sections: bool = True) -> str:
    if split_sections and needs_script_projection(book):
        return INTRINSIC_SCRIPT_PROFILE
    if any(isinstance(b, ListItemBlock) and b.literal_label is not None for b in book.blocks):
        return LITERAL_LABEL_PROFILE
    if split_sections:
        styles = {s.id: s for s in book.styles}
        for block in book.blocks:
            style = styles.get(block.style_id or "")
            if (
                isinstance(block, ListItemBlock)
                and style is not None
                and (style.indent_em or style.block_indent_em)
            ):
                return LIST_BODY_PROFILE
    if split_sections and len(publication_parts(book, split_sections=True)) > len(book.chapters):
        return SECTION_FILE_PROFILE
    if page_addresses(book):
        return SOURCE_PAGE_PROFILE
    return PAGE_LABEL_PROFILE if any(p.label is not None for p in book.pages) else LEGACY_PROFILE


def validate_profile(book: CanonicalBookV2, profile: str) -> bool:
    """Return source-page semantics only for a supported, compatible projection."""
    if profile not in PROFILES:
        raise ValueError("Unsupported generated EPUB profile")
    if any(isinstance(b, ListItemBlock) and b.literal_label is not None for b in book.blocks):
        if profile not in {LITERAL_LABEL_PROFILE, INTRINSIC_SCRIPT_PROFILE}:
            raise ValueError("Literal label columns require their generated EPUB projection")
    exact_pages = bool(page_addresses(book))
    if (
        profile
        not in {
            SECTION_FILE_PROFILE,
            LIST_BODY_PROFILE,
            LITERAL_LABEL_PROFILE,
            INTRINSIC_SCRIPT_PROFILE,
        }
        and (profile == SOURCE_PAGE_PROFILE) != exact_pages
    ):
        raise ValueError("Generated EPUB profile must match explicit source-page address semantics")
    return exact_pages
