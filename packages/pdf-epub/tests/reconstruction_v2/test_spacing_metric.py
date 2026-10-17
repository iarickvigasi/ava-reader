"""Metrics come from the selected resource, not a BaseFont-name shortcut."""

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2.spacing_metric import spacing_metric


class Font:
    cid2unicode = {32: " ", 65: "A"}
    widths = {32: 250, 65: 600}

    def to_unichr(self, cid):
        return self.cid2unicode[cid]

    def char_width(self, cid):
        return self.widths[cid] * 0.001


def state(**changes):
    return SimpleNamespace(
        **{
            "font": Font(),
            "wordspace": 0,
            "charspace": -0.0001,
            "rise": 0,
            "render": 0,
            "scaling": 80,
            "fontsize": 2,
            **changes,
        }
    )


class SpacingMetricTests(unittest.TestCase):
    @patch("ava_pdf_epub.reconstruction_v2.spacing_metric.PDFType1Font", Font)
    def test_effective_horizontal_scale_and_tc_are_not_multiplied_twice(self):
        s = state()
        m = spacing_metric(s, SimpleNamespace(matrix=(5, 0, 0, 7, 10, 20)))
        self.assertEqual(m.resource, id(s.font))
        self.assertAlmostEqual(m.space, 2)
        self.assertAlmostEqual(m.em, 8)
        self.assertAlmostEqual(m.character_spacing, -0.0004)

    @patch("ava_pdf_epub.reconstruction_v2.spacing_metric.PDFType1Font", Font)
    def test_unsafe_state_and_unknown_space_refuse(self):
        for changes in [
            {"wordspace": 1},
            {"rise": 1},
            {"render": 3},
            {"scaling": 0},
            {"fontsize": float("nan")},
            {"charspace": float("inf")},
        ]:
            self.assertIsNone(
                spacing_metric(state(**changes), SimpleNamespace(matrix=(1, 0, 0, 1, 0, 0)))
            )
        for matrix in [(1, 1, 0, 1, 0, 0), (-1, 0, 0, 1, 0, 0), (1, 0, 0, -1, 0, 0)]:
            self.assertIsNone(spacing_metric(state(), SimpleNamespace(matrix=matrix)))
        s = state()
        s.font.widths = {65: 600}
        self.assertIsNone(spacing_metric(s, SimpleNamespace(matrix=(1, 0, 0, 1, 0, 0))))

    @patch("ava_pdf_epub.reconstruction_v2.spacing_metric.PDFType1Font", Font)
    def test_ambiguous_encoding_refuses(self):
        s = state()
        s.font.cid2unicode = {32: " ", 33: " "}
        s.font.widths = {32: 250, 33: 250}
        self.assertIsNone(spacing_metric(s, SimpleNamespace(matrix=(1, 0, 0, 1, 0, 0))))

    @patch("ava_pdf_epub.reconstruction_v2.spacing_metric.PDFType1Font", Font)
    def test_to_unicode_cannot_relabel_a_punctuation_advance_as_space(self):
        for decoded in [{32: "X", 33: " "}, {32: " ", 33: " "}]:
            s = state()
            s.font.cid2unicode = {32: " ", 33: "!"}
            s.font.widths = {32: 250, 33: 100}
            s.font.to_unichr = lambda cid, values=decoded: values[cid]
            self.assertIsNone(spacing_metric(s, SimpleNamespace(matrix=(1, 0, 0, 1, 0, 0))))
