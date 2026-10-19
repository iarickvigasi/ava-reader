"""Exact complete lines, ambiguity and geometry conserve the original cell content."""

import unittest

from ava_pdf_epub.reconstruction_v2.cell_ocr_match import match_cell_ocr
from ava_pdf_epub.reconstruction_v2.cell_ocr_words import cell_ocr_words

from .cell_ocr_fixture import ocr_fixture, target, tsv


class CellOcrMatchTests(unittest.TestCase):
    def match(self, rows, text="Target", second=False):
        _, task = ocr_fixture(text, second)
        return match_cell_ocr(task, cell_ocr_words(tsv(rows), 1000, 1000))

    def test_exact_complete_line_has_source_derived_box(self):
        patches = self.match([target()])
        self.assertIsNotNone(patches)
        self.assertEqual(
            dict(coordinate_space="render_normalized_1000", x0=20, y0=20, x1=80, y1=40),
            patches[0]["box"],
        )

    def test_quotes_and_unicode_are_literal_and_never_normalized(self):
        for text in ('"Target"', "Книга", "A😀B"):
            with self.subTest(text=text):
                self.assertIsNotNone(self.match([target(text=text)], text))
        self.assertIsNone(self.match([target(text="café")], "café"))
        self.assertIsNone(self.match([target(text="Target")], "target"))

    def test_weak_duplicate_still_makes_the_match_ambiguous(self):
        self.assertIsNone(self.match([target(), (2, 1, 1, 20, 300, 60, 20, 20, "Target")]))

    def test_partial_line_extra_word_cannot_be_silently_dropped(self):
        self.assertIsNone(self.match([target(), (1, 1, 2, 90, 20, 20, 20, 97, "Extra")]))

    def test_empty_multiline_doubled_space_and_partial_text_are_unproved(self):
        for text in ("", "Target\nNext", "Target  Next", "Target ", "Target\u00a0Next"):
            with self.subTest(text=text):
                self.assertIsNone(self.match([target()], text))

    def test_low_confidence_and_gapped_ordinals_are_unproved(self):
        self.assertIsNone(self.match([target(94.99)]))
        self.assertIsNotNone(self.match([target(95)]))
        self.assertIsNone(self.match([(1, 1, 2, 20, 20, 60, 20, 97, "Target")]))

    def test_neighboring_word_or_cell_ownership_cannot_be_included(self):
        self.assertIsNone(self.match([target(), (2, 1, 1, 40, 25, 10, 10, 97, "Noise")]))
        self.assertIsNone(self.match([(1, 1, 1, 120, 20, 60, 20, 97, "Target")]))

    def test_all_requested_cells_must_be_proved_atomically(self):
        rows = [target(), (2, 1, 1, 120, 20, 60, 20, 97, "Other")]
        self.assertEqual(2, len(self.match(rows, second=True)))
        self.assertIsNone(self.match(rows[:1], second=True))
        rows[1] = (2, 1, 1, 120, 20, 60, 20, 50, "Other")
        self.assertIsNone(self.match(rows, second=True))
