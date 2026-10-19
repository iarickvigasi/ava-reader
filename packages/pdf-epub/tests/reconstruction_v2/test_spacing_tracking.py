"""Large local kerning and manual tracking cannot be hidden by averaging."""

import unittest

from ava_pdf_epub.reconstruction_v2.spacing_capture import glyph_metric_key
from ava_pdf_epub.reconstruction_v2.spacing_line import qualify_line_spaces
from ava_pdf_epub.reconstruction_v2.spacing_metric import SpacingMetric

from .spacing_fixture import spacing_fixture


class SpacingTrackingTests(unittest.TestCase):
    def test_one_large_unseparated_gap_prevents_false_word_boundary(self):
        line, _ = spacing_fixture()
        glyphs = []
        for index, glyph in enumerate(line.glyphs):
            delta = 0.65 if index >= 15 else 0
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
            line, "Alpha Beta continues ordinary prose words", metrics
        )
        self.assertEqual(result, line)
        self.assertTrue(unresolved)
