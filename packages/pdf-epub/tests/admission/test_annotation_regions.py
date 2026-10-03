"""Source-coordinate mappings are checked independently of the OCR provider."""

import unittest

from pypdf.generic import ArrayObject, NameObject, NumberObject

from ava_pdf_epub.reconstruction_v2.annotation_regions import annotation_regions

from .appearance_fixture import annotated_document


class AnnotationRegions(unittest.TestCase):
    def test_cardinal_rotations_keep_the_exact_required_region(self):
        expected = {
            0: (30, 220, 230, 250),
            90: (150, 30, 180, 230),
            180: (70, 150, 270, 180),
            270: (220, 70, 250, 270),
        }
        for rotation, coordinates in expected.items():
            page = annotated_document().pages[0]
            page.rotate(rotation)
            with self.subTest(rotation=rotation):
                region = annotation_regions(page)[0]
                self.assertEqual("text", region.kind)
                box = region.box
                self.assertEqual(coordinates, (box.x0, box.y0, box.x1, box.y1))

    def test_clipped_annotation_is_not_silently_truncated(self):
        page = annotated_document().pages[0]
        annotation = page["/Annots"][0].get_object()
        annotation[NameObject("/Rect")] = ArrayObject(
            [NumberObject(n) for n in [-10, 150, 230, 180]]
        )
        with self.assertRaisesRegex(ValueError, "VISIBILITY_REQUIRES_REVIEW"):
            annotation_regions(page)
