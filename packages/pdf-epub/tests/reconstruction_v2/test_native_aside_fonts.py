"""Only complete native evidence supplies font roles; content and frame geometry stay immutable."""

import unittest

from ava_pdf_epub.reconstruction_v2.native_graphics import native_graphics
from ava_pdf_epub.reconstruction_v2.native_spacing import native_spacing
from ava_pdf_epub.reconstruction_v2.segments import Segment

from .aside_font_fixture import TEXT, box, line, page


class NativeAsideFonts(unittest.TestCase):
    def test_uniform_face_uses_all_glyphs_and_adds_no_geometry(self):
        rows = [line(), line("second", y=60)]
        observed = page(rows)
        result = native_graphics(observed, [])[0]
        self.assertEqual(
            ("p1-graphic0", "aside", "native"), (result.id, result.kind, result.method)
        )
        self.assertEqual(TEXT + "\n" + TEXT, result.text)
        self.assertEqual([r.id for r in rows], result.native_line_ids)
        self.assertEqual(box(), result.box)
        self.assertEqual("sans-serif", result.style.family)
        self.assertIs(result.style.bold, False)
        self.assertIs(result.style.italic, False)
        self.assertEqual([], result.spans)
        self.assertEqual([result], native_spacing(observed, [result]))
        for field in (
            "align",
            "indent_em",
            "block_indent_em",
            "relative_size",
            "line_height",
            "space_before_em",
            "space_after_em",
            "background_color",
        ):
            self.assertIsNone(getattr(result.style, field), field)

    def test_mixed_faces_keep_unicode_newline_offsets_and_plain_resets(self):
        first = line(parts=[("A🙂é bold ", "Arial-Bold"), (TEXT, "Times-Italic")])
        second = line("second", [(TEXT, "Courier")], y=60)
        item = native_graphics(page([first, second]), [])[0]
        self.assertEqual(first.text + "\n" + second.text, item.text)
        self.assertIsNone(item.style.family)
        self.assertIsNone(item.style.bold)
        self.assertIsNone(item.style.italic)
        self.assertEqual(
            [(0, 10), (10, len(first.text)), (len(first.text) + 1, len(item.text))],
            [(s.start, s.end) for s in item.spans],
        )
        self.assertEqual(["sans-serif", "serif", "monospace"], [s.style.family for s in item.spans])
        self.assertEqual([True, False, False], [s.style.bold for s in item.spans])
        self.assertEqual([False, True, False], [s.style.italic for s in item.spans])
        self.assertEqual("A🙂é bold ", item.text[item.spans[0].start : item.spans[0].end])

    def test_raster_figure_never_gains_a_native_font_claim(self):
        item = native_graphics(page([line()], "image"), [])[0]
        self.assertEqual(
            ("figure", "render", "", TEXT), (item.kind, item.method, item.text, item.alt)
        )
        self.assertIsNone(item.style)
        self.assertEqual([], item.spans)

    def test_duplicate_line_identity_and_existing_owner_stay_unqualified(self):
        source = line()
        duplicate = line(y=60)
        owned = Segment(
            id="table",
            page=1,
            box=box(550, 170, 580, 190),
            kind="figure",
            method="render",
            native_line_ids=[source.id],
        )
        for observed, tables in [(page([source, duplicate]), []), (page([source]), [owned])]:
            item = native_graphics(observed, tables)[0]
            self.assertIsNone(item.style)
            self.assertEqual([], item.spans)
