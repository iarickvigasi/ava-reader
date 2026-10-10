"""Whitespace spacing must not fail the entire native page or invent an emphasized word."""

import unittest
from pathlib import Path
from statistics import StatisticsError
from unittest.mock import patch

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.geometry import rectangle
from ava_pdf_epub.reconstruction_v2.line_spans import line_spans
from ava_pdf_epub.reconstruction_v2.observations import Glyph, NativeLine
from ava_pdf_epub.reconstruction_v2.route_native import route_native


class WhitespaceSpans(unittest.TestCase):
    def test_low_size_whitespace_has_no_word_style_and_keeps_exact_source_text(self):
        box = rectangle((10, 10, 20, 16), 100, 100)
        line = NativeLine(
            id="space",
            box=box,
            text="   ",
            style=Style(id="style"),
            glyphs=[Glyph(text=" ", box=box, font="Times", size=6, visible=True)],
        )
        self.assertEqual([], line_spans(line))
        self.assertEqual("   ", line.text)

    def test_empty_line_has_no_invented_baseline(self):
        line = NativeLine(
            id="empty",
            box=rectangle((10, 10, 20, 16), 100, 100),
            text="",
            glyphs=[],
            style=Style(id="style"),
        )
        self.assertEqual([], line_spans(line))

    def test_programming_error_does_not_authorize_paid_structure_repair(self):
        with (
            patch(
                "ava_pdf_epub.reconstruction_v2.route_native.native_page",
                side_effect=StatisticsError("no median for empty data"),
            ),
            patch("ava_pdf_epub.reconstruction_v2.route_native.make_task") as task,
        ):
            with self.assertRaises(StatisticsError):
                route_native(None, [], [], "0" * 64, Path("/unused"))
            task.assert_not_called()
