"""Independent assertions for observed glyph-loss and two-column ordering failures."""

import unittest

from PIL import Image

from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.reconstruction_v2.native_lines import native_lines
from ava_pdf_epub.reconstruction_v2.observe_glyphs import observe_glyphs
from ava_pdf_epub.reconstruction_v2.reading_order import reading_order
from ava_pdf_epub.reconstruction_v2.segments import Segment


def box(x: float, y: float, width: float = 80) -> Box:
    return Box(coordinate_space="page_points_top_left", x0=x, y0=y, x1=x + width, y1=y + 10)


class NativeGeometryTest(unittest.TestCase):
    def test_zero_advance_combining_character_is_retained(self) -> None:
        chars = [
            {
                "text": "e",
                "x0": 10,
                "x1": 16,
                "top": 10,
                "bottom": 20,
                "size": 10,
                "fontname": "Serif",
            },
            {
                "text": "\u0301",
                "x0": 16,
                "x1": 16,
                "top": 10,
                "bottom": 20,
                "size": 10,
                "fontname": "Serif",
            },
        ]
        image = Image.new("L", (100, 100), 255)
        glyphs, risks = observe_glyphs(chars, image, (0, 0, 100, 100))
        self.assertEqual(native_lines(glyphs, 1)[0].text, "e\u0301")
        self.assertNotIn("clipped_glyph", risks)
        self.assertIn("glyph_without_visible_ink", risks)

    def test_reverse_object_order_uses_columns_and_full_width_heading(self) -> None:
        positions = [
            ("right-a", 220, 20),
            ("right-b", 220, 40),
            ("left-a", 20, 20),
            ("left-b", 20, 40),
            ("right-c", 220, 100),
            ("right-d", 220, 120),
            ("left-c", 20, 100),
            ("left-d", 20, 120),
        ]
        segments = [
            Segment(id=ident, page=1, kind="paragraph", text=ident, box=box(x, y), method="native")
            for ident, x, y in positions
        ]
        segments.append(
            Segment(
                id="span",
                page=1,
                kind="heading",
                text="Section",
                box=box(120, 70, 160),
                method="native",
                heading_level=2,
            )
        )
        actual = reading_order(segments, 400)
        self.assertEqual(
            [p.segment.id for p in actual],
            [
                "left-a",
                "left-b",
                "right-a",
                "right-b",
                "span",
                "left-c",
                "left-d",
                "right-c",
                "right-d",
            ],
        )
        self.assertEqual([p.column for p in actual], [1, 1, 2, 2, 0, 1, 1, 2, 2])
