"""Positioned destinations choose source fragments before testing text equivalence."""

import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, NumberObject

from ava_pdf_epub.pdf_navigation import NavigationTarget
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.pdf_links import page_target

from .ocr_glyph_fixture import columns
from .test_ocr_link_context import line
from .test_pdf_links import box


class OcrGlyphDestinations(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.source = Path(temp.name) / "source.pdf"
        writer = PdfWriter()
        writer.add_blank_page(width=100, height=100)
        writer.write(self.source)
        self.reader = PdfReader(self.source, strict=True)
        self.addCleanup(self.reader.close)
        self.page, self.owners = columns()

    def target(self, target, owners=None, page=None):
        return page_target(
            target,
            owners or self.owners,
            self.reader,
            page or self.page,
            source_continuation_policy=POLICY,
        )

    def test_source_left_and_right_fragments_are_distinct_not_first_matching_text(self):
        self.assertEqual(("left", 0), self.target(NavigationTarget(page=1, left=0, top=80)))
        self.assertEqual(("right", 0), self.target(NavigationTarget(page=1, left=65, top=80)))
        self.assertEqual(
            ("left", 0), self.target(NavigationTarget(page=1, left=-20, top=105, fit="/XYZ"))
        )
        later = line("later", "more54", 0, 40)
        page = self.page.model_copy(update={"lines": [*self.page.lines, later]})
        item = self.owners[0].model_copy(
            update={"text": "no end54,\nmore 54", "box": box(0, 20, 32, 50)}
        )
        self.assertEqual(
            ("left", 10),
            self.target(NavigationTarget(page=1, left=0, top=60), [item, self.owners[1]], page),
        )

    def test_first_covered_but_unprovable_or_competing_fragment_refuses(self):
        target = NavigationTarget(page=1, left=0, top=80)
        wrong = self.owners[0].model_copy(update={"text": "wrong54,"})
        blocker = self.owners[0].model_copy(update={"id": "blocker", "kind": "figure", "text": ""})
        for owners in ([wrong, self.owners[1]], [*self.owners, blocker]):
            with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                self.target(target, owners)

    def test_unknown_frame_and_unit_refuse_current_proof(self):
        self.reader.pages[0][NameObject("/UserUnit")] = NumberObject(2)
        with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
            self.target(NavigationTarget(page=1, left=0, top=80))
