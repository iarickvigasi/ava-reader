"""Raster review never removes source layout barriers before native typography is measured."""

import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page

from .raster_region_fixture import authored_mixed
from .test_raster_text import text_image


class RasterLayoutBarriers(unittest.TestCase):
    def test_offset_and_spanning_column_region_preserve_all_native_observations(self) -> None:
        for layout in ["offset", "columns"]:
            with self.subTest(layout=layout), tempfile.TemporaryDirectory() as directory:
                scratch = Path(directory)
                text = text_image(["The complete raster passage.", "One more source line."])
                picture = Image.new("L", text.size, "white")
                ImageDraw.Draw(picture).rectangle((20, 10, 180, 65), fill="black")
                pages = []
                for name, image in [("text", text), ("picture", picture)]:
                    source = scratch / (name + ".pdf")
                    authored_mixed(source, image, layout=layout)
                    pages.append(prepare_page(source, scratch, 1, BILINGUAL_PROFILE))
                self.assertEqual(1, len(pages[0].tasks))
                self.assertEqual([], pages[1].tasks)
                native = [s for s in pages[1].native_segments if s.kind != "figure"]
                self.assertEqual(native, pages[0].native_segments)
                self.assertTrue(all(s.style.block_indent_em is None for s in native if s.style))
