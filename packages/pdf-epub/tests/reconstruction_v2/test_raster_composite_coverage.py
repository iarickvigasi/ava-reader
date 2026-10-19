"""Review complete connected source groups once; never drop unreviewed graphic pixels."""

import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page

from .raster_region_fixture import authored_mixed
from .test_raster_text import text_image


class RasterCompositeCoverage(unittest.TestCase):
    def test_expanded_composite_also_covers_other_intersecting_graphic_groups(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = scratch / "chained.pdf"
            authored_mixed(source, text_image(["One complete source passage."]), chained=True)
            page = prepare_page(source, scratch, 1, BILINGUAL_PROFILE)
            self.assertEqual(3, len(page.observation.graphics))
            self.assertEqual(1, len(page.tasks))
            box = page.tasks[0].region_box
            self.assertGreaterEqual(box.x1, 546)
            self.assertGreaterEqual(box.y1, 466)
            self.assertFalse(any(s.kind == "figure" for s in page.native_segments))

    def test_cross_cell_native_table_text_still_becomes_fullpage_structure_review(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = scratch / "cross-cell.pdf"
            authored_mixed(source, text_image(["One complete passage."]), crossed_table=True)
            page = prepare_page(source, scratch, 1, BILINGUAL_PROFILE)
            self.assertEqual(1, len(page.tables))
            self.assertEqual(1, len(page.tasks))
            self.assertEqual("pdf_structure_repair", page.tasks[0].purpose)
            box = page.tasks[0].region_box
            self.assertEqual((0, 0, 600, 800), (box.x0, box.y0, box.x1, box.y1))
            self.assertEqual([], page.native_segments)

    def test_two_connected_text_rasters_share_one_complete_group_task(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = scratch / "connected.pdf"
            authored_mixed(source, text_image(["One complete source passage."]), second_image=True)
            page = prepare_page(source, scratch, 1, BILINGUAL_PROFILE)
            self.assertEqual(2, sum(g.kind == "image" for g in page.observation.graphics))
            self.assertEqual(1, len(page.tasks))
            box = page.tasks[0].region_box
            self.assertLessEqual(box.x0, 72)
            self.assertGreaterEqual(box.x1, 522)
            self.assertLessEqual(box.y0, 284)
            self.assertGreaterEqual(box.y1, 430)
            self.assertFalse(any(s.kind == "figure" for s in page.native_segments))

    def test_composite_reaching_native_text_uses_complete_page_safety_route(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = scratch / "overlap.pdf"
            authored_mixed(
                source, text_image(["One complete passage."]), framed=True, lower_baseline=400
            )
            page = prepare_page(source, scratch, 1, BILINGUAL_PROFILE)
            self.assertEqual(1, len(page.tasks))
            box = page.tasks[0].region_box
            self.assertEqual((0, 0, 600, 800), (box.x0, box.y0, box.x1, box.y1))
            self.assertEqual([], page.native_segments)

    def test_ordinary_composite_illustration_stays_native_without_recognition(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            image = Image.new("L", (600, 100), "white")
            ImageDraw.Draw(image).ellipse((20, 10, 90, 80), fill="black")
            source = scratch / "picture.pdf"
            authored_mixed(source, image, framed=True)
            page = prepare_page(source, scratch, 1, BILINGUAL_PROFILE)
            self.assertEqual([], page.tasks)
            figures = [s for s in page.native_segments if s.kind == "figure"]
            self.assertEqual(1, len(figures))
            self.assertGreaterEqual(figures[0].box.y1, 430)
