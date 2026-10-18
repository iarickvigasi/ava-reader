"""A decoder marker cannot erase spacing uncertainty or normalize unrelated source glyphs."""

import unittest
from types import SimpleNamespace

from ava_pdf_epub.reconstruction_v2.spacing_hyphen import (
    corroborate_terminal_hyphen,
    hyphen_markers,
)
from ava_pdf_epub.reconstruction_v2.spacing_line import qualify_line_spaces

from .spacing_fixture import spacing_fixture


def witness():
    line, metrics = spacing_fixture(text="AlphaBeta continues ordinary prose words Chap-")
    g = line.glyphs[-1].box
    box = (g.x0 + 0.5, g.y0 + 2, g.x1 - 0.5, g.y1 - 2)
    observation = SimpleNamespace(lines=[line], width_pt=500, height_pt=300)
    return line, metrics, box, observation


class SpacingHyphenTests(unittest.TestCase):
    def test_exact_marker_adaptation_still_requires_complete_spacing_and_physical_proof(self):
        line, metrics, box, observation = witness()
        proposed = line.text[:5] + " " + line.text[5:-1] + "\x02"
        adapted = corroborate_terminal_hyphen(line, proposed, [box], observation)
        changed, unresolved = qualify_line_spaces(line, adapted, metrics)
        self.assertFalse(unresolved)
        self.assertEqual(changed.text, line.text[:5] + " " + line.text[5:])
        self.assertEqual(changed.inserted_space_offsets, [5])
        self.assertEqual(changed.glyphs, line.glyphs)
        self.assertEqual(changed.style, line.style)
        self.assertEqual(changed.box, line.box)
        self.assertTrue(changed.text.endswith("-"))
        _, invalid = qualify_line_spaces(line, adapted, {})
        self.assertTrue(invalid)
        corrupted = adapted.replace("ordinary", "rewritten")
        original, invalid = qualify_line_spaces(line, corrupted, metrics)
        self.assertEqual(original, line)
        self.assertTrue(invalid)

    def test_unrelated_decoder_difference_is_unresolved_while_exact_text_is_not(self):
        line, metrics, _, _ = witness()
        for proposed in (line.text[:-1] + "\x02", line.text.replace("ordinary", "different")):
            unchanged, unresolved = qualify_line_spaces(line, proposed, metrics)
            self.assertEqual(unchanged, line)
            self.assertTrue(unresolved)
        self.assertEqual((line, False), qualify_line_spaces(line, line.text, metrics))

    def test_foreign_incomplete_or_ambiguous_marker_geometry_cannot_restore_a_character(self):
        line, _, box, observation = witness()
        proposed = line.text[:-1] + "\x02"
        for markers in ([], [box, box], [(0, 0, 2, 2)], [(box[0] - 10, *box[1:])]):
            self.assertEqual(
                proposed, corroborate_terminal_hyphen(line, proposed, markers, observation)
            )
        other = line.model_copy(update={"id": "p1-other"})
        for peers in ([line, other], [line, line], [other]):
            observation.lines = peers
            self.assertEqual(
                proposed, corroborate_terminal_hyphen(line, proposed, [box], observation)
            )

    def test_only_one_terminal_marker_and_original_literal_visible_hyphen_are_eligible(self):
        line, _, box, observation = witness()
        for proposed in (
            line.text,
            line.text[:-1] + "\ufffe",
            line.text[:-1] + "\x02x",
            "\x02" + line.text[:-1] + "\x02",
        ):
            self.assertEqual(
                proposed, corroborate_terminal_hyphen(line, proposed, [box], observation)
            )
        proposed = line.text[:-1] + "\x02"
        for field, value in (("text", "–"), ("visible", False), ("source_artifact", True)):
            glyphs = [*line.glyphs[:-1], line.glyphs[-1].model_copy(update={field: value})]
            changed = line.model_copy(update={"glyphs": glyphs})
            observation.lines = [changed]
            self.assertEqual(
                proposed, corroborate_terminal_hyphen(changed, proposed, [box], observation)
            )

    def test_raw_character_marker_must_be_explicit_and_bounded_not_an_arbitrary_control(self):
        text = SimpleNamespace(
            count_chars=lambda: 2, get_charbox=lambda _: (20.0, 270.0, 24.0, 280.0)
        )
        for unicode, marked in ((2, 0), (2, -1), (0xFFFE, 1), (45, 1)):
            raw = SimpleNamespace(
                FPDFText_GetUnicode=lambda *_, u=unicode: u,
                FPDFText_IsHyphen=lambda *_, m=marked: m,
            )
            self.assertEqual([], hyphen_markers(text, raw, 300.0))
        raw = SimpleNamespace(
            FPDFText_GetUnicode=lambda _, i: 2 if i == 1 else 97, FPDFText_IsHyphen=lambda *_: 1
        )
        self.assertEqual([(20.0, 20.0, 24.0, 30.0)], hyphen_markers(text, raw, 300.0))
        text.count_chars = lambda: 200001
        with self.assertRaisesRegex(RuntimeError, "bound"):
            hyphen_markers(text, raw, 300.0)
