"""Ambiguous outlined symbols remain original pixels when source-bound review finds a figure."""

import base64
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.source_refusal import SourceContentRefusal

from .raster_region_fixture import authored_mixed
from .response_fixtures import wire_segment


class RasterIllustrationRetention(unittest.TestCase):
    def test_figure_keeps_exact_task_pixels_through_epub_and_empty_review_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            image = Image.new("L", (600, 100), "white")
            for x in [20, 40, 60, 80]:
                ImageDraw.Draw(image).rectangle((x, 20, x + 9, 37), outline="black", width=2)
            source = scratch / "symbols.pdf"
            authored_mixed(source, image, framed=True)
            page = prepare_page(source, scratch, 1, BILINGUAL_PROFILE)
            self.assertEqual(1, len(page.tasks))
            task = page.tasks[0]
            self.assertLessEqual(task.region_box.x0, 72)
            self.assertGreaterEqual(task.region_box.x1, 522)
            self.assertLessEqual(task.region_box.y0, 284)
            # The vector frame extends20pt below the raster and belongs to its source group.
            self.assertGreaterEqual(task.region_box.y1, 430)
            response = RecognitionResponse(
                schema_version="ava-recognition-response-2",
                task_id=task.task_id,
                source_sha256=task.source_sha256,
                render_sha256=task.image.sha256,
                language="en",
                unresolved=[],
                segments=[
                    wire_segment(kind="figure", text="", alt="Four outlined symbols", page=1)
                ],
            )
            with self.assertRaises(SourceContentRefusal) as caught:
                reconstruct(source, scratch, [page], [response.model_copy(update={"segments": []})])
            self.assertEqual("RECOGNITION_UNRESOLVED", caught.exception.diagnostic.findings[0].code)
            result = reconstruct(source, scratch, [page], [response])
            figures = [b for b in result.book.blocks if b.kind == "figure"]
            self.assertEqual(1, len(figures))
            pixels = result.assets[figures[0].resource_id]
            self.assertEqual(base64.b64decode(task.image.base64), pixels)
            imported, assets = portable_epub(result.epub)
            self.assertEqual(result.book, imported)
            self.assertEqual(result.assets, assets)
