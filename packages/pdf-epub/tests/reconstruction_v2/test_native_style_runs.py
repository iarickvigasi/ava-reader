"""Native run allocation must preserve exact typography and source offsets."""

import unittest

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.font_style import font_style
from ava_pdf_epub.reconstruction_v2.font_traits import font_traits
from ava_pdf_epub.reconstruction_v2.line_spans import line_spans
from ava_pdf_epub.reconstruction_v2.native_review import NativeReviewRequired
from ava_pdf_epub.reconstruction_v2.observations import Glyph, NativeLine

from .test_pdf_links import box


def glyph(text, font="Times-Roman", size=10, bottom=30):
    return Glyph(text=text, font=font, size=size, box=box(y0=0, y1=bottom), visible=True)


def line(text, glyphs):
    return NativeLine(id="line", text=text, glyphs=glyphs, box=box(), style=Style(id="base"))


class NativeStyleRunsTests(unittest.TestCase):
    def test_known_minion_postscript_italic_aliases_are_explicit_not_suffix_guesses(self):
        for name in ("MinionPro-It", "ABCDEF+MinionPro-It", "MinionPro-BoldIt"):
            self.assertTrue(font_traits(name).italic)
        self.assertTrue(font_traits("MinionPro-BoldIt").bold)
        for name in (
            "MinionPro-Regular",
            "MinionPro-Display",
            "Unknown-It",
            "MinionPro-UnlistedIt",
        ):
            self.assertFalse(font_traits(name).italic)

    def test_spaces_emphasis_and_superscript_keep_exact_runs_and_first_glyph_identity(self):
        chars = [glyph(c) for c in "AB "]
        chars += [glyph(c, "Times-Bold") for c in "CD"]
        chars += [glyph(c, "Times-Italic") for c in "xy"]
        chars += [glyph("2", size=6, bottom=12)]
        spans = line_spans(line("AB CDxy2", chars))
        self.assertEqual([(0, 2), (3, 5), (5, 7), (7, 8)], [(s.start, s.end) for s in spans])
        self.assertEqual(["line-g0", "line-g3", "line-g5", "line-g7"], [s.style.id for s in spans])
        self.assertEqual([False, True, False, False], [s.style.bold for s in spans])
        self.assertEqual([False, False, True, False], [s.style.italic for s in spans])
        self.assertEqual("super", spans[-1].style.vertical_align)
        self.assertEqual(0.6, spans[-1].style.relative_size)

    def test_case_variants_ligatures_and_unicode_preserve_codepoint_offsets(self):
        source = line(
            "A🙂éZ",
            [
                glyph("A", "Courier"),
                glyph("🙂", "COURIER"),
                glyph("é", "Courier"),
                glyph("Z", "Courier"),
            ],
        )
        spans = line_spans(source)
        self.assertEqual(1, len(spans))
        self.assertEqual((0, 5), (spans[0].start, spans[0].end))
        self.assertEqual("monospace", spans[0].style.family)
        self.assertEqual("A🙂éZ", source.text)

    def test_unknown_fonts_and_source_gaps_are_not_invented_or_merged(self):
        spans = line_spans(line("AxB", [glyph("A", "Unknown"), glyph("B", "Unknown")]))
        self.assertEqual([(0, 1), (2, 3)], [(s.start, s.end) for s in spans])
        self.assertTrue(all(s.style.family is None for s in spans))
        with self.assertRaises(NativeReviewRequired):
            line_spans(line("A", [glyph("B")]))

    def test_dominant_face_and_mixed_emphasis_keep_existing_line_semantics(self):
        style = font_style([glyph("A", "Arial-Bold"), glyph("B", "Times-Italic")], "style")
        self.assertEqual("sans-serif", style.family)
        self.assertFalse(style.bold)
        self.assertFalse(style.italic)
        self.assertTrue(font_style([glyph("A", "Times-SC")], "style").small_caps)

    def test_font_cache_is_finite_and_immutable(self):
        font_traits.cache_clear()
        for i in range(500):
            font_traits("Unknown" + str(i))
        self.assertLessEqual(font_traits.cache_info().currsize, 256)
        with self.assertRaises(AttributeError):
            font_traits("Times").bold = True
