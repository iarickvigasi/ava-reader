"""Declared-profile reimport also verifies an independently expected content identity."""

from ..contracts.book import CanonicalBookV2
from ..contracts.common import document_digest
from .portable import portable_epub


def reimport_epub(data: bytes, expected_canonical_sha256: str) -> CanonicalBookV2:
    book, _ = portable_epub(data)
    if document_digest(book) != expected_canonical_sha256:
        raise ValueError("Canonical identity does not match expected candidate")
    return book
