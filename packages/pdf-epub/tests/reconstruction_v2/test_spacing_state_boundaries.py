"""Independent-review adversaries for TJ tracking and vertical-state changes."""

import unittest

from ava_pdf_epub.reconstruction_v2.spacing_capture import glyph_metric_key
from ava_pdf_epub.reconstruction_v2.spacing_line import qualify_line_spaces
from ava_pdf_epub.reconstruction_v2.spacing_metric import SpacingMetric

from .spacing_fixture import spacing_fixture


class SpacingStateBoundaryTests(unittest.TestCase):
    def test_tj_tracking_cannot_use_untracked_prefix_as_calibration(self):
        text = "ordinary prose words TRACKED"
        line, _ = spacing_fixture(gap=0, text=text)
        start = text.index("TRACKED")
        glyphs = []
        for index, glyph in enumerate(line.glyphs):
            delta = max(0, index - start) * 1.7
            glyphs.append(
                glyph.model_copy(
                    update={
                        "box": glyph.box.model_copy(
                            update={
                                "x0": glyph.box.x0 + delta,
                                "x1": glyph.box.x1 + delta,
                            }
                        )
                    }
                )
            )
        line = line.model_copy(update={"glyphs": glyphs})
        metrics = {glyph_metric_key(g): SpacingMetric(1, 2.5, 10, 0) for g in glyphs}
        result, unresolved = qualify_line_spaces(
            line, "ordinary prose words T R A C K E D", metrics
        )
        self.assertEqual(result, line)
        self.assertTrue(unresolved)

    def test_same_baseline_with_different_size_is_not_the_same_state(self):
        line, metrics = spacing_fixture()
        glyphs = list(line.glyphs)
        glyphs[5] = glyphs[5].model_copy(update={"size": 6})
        metrics[glyph_metric_key(glyphs[5])] = SpacingMetric(1, 2.5, 10, 0)
        line = line.model_copy(update={"glyphs": glyphs})
        result, unresolved = qualify_line_spaces(
            line, "Alpha Beta continues ordinary prose words", metrics
        )
        self.assertEqual(result, line)
        self.assertTrue(unresolved)

    def test_equal_horizontal_advance_does_not_equal_vertical_state(self):
        line, metrics = spacing_fixture()
        metrics[glyph_metric_key(line.glyphs[5])] = SpacingMetric(1, 2.5, 10, 0, (1, 100, 10, 6))
        result, unresolved = qualify_line_spaces(
            line, "Alpha Beta continues ordinary prose words", metrics
        )
        self.assertEqual(result, line)
        self.assertTrue(unresolved)
