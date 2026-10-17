"""Actual blank scans need no model; nonblank furniture must remain an explicit observation."""

import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.qualify_pages import qualify_pages
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse
from ava_pdf_epub.reconstruction_v2.source_refusal import SourceContentRefusal

from .response_fixtures import wire_segment


class RasterBlankFurniture(unittest.TestCase):
    def test_uniform_white_scan_qualifies_without_task_or_receipt(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = scratch / "blank.pdf"
            Image.new("RGB", (600, 800), "white").save(source, "PDF", resolution=72)
            page = prepare_page(source, scratch, 1, BILINGUAL_PROFILE)
            self.assertEqual([], page.observation.lines)
            self.assertEqual([], page.tasks)
            self.assertEqual([], page.native_segments)
            self.assertEqual({1: []}, qualify_pages(source, scratch, [page], []))

    def test_nonblank_scanned_folio_requires_explicit_furniture_and_refuses_empty(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            image = Image.new("RGB", (600, 800), "white")
            ImageDraw.Draw(image).text(
                (296, 760), "1", fill="black", font=ImageFont.load_default(size=18)
            )
            source = scratch / "folio.pdf"
            image.save(source, "PDF", resolution=72)
            page = prepare_page(source, scratch, 1, BILINGUAL_PROFILE)
            self.assertEqual([], page.observation.lines)
            self.assertEqual(1, len(page.tasks))
            task = page.tasks[0]
            box = task.region_box
            self.assertEqual((0, 0, 600, 800), (box.x0, box.y0, box.x1, box.y1))
            response = RecognitionResponse(
                schema_version="ava-recognition-response-2",
                task_id=task.task_id,
                source_sha256=task.source_sha256,
                render_sha256=task.image.sha256,
                language="en",
                unresolved=[],
                segments=[wire_segment(kind="furniture", text="1")],
            )
            qualified = qualify_pages(source, scratch, [page], [response])
            self.assertEqual([("furniture", "1")], [(s.kind, s.text) for s in qualified[1]])
            with self.assertRaises(SourceContentRefusal) as caught:
                qualify_pages(
                    source, scratch, [page], [response.model_copy(update={"segments": []})]
                )
            self.assertEqual("RECOGNITION_UNRESOLVED", caught.exception.diagnostic.findings[0].code)
