"""Real scanned/mixed PDF routing; this does not claim OCR transcription accuracy."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.route_native import route_native

FIXTURES = Path(__file__).parent / "fixtures"


class Routing(unittest.TestCase):
    def test_image_only_requires_recognition_and_never_returns_blank_success(self) -> None:
        source = FIXTURES / "two-column-scan.pdf"
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            pages = [prepare_page(source, scratch, i) for i in range(1, 4)]
            self.assertTrue(all(len(p.tasks) == 1 for p in pages))
            self.assertTrue(all(not p.observation.lines for p in pages))
            with self.assertRaisesRegex(ValueError, "task coverage"):
                reconstruct(source, scratch, pages, [])

    def test_ambiguous_native_structure_becomes_a_stable_bounded_repair_task(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            page = prepare_page(FIXTURES / "native.pdf", scratch, 3)
            with patch(
                "ava_pdf_epub.reconstruction_v2.route_native.native_page",
                side_effect=ValueError("Ambiguous layout"),
            ):
                segments, tasks = route_native(
                    page.observation, page.tables, [], page.source_sha256, scratch
                )
            self.assertEqual([], segments)
            self.assertEqual(1, len(tasks))
            self.assertEqual("pdf_structure_repair", tasks[0].purpose)
            self.assertEqual(page.source_sha256, tasks[0].source_sha256)
            self.assertEqual(page.observation.width_pt, tasks[0].region_box.x1)

    def test_mixed_routes_only_pages_with_unqualified_visible_content(self) -> None:
        source = FIXTURES / "two-column-mixed.pdf"
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            pages = [prepare_page(source, scratch, i) for i in range(1, 4)]
            self.assertEqual([0, 1, 1], [len(p.tasks) for p in pages])
            first = pages[1].tasks[0]
            repeat = prepare_page(source, scratch, 2).tasks[0]
            self.assertEqual(first.task_id, repeat.task_id)
            self.assertEqual(first.image.sha256, repeat.image.sha256)


if __name__ == "__main__":
    unittest.main()
