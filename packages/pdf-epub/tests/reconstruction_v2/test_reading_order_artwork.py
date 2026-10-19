"""Artwork does not invent columns; real column and spanning-content guards stay active."""

import unittest

from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.reconstruction_v2.native_review import NativeReviewRequired
from ava_pdf_epub.reconstruction_v2.reading_order import reading_order
from ava_pdf_epub.reconstruction_v2.segments import Segment


def item(ident, kind, bounds):
    return Segment(
        id=ident,
        page=1,
        kind=kind,
        method="ocr",
        text="" if kind == "figure" else ident,
        alt="Illustration" if kind == "figure" else "",
        heading_level=1 if kind == "heading" else None,
        box=Box(
            coordinate_space="page_points_top_left",
            x0=bounds[0],
            y0=bounds[1],
            x1=bounds[2],
            y1=bounds[3],
        ),
    )


class ReadingOrderArtworkTest(unittest.TestCase):
    def test_cover_title_envelope_can_contain_credit_and_side_art(self):
        title = item("title", "heading", (24, 300, 310, 512))
        art = item("art", "figure", (228, 314, 296, 380))
        credit = item("credit", "credit", (42, 364, 110, 377))
        subtitle = item("subtitle", "heading", (34, 424, 309, 440))
        for mirrored in (False, True):
            source = [art, subtitle, credit, title]
            if mirrored:
                source = [
                    s.model_copy(
                        update={
                            "box": s.box.model_copy(
                                update={
                                    "x0": 346 - s.box.x1,
                                    "x1": 346 - s.box.x0,
                                }
                            )
                        }
                    )
                    for s in source
                ]
            for values in (source, list(reversed(source))):
                with self.subTest(mirrored=mirrored, first=values[0].id):
                    before = [s.model_dump() for s in values]
                    result = reading_order(values, 346)
                    self.assertEqual(
                        [p.segment.id for p in result], ["title", "art", "credit", "subtitle"]
                    )
                    self.assertTrue(all(p.column == 0 for p in result))
                    self.assertEqual(before, [s.model_dump() for s in values])
                    self.assertEqual({id(p.segment) for p in result}, {id(s) for s in values})

    def test_two_text_columns_keep_side_art_in_its_column(self):
        values = [
            item("right", "paragraph", (220, 20, 380, 60)),
            item("left", "paragraph", (20, 20, 180, 60)),
            item("art", "figure", (240, 65, 360, 100)),
            item("left-next", "paragraph", (20, 70, 180, 110)),
        ]
        result = reading_order(values, 400)
        self.assertEqual([p.segment.id for p in result], ["left", "left-next", "right", "art"])
        self.assertEqual([p.column for p in result], [1, 1, 2, 2])

    def test_full_width_art_separates_two_column_bands(self):
        values = [
            item("left", "paragraph", (20, 20, 180, 60)),
            item("right", "paragraph", (220, 20, 380, 60)),
            item("art", "figure", (20, 70, 380, 100)),
            item("left-end", "paragraph", (20, 110, 180, 150)),
            item("right-end", "paragraph", (220, 110, 380, 150)),
        ]
        result = reading_order(list(reversed(values)), 400)
        self.assertEqual([p.segment.id for p in result], [s.id for s in values])
        self.assertEqual([p.column for p in result], [1, 2, 0, 1, 2])
        self.assertEqual([p.band for p in result], [0, 0, 1, 2, 2])

    def test_real_text_columns_overlapping_spanning_title_still_refuse(self):
        values = [
            item("left", "paragraph", (20, 20, 180, 60)),
            item("right", "paragraph", (220, 20, 380, 60)),
            item("title", "heading", (20, 40, 380, 80)),
            item("art", "figure", (220, 90, 380, 120)),
        ]
        with self.assertRaisesRegex(NativeReviewRequired, "Overlapping full-width"):
            reading_order(values, 400)
