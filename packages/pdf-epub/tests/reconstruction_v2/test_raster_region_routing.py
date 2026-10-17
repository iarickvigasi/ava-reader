"""Real mixed-PDF preparation routes bounded text pixels without rewriting native content."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw
from pypdf import PdfReader, PdfWriter

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.validate_tasks import validate_tasks

from .raster_region_fixture import NATIVE_LINES, authored_mixed
from .test_raster_text import text_image


class RasterRegionRouting(unittest.TestCase):
    def test_rotated_or_overlapping_native_content_keeps_fullpage_safety_route(self) -> None:
        for rotated in [False, True]:
            with self.subTest(rotated=rotated), tempfile.TemporaryDirectory() as directory:
                scratch = Path(directory)
                source = scratch / "source.pdf"
                authored_mixed(
                    source,
                    text_image(["Native content needs visual review."]),
                    image_top=284 if rotated else 70,
                )
                if rotated:
                    writer = PdfWriter(clone_from=PdfReader(source))
                    writer.pages[0].rotate(90)
                    source = scratch / "rotated.pdf"
                    writer.write(source)
                page = prepare_page(source, scratch, 1, BILINGUAL_PROFILE)
                self.assertEqual(1, len(page.tasks))
                box = page.tasks[0].region_box
                self.assertEqual((0, 0), (box.x0, box.y0))
                self.assertEqual(page.observation.width_pt, box.x1)
                self.assertEqual(page.observation.height_pt, box.y1)
                self.assertEqual(
                    hashlib.sha256(source.read_bytes()).hexdigest(), page.tasks[0].source_sha256
                )

    def test_short_region_keeps_native_bytes_styles_and_task_identity(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            image = text_image(
                [
                    "One light above the water,",
                    "One shadow on the foam,",
                    "Four windows guide us home.",
                ]
            )
            source = scratch / "mixed.pdf"
            authored_mixed(source, image)
            page = prepare_page(source, scratch, 1, BILINGUAL_PROFILE)
            self.assertEqual(1, len(page.tasks))
            task = page.tasks[0]
            self.assertEqual("ava-prose-region-15", task.prompt_version)
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), task.source_sha256)
            self.assertEqual(1, task.page_number)
            box = task.region_box
            self.assertEqual((66, 278, 528, 376), (box.x0, box.y0, box.x1, box.y1))
            self.assertFalse(any(s.kind == "figure" for s in page.native_segments))
            text = " ".join(s.text or "" for s in page.native_segments)
            self.assertTrue(all(line in text for line in NATIVE_LINES))
            repeat = prepare_page(source, scratch, 1, BILINGUAL_PROFILE)
            self.assertEqual(task, repeat.tasks[0])
            raw = json.dumps({"mode": "validate_tasks", "tasks": [task.model_dump(mode="json")]})
            self.assertEqual(1, validate_tasks(raw.encode()).task_count)
            # Compare the same measured native source around an unrecognized image barrier.
            picture = Image.new("L", image.size, "white")
            draw = ImageDraw.Draw(picture)
            draw.rectangle((40, 20, 140, 90), fill="black")
            control_source = scratch / "picture.pdf"
            authored_mixed(control_source, picture)
            control = prepare_page(control_source, scratch, 1, BILINGUAL_PROFILE)
            self.assertEqual([], control.tasks)
            native = [s for s in control.native_segments if s.kind != "figure"]
            self.assertEqual(native, page.native_segments)
            self.assertEqual(1, sum(s.kind == "figure" for s in control.native_segments))
