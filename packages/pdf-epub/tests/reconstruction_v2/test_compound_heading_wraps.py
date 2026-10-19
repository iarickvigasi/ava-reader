"""Wrapped subtitles remain one bounded consecutive source stream, not later matching prose."""

import tempfile
import unittest
from pathlib import Path

from .compound_heading_fixture import fixture, move_line
from .test_pdf_links import box


class CompoundHeadingWrapTests(unittest.TestCase):
    def test_complete_aligned_subtitle_wrap_with_bounded_gap(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            sub = f.page.lines[3]
            first = sub.model_copy(
                update={
                    "text": sub.text[:10],
                    "glyphs": sub.glyphs[:10],
                    "box": box(28, 36, 58, 44),
                }
            )
            last = sub.model_copy(
                update={
                    "id": "subtitle-wrap",
                    "text": sub.text[11:],
                    "glyphs": sub.glyphs[11:],
                    "box": box(61, 36, 94, 44),
                }
            )
            last = move_line(last, dx=-33, dy=12)
            f.page = f.page.model_copy(update={"lines": [*f.page.lines[:3], first, last]})
            f.owners = [f.owners[0].model_copy(update={"box": box(4, 10, 110, 100)})]
            self.assertEqual(("chapter", 0), f.resolve())
            for dx, dy in ((4, 0), (0, 35)):
                page = f.page.model_copy(
                    update={"lines": [*f.page.lines[:-1], move_line(last, dx, dy)]}
                )
                with (
                    self.subTest(dx=dx, dy=dy),
                    self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"),
                ):
                    f.resolve(page=page)
