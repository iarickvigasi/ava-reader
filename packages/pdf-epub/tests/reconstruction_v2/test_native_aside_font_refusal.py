"""Incomplete or ambiguous typography stays unknown without replacing native text or its role."""

import unittest

from ava_pdf_epub.reconstruction_v2.native_graphics import native_graphics

from .aside_font_fixture import TEXT, box, line, page


class NativeAsideFontRefusal(unittest.TestCase):
    def assert_unknown(self, source):
        item = native_graphics(page([source]), [])[0]
        self.assertEqual(("aside", "native", source.text), (item.kind, item.method, item.text))
        self.assertEqual([source.id], item.native_line_ids)
        self.assertIsNone(item.style)
        self.assertEqual([], item.spans)

    def test_unknown_font_including_a_single_unknown_glyph_prevents_complete_claim(self):
        self.assert_unknown(line(parts=[(TEXT, "UnlistedTypeface")]))
        self.assert_unknown(line(parts=[(TEXT[:-1], "ArialMT"), (".", "UnlistedTypeface")]))

    def test_hidden_outside_and_duplicate_glyphs_prevent_complete_claim(self):
        source = line()
        first = source.glyphs[0]
        for changes in [{"visible": False}, {"box": box(1, 1, 5, 5)}]:
            self.assert_unknown(
                source.model_copy(
                    update={"glyphs": [first.model_copy(update=changes), *source.glyphs[1:]]}
                )
            )
        self.assert_unknown(source.model_copy(update={"glyphs": [first, *source.glyphs]}))

    def test_partial_region_overlap_does_not_borrow_font_from_outside_its_bound(self):
        self.assert_unknown(line().model_copy(update={"box": box(10, 30, 300, 41)}))

    def test_unclaimed_prefix_middle_suffix_and_wrong_order_are_not_full_coverage(self):
        source = line()
        for text in ["X" + TEXT, TEXT[:5] + "X" + TEXT[5:], TEXT + "X"]:
            self.assert_unknown(source.model_copy(update={"text": text}))
        self.assert_unknown(source.model_copy(update={"glyphs": source.glyphs[::-1]}))
        self.assert_unknown(source.model_copy(update={"glyphs": []}))

    def test_unobserved_whitespace_keeps_exact_text_but_has_no_complete_font_claim(self):
        source = line()
        for gap in [" ", "\t", "\n"]:
            for text in [gap + TEXT, TEXT[:5] + gap + TEXT[5:], TEXT + gap]:
                self.assert_unknown(source.model_copy(update={"text": text}))

    def test_page_visibility_risk_remains_unqualified(self):
        observed = page([line()]).model_copy(update={"risks": ["conditional_visibility"]})
        item = native_graphics(observed, [])[0]
        self.assertIsNone(item.style)
        self.assertEqual([], item.spans)
