"""Finite candidates preserve historical and Unicode/text authority."""

import unittest

from ava_pdf_epub.reconstruction_v2.recognition_anchor_candidates import allowed_quotations
from ava_pdf_epub.reconstruction_v2.small_caps_quote_candidates import small_caps_quotations


class SmallCapsCandidates(unittest.TestCase):
    def test_explicit_ascii_case_alternative_only(self):
        span = {"anchor": {"exact_text": "bc"}, "style": {"small_caps": True}}
        self.assertEqual([], allowed_quotations("A BC item", span))
        self.assertEqual(["BC"], small_caps_quotations("A BC item", span))
        for style in [{}, {"small_caps": False}, {"small_caps": "true"}]:
            with self.subTest(style=style):
                self.assertEqual([], small_caps_quotations("BC", {**span, "style": style}))

    def test_no_partial_word_unicode_casefold_or_existing_literal_override(self):
        span = {"anchor": {"exact_text": "bc"}, "style": {"small_caps": True}}
        for text in ["ABCD", "BCé", "BC_", "BĆ", "BC\u200d", "іBC", "BC2"]:
            with self.subTest(text=text):
                self.assertEqual([], small_caps_quotations(text, span))
        self.assertEqual(["bc"], small_caps_quotations("bc then BC", span))
        for quote, text in [
            ("ß", "SS"),
            ("ı", "I"),
            ("bс", "BC"),
            ("Bc", "BC"),
            ("x" * 17, "X" * 17),
        ]:
            with self.subTest(quote=quote):
                self.assertEqual(
                    [], small_caps_quotations(text, {**span, "anchor": {"exact_text": quote}})
                )
