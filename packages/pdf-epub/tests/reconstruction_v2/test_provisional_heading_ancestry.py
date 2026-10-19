"""An opaque OCR barrier grants no parent depth to native or corroborated headings."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.heading_hierarchy import heading_hierarchy
from ava_pdf_epub.reconstruction_v2.source_segments import source_segments

from .mixed_heading_fixtures import NATIVE_SECTION, OCR_SECTION
from .provisional_heading_fixture import provisional_case


class ProvisionalHeadingAncestry(unittest.TestCase):
    def test_invalid_ocr_never_supplies_a_missing_corroborated_parent(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, pages, request = provisional_case(root, 2)
            _, original, _ = source_segments(source, root / "pages", pages, request.responses)
            ocr_id = next(s.id for s in original if s.text == OCR_SECTION)
            native_id = next(s.id for s in original if s.text == NATIVE_SECTION)
            for level in (1, 3, 4):
                changed = [
                    s.model_copy(update={"heading_level": level})
                    if s.id == ocr_id
                    else s.model_copy(update={"heading_level": 3})
                    if s.id == native_id
                    else s
                    for s in original
                ]
                with (
                    self.subTest(level=level),
                    self.assertRaisesRegex(ValueError, "unobserved parent"),
                ):
                    heading_hierarchy(changed, pages, {native_id}, set())
            changed = [
                s.model_copy(update={"heading_level": 3})
                if s.id == ocr_id
                else s.model_copy(update={"heading_level": 2})
                if s.id == native_id
                else s
                for s in original
            ]
            self.assertEqual(
                2,
                next(
                    s.heading_level
                    for s in heading_hierarchy(changed, pages, {native_id}, set())
                    if s.id == native_id
                ),
            )

    def test_native_corroborated_and_null_declarations_remain_strict(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, pages, request = provisional_case(root, 2)
            _, original, _ = source_segments(source, root / "pages", pages, request.responses)
            ocr_id = next(s.id for s in original if s.text == OCR_SECTION)
            for fields, corroborated in [
                ({"heading_level": 3}, {ocr_id}),
                ({"heading_level": None}, set()),
                ({"heading_level": 3, "method": "native"}, set()),
            ]:
                changed = [s.model_copy(update=fields) if s.id == ocr_id else s for s in original]
                with self.subTest(fields=fields), self.assertRaises(ValueError):
                    heading_hierarchy(changed, pages, corroborated, set())

    def test_no_review_context_keeps_standalone_default_strict(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, pages, request = provisional_case(root, 2)
            _, original, _ = source_segments(source, root / "pages", pages, request.responses)
            changed = [
                s.model_copy(update={"heading_level": 3}) if s.text == OCR_SECTION else s
                for s in original
            ]
            with self.assertRaisesRegex(ValueError, "unobserved parent"):
                heading_hierarchy(changed, pages, set())
