"""Full source→comparison→canonical/EPUB repair preserves the independently authored prose."""

import base64
import io
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.report import reconstruction_report

from .refinement_helpers import authored_responses, source_case


class BookRefinementTest(unittest.TestCase):
    def test_cross_page_hierarchy_and_source_styles_resolve_without_retranscription(self):
        with tempfile.TemporaryDirectory() as directory:
            source, pages, responses, segments, state, tasks = source_case(Path(directory))
            before = [s.model_dump() for s in segments]
            receipts = authored_responses(tasks)
            result = reconstruct(source, Path(directory), pages, responses, receipts)
            report = reconstruction_report(result, 3)
            self.assertEqual("pass", report.checks["source_structure_signals_consistent"])
            self.assertEqual([], report.findings)
            self.assertEqual(len(tasks), len(report.refinement_evidence))
            headings = {b.content.text: b for b in result.book.blocks if b.kind == "heading"}
            nested = headings["The eastern narrow channel"]
            self.assertEqual(3, nested.level)
            style = next(s for s in result.book.styles if s.id == nested.style_id)
            self.assertEqual(13 / 11, style.relative_size)
            self.assertFalse(style.bold)
            self.assertTrue(style.italic)
            self.assertEqual(before, [s.model_dump() for s in segments])
            self.assertEqual(
                [s.text for s in segments], [b.content.text for b in result.book.blocks]
            )
            self.assertEqual(2, len(result.book.chapters))
            self.assertFalse(
                any(m.field == "title" and m.status == "accepted" for m in result.book.metadata)
            )
            self.assertTrue(result.epub.startswith(b"PK"))
            for task in tasks:
                with Image.open(io.BytesIO(base64.b64decode(task.image.base64))) as sheet:
                    for crop in task.crops:
                        self.assertLessEqual(
                            abs(
                                (crop.source_box.x1 - crop.source_box.x0) * 2
                                - (crop.image_box[2] - crop.image_box[0])
                            ),
                            1,
                        )
                        self.assertGreater(
                            len(sheet.crop(tuple(crop.image_box)).getcolors(2000000)), 1
                        )

    def test_missing_receipt_is_not_silent_quality_approval(self):
        with tempfile.TemporaryDirectory() as directory:
            source, pages, responses, _, _, _ = source_case(Path(directory))
            with self.assertRaisesRegex(ValueError, "coverage"):
                reconstruct(source, Path(directory), pages, responses, [])
