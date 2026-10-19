"""PDF coordinates retain exact OCR-owned passage destinations without native ownership."""

import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader, PdfWriter

from ava_pdf_epub.pdf_navigation import NavigationTarget
from ava_pdf_epub.reconstruction_v2.pdf_links import page_target

from .test_ocr_link_context import fixture
from .test_pdf_links import box


class OcrLinkDestinations(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        path = Path(temp.name) / "source.pdf"
        writer = PdfWriter()
        writer.add_blank_page(width=100, height=100)
        writer.write(path)
        self.reader = PdfReader(path, strict=True)
        self.addCleanup(self.reader.close)
        self.page, self.owner = fixture()

    def test_viewport_start_and_exact_later_passage_remain_distinct(self):
        for target, offset in (
            (NavigationTarget(page=1, left=-20, top=105, fit="/XYZ"), 0),
            (NavigationTarget(page=1, left=10, top=60), 10),
            (NavigationTarget(page=1, left=80, top=60), 15),
        ):
            with self.subTest(target=target):
                self.assertEqual(
                    (self.owner.id, offset),
                    page_target(target, [self.owner], self.reader, self.page),
                )
        self.assertEqual([], self.owner.native_line_ids)

    def test_missing_ambiguous_or_unreliable_destination_cannot_skip_to_later_text(self):
        hidden = self.page.lines[0].model_copy(
            update={
                "glyphs": [
                    g.model_copy(update={"visible": False}) for g in self.page.lines[0].glyphs
                ]
            }
        )
        target = NavigationTarget(page=1, left=-20, top=105, fit="/XYZ")
        for page, owners in (
            (self.page, [self.owner.model_copy(update={"text": "Wrong title\nMore 1"})]),
            (self.page, [self.owner.model_copy(update={"box": box(10, 20, 84, 50)})]),
            (self.page, [self.owner, self.owner.model_copy(update={"id": "duplicate"})]),
            (self.page.model_copy(update={"lines": [hidden, *self.page.lines[1:]]}), [self.owner]),
            (self.page.model_copy(update={"risks": ["unreliable_glyph_mapping"]}), [self.owner]),
        ):
            with self.subTest(owners=owners), self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                page_target(target, owners, self.reader, page)

    def test_unknown_viewport_frames_and_displaced_ocr_keep_existing_refusal(self):
        for target in (
            NavigationTarget(page=1, left=-20, top=105),
            NavigationTarget(page=1, left=101, top=105, fit="/XYZ"),
            NavigationTarget(page=1, left=80, top=-1, fit="/XYZ"),
        ):
            with self.subTest(target=target), self.assertRaises(ValueError):
                page_target(target, [self.owner], self.reader, self.page)
        displaced = self.owner.model_copy(update={"box": box(0, 70, 84, 90)})
        with self.assertRaises(ValueError):
            page_target(NavigationTarget(page=1, top=80), [displaced], self.reader, self.page)
