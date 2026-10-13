"""A qualified cover exports every page pixel without altering selectable content."""

import io
import tempfile
import unittest
import zipfile
from pathlib import Path

import pdfplumber
from PIL import Image
from pypdf import PdfReader

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.epub_v2.export import export_entries, export_epub
from ava_pdf_epub.epub_v2.paths import asset_path
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.observe_page import observe_page
from ava_pdf_epub.reconstruction_v2.source_cover import preserve_source_cover
from tests.epub_v2.helpers import fixture

from .cover_pixels_fixture import TITLE, authored_cover
from .test_ocr_font_faces import checkpoint


class SourceCoverPixels(unittest.TestCase):
    def test_complete_source_page_pixels_survive_canonical_and_epub_export(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            path = scratch / "cover.pdf"
            authored_cover(path)
            with pdfplumber.open(path) as pdf:
                page = observe_page(path, PdfReader(path), pdf.pages[0], 1, scratch)
            self.assertEqual([TITLE], [line.text for line in page.lines])
            self.assertEqual(2, sum(g.kind == "image" for g in page.graphics))
            self.assertEqual(
                (1, 1, 599, 760),
                tuple(page.graphics[0].box.model_dump()[k] for k in ("x0", "y0", "x1", "y1")),
            )
            baseline, assets, _ = fixture()
            raw = baseline.model_dump(mode="json")
            state = AssemblyState()
            metadata = [
                {
                    "field": "title",
                    "status": "accepted",
                    "evidence": [{"page": 1, "box": page.lines[0].box.model_dump()}],
                }
            ]
            cover = preserve_source_cover(
                [checkpoint(page)],
                raw["pages"],
                [{"role": "frontmatter"}],
                metadata,
                scratch,
                state,
            )
            self.assertIsNotNone(cover)
            self.assertEqual([], state.blocks)
            raw["resources"].extend(state.resources)
            raw["cover_resource_id"] = cover
            book = CanonicalBookV2.model_validate(raw)
            self.assertEqual(baseline.blocks, book.blocks)
            self.assertEqual(baseline.metadata, book.metadata)
            self.assertEqual(baseline.pages[0].regions, book.pages[0].regions[:-1])
            resource = next(r for r in book.resources if r.id == cover)
            self.assertEqual("cover", book.pages[0].regions[-1].role)
            data = export_epub(book, {**assets, **state.assets})
            imported, restored_assets = portable_epub(data)
            self.assertEqual(book, imported)
            self.assertEqual(baseline.blocks, imported.blocks)
            self.assertEqual(state.assets[cover], restored_assets[cover])
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                actual_bytes = archive.read("EPUB/" + asset_path(resource))
                baseline_entries = export_entries(baseline, assets)
                for name, expected in baseline_entries.items():
                    if name.startswith("EPUB/text/") and name.endswith(".xhtml"):
                        self.assertEqual(expected, archive.read(name))
                self.assertIn(b'properties="cover-image"', archive.read("EPUB/package.opf"))
            with Image.open(scratch / page.render_path) as source:
                with Image.open(io.BytesIO(actual_bytes)) as actual:
                    self.assertEqual((1800, 2400), actual.size)
                    self.assertEqual(source.size, actual.size)
                    self.assertEqual(source.tobytes(), actual.tobytes())
                    for point in ((0, 0), (1799, 0), (0, 2399), (1799, 2399)):
                        self.assertEqual((255, 0, 0), actual.getpixel(point))
                    self.assertEqual((69, 171, 35), actual.getpixel((900, 2350)))
            self.assertEqual(
                (0, 0, 600, 800),
                tuple(resource.evidence[0].box.model_dump()[k] for k in ("x0", "y0", "x1", "y1")),
            )
