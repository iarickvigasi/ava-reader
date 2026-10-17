"""Word spacing needs exact decoding and local source metrics; tracking alone is insufficient."""

import unittest

from ava_pdf_epub.reconstruction_v2.spacing_capture import glyph_metric_key
from ava_pdf_epub.reconstruction_v2.spacing_line import qualify_line_spaces
from ava_pdf_epub.reconstruction_v2.spacing_metric import SpacingMetric

from .spacing_fixture import spacing_fixture


class SpacingLineTests(unittest.TestCase):
    def test_qualifies_space_without_changing_glyphs_or_style(self):
        line, metrics = spacing_fixture()
        result, unresolved = qualify_line_spaces(line, line.text[:5] + " " + line.text[5:], metrics)
        self.assertFalse(unresolved)
        self.assertEqual(result.inserted_space_offsets, [5])
        self.assertEqual(result.glyphs, line.glyphs)
        self.assertEqual(result.box, line.box)
        self.assertEqual(result.style, line.style)
        self.assertEqual(line.text, "AlphaBeta continues ordinary prose words")
        self.assertNotIn("inserted_space_offsets", line.model_dump())

    def test_character_spacing_is_compensated_with_its_actual_sign(self):
        for tracking in [-0.00104, 0.03, 0.4]:
            line, metrics = spacing_fixture(tracking=tracking)
            result, unresolved = qualify_line_spaces(
                line, "Alpha Beta continues ordinary prose words", metrics
            )
            self.assertFalse(unresolved)
            self.assertEqual(result.inserted_space_offsets, [5])

    def test_resource_state_and_local_contrast_are_required(self):
        for change in ["resource", "tracking", "space", "absent", "ink", "artifact", "unknown"]:
            line, metrics = spacing_fixture()
            key = glyph_metric_key(line.glyphs[5])
            if change == "absent":
                metrics.pop(key)
            elif change == "resource":
                metrics[key] = SpacingMetric(2, 2.5, 10, 0)
            elif change == "tracking":
                metrics[key] = SpacingMetric(1, 2.5, 10, 0.001)
            elif change == "space":
                metrics[key] = SpacingMetric(1, 3, 10, 0)
            elif change in {"ink", "artifact"}:
                gs = list(line.glyphs)
                gs[5] = gs[5].model_copy(
                    update={"visible": change != "ink", "source_artifact": change == "artifact"}
                )
                line = line.model_copy(update={"glyphs": gs})
            else:
                line = line.model_copy(
                    update={"style": line.style.model_copy(update={"family": None})}
                )
            with self.subTest(change=change):
                result, unresolved = qualify_line_spaces(
                    line, "Alpha Beta continues ordinary prose words", metrics
                )
                self.assertTrue(unresolved)
                self.assertEqual(result, line)

    def test_short_or_too_small_gap_refuses(self):
        for options in [{"text": "AlphaBeta"}, {"gap": 1.2}, {"gap": 0.3, "tracking": 1.5}]:
            line, metrics = spacing_fixture(**options)
            result, unresolved = qualify_line_spaces(
                line, line.text[:5] + " " + line.text[5:], metrics
            )
            self.assertEqual(result, line)
            self.assertTrue(unresolved)

    def test_decoder_cannot_turn_tracking_into_word_spaces(self):
        line, metrics = spacing_fixture(gap=0, tracking=1.7)
        result, unresolved = qualify_line_spaces(line, line.text[:5] + " " + line.text[5:], metrics)
        self.assertEqual(result, line)
        self.assertTrue(unresolved)

    def test_cannot_split_a_multi_character_glyph(self):
        line, metrics = spacing_fixture()
        gs = [line.glyphs[0].model_copy(update={"text": "AlphaBeta"}), *line.glyphs[9:]]
        line = line.model_copy(update={"glyphs": gs})
        result, unresolved = qualify_line_spaces(line, line.text[:5] + " " + line.text[5:], metrics)
        self.assertEqual(result, line)
        self.assertTrue(unresolved)
