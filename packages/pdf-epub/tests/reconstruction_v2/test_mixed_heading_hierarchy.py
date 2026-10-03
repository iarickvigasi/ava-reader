"""A declared OCR section remains an ancestor when the next heading uses native glyphs."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.heading_hierarchy import heading_hierarchy
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page

FIXTURES = Path(__file__).parent / "fixtures"


class MixedHeadingHierarchyTest(unittest.TestCase):
    def test_native_child_retains_corroborated_ocr_parent_and_ambiguous_size_refuses(self):
        with tempfile.TemporaryDirectory() as directory:
            page = prepare_page(FIXTURES / "native.pdf", Path(directory), 1)
        chapter = next(s for s in page.native_segments if s.chapter_start)
        section = next(
            s
            for s in page.native_segments
            if s.kind == "heading" and not s.chapter_start and s.text == "A closer look"
        )
        ocr = section.model_copy(
            update={"id": "ocr-parent", "method": "ocr", "native_line_ids": [], "heading_level": 2}
        )
        child = section.model_copy(update={"id": "native-child", "heading_level": 3})
        actual = heading_hierarchy([chapter, ocr, child], [page], {ocr.id, child.id})
        self.assertEqual([1, 2, 3], [s.heading_level for s in actual])
        with self.assertRaisesRegex(ValueError, "requires source corroboration"):
            heading_hierarchy([chapter, ocr, child], [page], {ocr.id})


if __name__ == "__main__":
    unittest.main()
