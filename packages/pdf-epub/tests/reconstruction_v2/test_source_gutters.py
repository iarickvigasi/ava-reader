"""Repeated source rows, independent of accepted boxes, veto an inter-column owner."""

import unittest

from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.ocr_glyph_map import prove_glyph_map

from .test_ocr_link_context import line
from .test_pdf_links import box, observation
from .test_refinement_grouping import segment


class SourceGutterTests(unittest.TestCase):
    def test_three_paired_rows_veto_a_spanning_middle_entry(self):
        rows = [
            value
            for i, y in enumerate((20, 40, 60))
            for value in (line(f"left{i}", "AB", 0, y), line(f"right{i}", "CD", 12, y))
        ]
        page = observation().model_copy(update={"lines": rows})
        both = segment("both", "AB CD").model_copy(update={"box": box(0, 40, 20, 50)})
        self.assertIsNone(prove_glyph_map(page, both, [both], POLICY))
        left = segment("left", "AB").model_copy(update={"box": box(0, 40, 8, 50)})
        right = segment("right", "CD").model_copy(update={"box": box(12, 40, 20, 50)})
        for owner in (left, right):
            self.assertIsNotNone(prove_glyph_map(page, owner, [left, right], POLICY))

    def test_a_spanning_title_outside_the_source_column_band_stays_eligible(self):
        rows = [
            value
            for i, y in enumerate((30, 50, 70))
            for value in (line(f"left{i}", "AB", 0, y), line(f"right{i}", "CD", 12, y))
        ]
        title = line("title", "ABCD", 0, 0)
        page = observation().model_copy(update={"lines": [title, *rows]})
        owner = segment("title", "ABCD").model_copy(update={"box": title.box})
        self.assertIsNotNone(prove_glyph_map(page, owner, [owner], POLICY))

    def test_aligned_word_spaces_inside_single_source_lines_are_not_column_witnesses(self):
        rows = [line(f"row{i}", "AB CD", 0, y) for i, y in enumerate((20, 40, 60))]
        page = observation().model_copy(update={"lines": rows})
        owner = segment("middle", "AB CD").model_copy(update={"box": rows[1].box})
        self.assertIsNotNone(prove_glyph_map(page, owner, [owner], POLICY))
