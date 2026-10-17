"""The genuine mixed prose/code page keeps the same point-size ratios as other native pages."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct

FIXTURES = Path(__file__).parent / "fixtures"


class NativeDocumentSizeBoundary(unittest.TestCase):
    def test_genuine_point_sizes_rebase_without_changing_graph_text_or_inline_ratios(self):
        source = FIXTURES / "native.pdf"
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            pages = [prepare_page(source, scratch, number) for number in range(1, 9)]
            self.assertFalse(any(page.tasks for page in pages))
            result = reconstruct(source, scratch, pages, [])
            with patch(
                "ava_pdf_epub.reconstruction_v2.reconstruct.apply_native_sizes",
            ):
                previous = reconstruct(source, scratch, pages, [])
        styles = {s.id: s for s in result.book.styles}
        before_styles = {s.id: s for s in previous.book.styles}
        blocks = {b.id: b for b in result.book.blocks}
        expected = {"p6-line1": 18 / 11, "p6-line2": 10 / 11, "p6-line5": 1, "p6-line6": 1}
        for ident, ratio in expected.items():
            self.assertAlmostEqual(ratio, styles[blocks[ident].style_id].relative_size)
        for old, new in zip(previous.book.blocks, result.book.blocks, strict=True):
            self.assertEqual(
                old.model_dump(exclude={"style_id"}), new.model_dump(exclude={"style_id"})
            )
            if old.style_id and new.style_id:
                self.assertEqual(
                    before_styles[old.style_id].model_dump(exclude={"id", "relative_size"}),
                    styles[new.style_id].model_dump(exclude={"id", "relative_size"}),
                )
        self.assertEqual(
            previous.book.model_dump(exclude={"blocks", "styles"}),
            result.book.model_dump(exclude={"blocks", "styles"}),
        )
        self.assertTrue(
            any(f.code == "NATIVE_DOCUMENT_SIZE_REFERENCE" for f in result.structure_findings)
        )
        imported, assets = portable_epub(result.epub)
        self.assertEqual(result.book, imported)
        self.assertEqual(result.assets, assets)
