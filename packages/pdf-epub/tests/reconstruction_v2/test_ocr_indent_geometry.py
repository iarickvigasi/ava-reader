"""Actual authored pixels qualify flush starts; unknown is never a global zero default."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.ocr_indents import recover_ocr_indents

from .pixel_indent_fixture import pixel_page


class OcrIndentGeometry(unittest.TestCase):
    def recover(self, groups, placements=None):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            page, segments = pixel_page(scratch / "render.png", groups)
            state = AssemblyState(
                placements=placements or {s.id: (1, i, 0) for i, s in enumerate(segments)}
            )
            return recover_ocr_indents(segments, [page], scratch, state)

    def test_complete_multiline_flush_is_zero_and_single_line_is_unknown(self):
        values = self.recover([("many", [(40, 30), (40, 55)], None), ("lone", [(75, 130)], None)])
        self.assertEqual(0, values[0].style.indent_em)
        self.assertIsNone(values[1].style)

    def test_independent_neighbour_can_qualify_single_line(self):
        values = self.recover([("body", [(40, 30), (40, 55)], None), ("one", [(40, 130)], None)])
        self.assertEqual(0, values[1].style.indent_em)

    def test_hanging_positive_inset_and_inconsistent_pixels_stay_unknown(self):
        for starts in ([60, 40], [40, 60], [40, 60, 80]):
            with self.subTest(starts=starts):
                value = self.recover(
                    [("unknown", [(x, 30 + i * 25) for i, x in enumerate(starts)], None)]
                )[0]
                self.assertIsNone(value.style)

    def test_explicit_zero_negative_and_false_remain_observations(self):
        for indent in (0, -1, 2):
            style = Style(id="explicit", indent_em=indent, italic=False)
            value = self.recover([("source", [(40, 30), (40, 55)], style)])[0]
            self.assertEqual(style, value.style)

    def test_column_and_full_width_band_context_cannot_certify_another_margin(self):
        groups = [("body", [(40, 30), (40, 55)], None), ("one", [(40, 130)], None)]
        for placements in (
            {"body": (1, 0, 1), "one": (1, 0, 2)},
            {"body": (1, 0, 1), "one": (1, 1, 0)},
            {"body": (1, 0, 1), "one": (1, 1, 1)},
        ):
            value = self.recover(groups, placements)[1]
            self.assertIsNone(value.style)
