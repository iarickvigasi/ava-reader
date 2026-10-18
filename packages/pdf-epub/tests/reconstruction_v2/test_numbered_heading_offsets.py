"""A header layout witness preserves actual later-line and subtitle destinations."""

import tempfile
import unittest
from pathlib import Path

from .numbered_heading_fixture import fixture


class NumberedHeadingOffsetTests(unittest.TestCase):
    def test_float_noise_only_and_later_source_line_offsets_remain_exact(self):
        from ava_pdf_epub.pdf_navigation import NavigationTarget

        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            page = f.page.model_copy(deep=True)
            glyph = page.lines[0].glyphs[0]
            page.lines[0].glyphs[0] = glyph.model_copy(
                update={"size": glyph.size + 0.0000000000001}
            )
            self.assertEqual(("chapter", 0), f.resolve(page=page))
            self.assertEqual(
                ("chapter", 2), f.resolve(target=NavigationTarget(page=1, left=20, top=90))
            )
            self.assertEqual(
                ("chapter", f.owners[0].text.index("at dusk")),
                f.resolve(target=NavigationTarget(page=1, left=20, top=78)),
            )
            self.assertEqual(
                ("subtitle", 0), f.resolve(target=NavigationTarget(page=1, left=28, top=64))
            )
