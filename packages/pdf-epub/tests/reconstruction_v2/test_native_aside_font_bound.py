"""Optional fonts honor the actual intermediate span bound without rejecting valid source prose."""

import unittest

from ava_pdf_epub.reconstruction_v2.native_graphics import native_graphics
from ava_pdf_epub.reconstruction_v2.observations import Glyph
from ava_pdf_epub.reconstruction_v2.segments import Segment

from .aside_font_fixture import box, line, page


class NativeAsideFontBound(unittest.TestCase):
    def test_contract_boundary_and_overflow_preserve_exact_native_content(self):
        limit = next(
            m.max_length for m in Segment.model_fields["spans"].metadata if hasattr(m, "max_length")
        )
        for count in [limit, limit + 1]:
            with self.subTest(count=count):
                glyphs = [
                    Glyph(
                        text="a",
                        font="ArialMT" if i % 2 else "Times-Roman",
                        size=11,
                        visible=True,
                        box=box(40 + i / 1000, 30, 40 + (i + 1) / 1000, 41),
                    )
                    for i in range(count)
                ]
                source = line().model_copy(
                    update={
                        "text": "a" * count,
                        "glyphs": glyphs,
                        "box": box(40, 30, 40 + count / 1000, 41),
                    }
                )
                item = native_graphics(page([source]), [])[0]
                self.assertEqual(
                    ("aside", "native", source.text), (item.kind, item.method, item.text)
                )
                self.assertEqual([source.id], item.native_line_ids)
                self.assertEqual(box(), item.box)
                if count == limit:
                    self.assertEqual(limit, len(item.spans))
                    self.assertEqual(item, Segment.model_validate(item.model_dump()))
                    self.assertEqual((0, count), (item.spans[0].start, item.spans[-1].end))
                else:
                    self.assertIsNone(item.style)
                    self.assertEqual([], item.spans)
