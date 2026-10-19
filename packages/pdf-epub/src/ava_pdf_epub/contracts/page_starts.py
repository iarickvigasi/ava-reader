"""Explicit source-page addresses; ordinary legacy identities keep their meaning."""

from typing import TYPE_CHECKING

from .links import Address

if TYPE_CHECKING:
    from .book import CanonicalBookV2

SOURCE_PAGE_PREFIX = "ava-source-page-"
SOURCE_PAGE_CAPABILITY = "source-page-starts"


def page_fragment(number: int) -> str:
    return SOURCE_PAGE_PREFIX + str(number)


def page_addresses(book: "CanonicalBookV2") -> dict[int, Address]:
    return {a.source_page: a for a in book.addresses if a.source_page is not None}
