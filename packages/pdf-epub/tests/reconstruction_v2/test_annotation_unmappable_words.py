"""An unmappable OCR token blocks its complete line, preserving unrelated lines."""

import unittest
from dataclasses import replace

from ava_pdf_epub.reconstruction_v2.annotation_words import (
    ERROR,
    exact_word_offsets,
    parse_words,
)
from ava_pdf_epub.reconstruction_v2.pdf_scanned_ranges import scanned_ranges

from .test_annotation_words import page, row, tsv
from .test_pdf_links import box, segment


class AnnotationUnmappableWordsTests(unittest.TestCase):
    def test_bad_token_retains_identity_geometry_and_text_without_poisoning_other_line(self):
        words = parse_words(tsv(row("Source"), row("two words", 1, line_num=2, top=100)), page())
        self.assertEqual("two words", words[1].text)
        self.assertFalse(words[1].mappable)
        self.assertEqual((1, 1, 2), words[1].line)
        self.assertEqual(1, words[1].ordinal)
        self.assertEqual(96.5, words[1].confidence)
        self.assertEqual(50, words[1].box.y0)
        owner = segment("owner", "Source").model_copy(update={"box": box(10, 20, 60, 35)})
        before = owner.model_dump_json(), tuple(words)
        self.assertEqual([("owner", 0, 6)], scanned_ranges([owner], owner.box, words))
        self.assertEqual(before, (owner.model_dump_json(), tuple(words)))
        with self.assertRaisesRegex(ValueError, "TEXT_MAPPING"):
            scanned_ranges([owner], words[1].box, words)

    def test_invalid_token_anywhere_in_complete_selected_line_prevents_partial_uniqueness(self):
        words = parse_words(tsv(row("Source"), row("two words", 2, left=200)), page())
        owner = segment("owner", "Source").model_copy(update={"box": box(0, 0, 300, 100)})
        with self.assertRaisesRegex(ValueError, ERROR):
            exact_word_offsets("Source two words", words)
        with self.assertRaisesRegex(ValueError, "TEXT_MAPPING"):
            scanned_ranges([owner], words[0].box, words)
        with self.assertRaisesRegex(ValueError, ERROR):
            exact_word_offsets("Source", [replace(words[0], mappable=False)])
