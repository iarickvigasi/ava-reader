"""Offsets are Unicode codepoints; whole glyph units never split ligatures or marks."""

import unittest

from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.ocr_glyph_map import prove_glyph_map
from ava_pdf_epub.reconstruction_v2.ocr_glyph_ranges import ocr_glyph_ranges

from .test_ocr_link_context import line
from .test_pdf_links import box, observation
from .test_refinement_grouping import segment


class OcrGlyphUnicodeTests(unittest.TestCase):
    def test_non_bmp_decomposed_and_repeated_letters_keep_python_offsets(self):
        native = line("unicode", "A😀BééAA", 0, 20)
        page = observation().model_copy(update={"lines": [native]})
        item = segment("unicode", "A 😀 B é é A A").model_copy(update={"box": native.box})
        self.assertIsNotNone(prove_glyph_map(page, item, [item], POLICY))
        self.assertEqual(
            [("unicode", 2, 3)], ocr_glyph_ranges(page, [item], box(4, 20, 8, 30), POLICY)
        )
        self.assertEqual(
            [("unicode", 11, 14)], ocr_glyph_ranges(page, [item], box(24, 20, 32, 30), POLICY)
        )
        normalized = item.model_copy(update={"text": item.text.replace("é", "é")})
        self.assertIsNone(prove_glyph_map(page, normalized, [normalized], POLICY))

    def test_multi_codepoint_glyph_is_one_physical_unit(self):
        native = line("ligature", "fix", 0, 20)
        glyph = native.glyphs[0].model_copy(update={"text": "fi", "box": box(0, 20, 8, 30)})
        native = native.model_copy(update={"glyphs": [glyph, native.glyphs[2]]})
        page = observation().model_copy(update={"lines": [native]})
        item = segment("ligature", " fi x ").model_copy(update={"box": native.box})
        self.assertEqual(
            [("ligature", 1, 3)], ocr_glyph_ranges(page, [item], box(0, 20, 8, 30), POLICY)
        )
        self.assertIsNone(ocr_glyph_ranges(page, [item], box(0, 20, 4, 30), POLICY))
        spaced = item.model_copy(update={"text": "f i x"})
        self.assertIsNone(prove_glyph_map(page, spaced, [spaced], POLICY))

    def test_ranges_never_bridge_an_unselected_letter(self):
        lines = [line("first", "AB", 0, 20), line("second", "CD", 0, 40)]
        page = observation().model_copy(update={"lines": lines})
        item = segment("entry", "A B\nC D").model_copy(update={"box": box(0, 20, 8, 50)})
        self.assertEqual(
            [("entry", 0, 1), ("entry", 4, 5)],
            ocr_glyph_ranges(page, [item], box(0, 20, 4, 50), POLICY),
        )
