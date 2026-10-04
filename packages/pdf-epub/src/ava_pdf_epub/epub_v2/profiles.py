"""Version visible projections without changing accepted books or legacy EPUB bytes."""

from ..contracts.book import CanonicalBookV2

LEGACY_PROFILE = "ava-epub-canonical-2.1"
PAGE_LABEL_PROFILE = "ava-epub-canonical-2.2"
PROFILES = (LEGACY_PROFILE, PAGE_LABEL_PROFILE)


def export_profile(book: CanonicalBookV2) -> str:
    return PAGE_LABEL_PROFILE if any(p.label is not None for p in book.pages) else LEGACY_PROFILE
