"""Deterministic export of a validated canonical book, not publication authority."""

import io
import zipfile

from ..contracts.book import CanonicalBookV2
from ..contracts.page_starts import page_addresses
from .archive import MAX_ARCHIVE_BYTES, MAX_ENTRIES, MAX_ENTRY_BYTES
from .assets import MAX_EXPANDED_BYTES, validate_assets
from .chapters import chapter_documents
from .context import Context
from .navigation import navigation
from .package import package_document
from .profiles import LEGACY_PROFILE, PROFILES, SOURCE_PAGE_PROFILE, export_profile
from .styles import stylesheet

SIDECAR = "EPUB/ava-canonical.json"
CONTAINER = b"""<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="EPUB/package.opf"
media-type="application/oebps-package+xml"/></rootfiles></container>"""


def export_entries(
    book: CanonicalBookV2, assets: dict[str, bytes], *, profile: str | None = None
) -> dict[str, bytes]:
    book = CanonicalBookV2.model_validate(book.model_dump())
    profile = export_profile(book) if profile is None else profile
    if profile not in PROFILES:
        raise ValueError("Unsupported generated EPUB profile")
    if (profile == SOURCE_PAGE_PROFILE) != bool(page_addresses(book)):
        raise ValueError("Generated EPUB profile must match explicit source-page address semantics")
    ctx = Context(book, exact_source_pages=profile == SOURCE_PAGE_PROFILE)
    entries = {
        "mimetype": b"application/epub+zip",
        "META-INF/container.xml": CONTAINER,
        "META-INF/ava-profile": profile.encode(),
        SIDECAR: book.model_dump_json().encode(),
    }
    entries.update(validate_assets(book, assets))
    entries.update(chapter_documents(ctx, printed_page_labels=profile != LEGACY_PROFILE))
    entries["EPUB/nav/nav.xhtml"] = navigation(ctx, printed_page_labels=profile != LEGACY_PROFILE)
    entries["EPUB/styles/book.css"] = stylesheet(book.styles)
    entries["EPUB/package.opf"] = package_document(ctx, entries)
    if len(entries) > MAX_ENTRIES or any(len(data) > MAX_ENTRY_BYTES for data in entries.values()):
        raise ValueError("EPUB entry bound exceeded")
    if sum(len(data) for data in entries.values()) > MAX_EXPANDED_BYTES:
        raise ValueError("Expanded EPUB bound exceeded")
    return entries


def export_epub(book: CanonicalBookV2, assets: dict[str, bytes]) -> bytes:
    entries = export_entries(book, assets)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name in ["mimetype", *sorted(set(entries) - {"mimetype"})]:
            info = zipfile.ZipInfo(name, (2000, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_STORED if name == "mimetype" else zipfile.ZIP_DEFLATED
            archive.writestr(info, entries[name])
    data = buffer.getvalue()
    if len(data) > MAX_ARCHIVE_BYTES:
        raise ValueError("EPUB archive bound exceeded")
    return data
