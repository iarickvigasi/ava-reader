"""Recognize declared AVA content without treating portable provenance as server authority."""

import zipfile
import zlib

from PIL import Image

from ..contracts.book import CanonicalBookV2
from ..contracts.wire import decode_wire
from .archive import read_archive
from .export import PROFILE, SIDECAR, export_entries
from .paths import asset_path


def portable_epub(data: bytes) -> tuple[CanonicalBookV2, dict[str, bytes]]:
    # These operations consume bytes only; malformed ZIP/image errors are content refusals.
    # Runtime input snapshots and EPUBCheck infrastructure remain outside this boundary.
    try:
        entries = read_archive(data)
        if entries.get("META-INF/ava-profile") != PROFILE.encode() or SIDECAR not in entries:
            raise ValueError("Unsupported generated EPUB profile")
        book = CanonicalBookV2.model_validate(decode_wire(entries[SIDECAR]))
        assets = {r.id: entries.get("EPUB/" + asset_path(r), b"") for r in book.resources}
        if entries != export_entries(book, assets):
            raise ValueError("EPUB content/provenance conservation mismatch")
        return book, assets
    except (zipfile.BadZipFile, zlib.error, OSError, Image.DecompressionBombError):
        raise ValueError("Malformed generated EPUB bytes") from None
