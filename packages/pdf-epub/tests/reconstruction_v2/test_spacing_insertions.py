"""Conserve all original Unicode/whitespace and forbid splitting graphemes or glyphs."""

import unittest

from ava_pdf_epub.reconstruction_v2.spacing_insertions import space_insertions


class SpacingInsertionsTests(unittest.TestCase):
    def test_only_missing_ascii_spaces(self):
        self.assertEqual(space_insertions("AlphaBeta café", "Alpha Beta café"), [5])
        self.assertEqual(space_insertions("мояКнига", "моя Книга"), [3])
        self.assertEqual(space_insertions("end.The", "end. The"), [4])

    def test_original_characters_and_whitespace_are_immutable(self):
        for original, proposed in [
            ("AlphaBeta", "alpha Beta"),
            ("a  b", "a b"),
            ("a\tb", "a b"),
            ("a\nb", "a b"),
            ("café", "cafe"),
            ("ﬁne", "fi ne"),
            ("ab", " ab"),
            ("ab", "ab "),
            ("ab", "a  b"),
            ("a b", "a  b"),
            ("A😀B", "A 😀B"),
        ]:
            with self.subTest(original=original, proposed=proposed):
                self.assertIsNone(space_insertions(original, proposed))

    def test_grapheme_boundaries_remain_whole(self):
        for original, proposed in [
            ("e\u0301", "e \u0301"),
            ("👩\u200d💻", "👩 \u200d💻"),
            ("🇺🇦", "🇺 🇦"),
            ("✊🏿", "✊ 🏿"),
            ("a️b", "a ️b"),
        ]:
            self.assertIsNone(space_insertions(original, proposed))
