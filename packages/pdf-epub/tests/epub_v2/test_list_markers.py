import io
import unittest
import xml.etree.ElementTree as ET
import zipfile

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.epub_v2.export import export_epub
from ava_pdf_epub.epub_v2.reimport import reimport_epub

from .helpers import fixture


class ListMarkerExportTests(unittest.TestCase):
    def test_explicit_letters_and_roman_markers_survive_visible_epub_and_reimport(self):
        original, assets, _ = fixture()
        for marker in ["decimal", "lower-alpha", "upper-alpha", "lower-roman", "upper-roman"]:
            raw = original.model_dump()
            ordered = next(group for group in raw["lists"] if group["ordered"])
            ordered["marker_style"] = marker
            book = CanonicalBookV2.model_validate(raw)
            data = export_epub(book, assets)
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                roots = [
                    ET.fromstring(archive.read(path))
                    for path in archive.namelist()
                    if path.startswith("EPUB/text/")
                ]
            node = next(
                node
                for root in roots
                for node in root.iter()
                if node.get("data-ava-list") == ordered["id"]
            )
            self.assertEqual(node.get("style"), "list-style-type:" + marker)
            self.assertEqual(node.get("start"), str(ordered["start"]))
            self.assertEqual(reimport_epub(data, document_digest(book)), book)
