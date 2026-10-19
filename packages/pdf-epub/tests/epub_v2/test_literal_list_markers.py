"""Word labels remain actual styled text in portable ordered lists, never hidden counters."""

import io
import unittest
import zipfile

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.contracts.capabilities import required_capabilities
from ava_pdf_epub.epub_v2.export import export_epub
from ava_pdf_epub.epub_v2.portable import portable_epub

from .helpers import archive_bytes, fixture


class LiteralListMarkersTests(unittest.TestCase):
    def test_export_reimport_keeps_labels_text_positions_and_nested_list(self):
        original, assets, _ = fixture()
        raw = original.model_dump()
        raw["lists"][0].update(marker_style="none", start=1)
        book = CanonicalBookV2.model_validate(raw)
        data = export_epub(book, assets)
        returned, _ = portable_epub(data)
        self.assertEqual(returned, book)
        self.assertIn("literal-list-markers", required_capabilities(book))
        self.assertNotIn("literal-list-markers", required_capabilities(original))
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = {n: archive.read(n) for n in archive.namelist()}
        path = next(
            n for n, v in entries.items() if n.endswith(".xhtml") and b"list-style-type:none" in v
        )
        self.assertIn(b"First recorded task", entries[path])
        self.assertIn(b"Second recorded task", entries[path])
        for old, new in (
            (b"list-style-type:none", b"list-style-type:decimal"),
            (b"First recorded task", b"Altered recorded task"),
        ):
            corrupted = {**entries, path: entries[path].replace(old, new)}
            with self.assertRaisesRegex(ValueError, "conservation"):
                portable_epub(archive_bytes(corrupted))
