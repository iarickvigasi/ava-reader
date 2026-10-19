"""Invalid OCR words cannot disappear when a complete line crosses table cells."""

import unittest
from dataclasses import replace

from ava_pdf_epub.reconstruction_v2.annotation_scan_spans import scanned_marks
from ava_pdf_epub.reconstruction_v2.annotation_words import ERROR

from .test_annotation_scan_spans import observation, source
from .test_annotation_table_spans import table


class AnnotationLineBlockerTests(unittest.TestCase):
    def test_unmappable_neighbor_in_other_cell_still_blocks_selected_complete_line(self):
        region, words, image, _ = source()
        self.addCleanup(image.close)
        self.assertTrue(scanned_marks(observation(region), [table()], region, words, image))
        words[-1] = replace(words[-1], text="two words", mappable=False)
        with self.assertRaisesRegex(ValueError, ERROR):
            scanned_marks(observation(region), [table()], region, words, image)
