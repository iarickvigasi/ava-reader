"""Only source-whitespace-separated terminal references can cross a larger index gap."""

import unittest

from ava_pdf_epub.reconstruction_v2.geometry import union
from ava_pdf_epub.reconstruction_v2.index_source_row import index_source_row

from .test_ocr_link_context import line
from .test_pdf_links import observation


def displaced(text, at, distance):
    row = line("row", text, 36, 100)
    glyphs = [
        g
        if i < at
        else g.model_copy(
            update={
                "box": g.box.model_copy(
                    update={"x0": g.box.x0 + distance, "x1": g.box.x1 + distance}
                )
            }
        )
        for i, g in enumerate(row.glyphs)
    ]
    return row.model_copy(update={"glyphs": glyphs, "box": union([g.box for g in glyphs])})


class IndexRowSpacingTests(unittest.TestCase):
    def test_numeric_suffix_requires_whitespace_and_bounded_gap(self):
        for text, at, distance, accepted in [
            ("alpha 12, 14", 6, 4, True),
            ("alpha 12, 14", 6, 20, False),
            ("alpha12", 5, 6, False),
            ("alpha beta 12", 6, 4, False),
        ]:
            with self.subTest(text=text, distance=distance):
                row = displaced(text, at, distance)
                values = [(i, g) for i, g in enumerate(row.glyphs) if g.text.strip()]
                self.assertEqual(
                    accepted,
                    index_source_row(
                        observation().model_copy(update={"width_pt": 346.0, "height_pt": 582.0}),
                        row,
                        values,
                        0,
                    )
                    is not None,
                )
