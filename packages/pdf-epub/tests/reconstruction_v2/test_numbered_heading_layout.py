"""An ordinal tab cannot hide a title-column crossing or a distant subtitle."""

import tempfile
import unittest
from pathlib import Path

from .numbered_heading_fixture import fixture
from .test_pdf_links import box


class NumberedHeadingLayoutTests(unittest.TestCase):
    def test_broken_prefix_alignment_second_tab_and_distant_subtitle_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            for mode in (
                "prefix",
                "baseline",
                "second-gap",
                "indent",
                "wide-tab",
                "distant-subtitle",
            ):
                page = f.page.model_copy(deep=True)
                owners = list(f.owners)
                if mode == "prefix":
                    page.lines[0].glyphs[0] = (
                        page.lines[0].glyphs[0].model_copy(update={"text": "A"})
                    )
                    page.lines[0] = page.lines[0].model_copy(update={"text": "A"})
                    owners[0] = owners[0].model_copy(
                        update={"text": owners[0].text.replace("5 ", "A ")}
                    )
                elif mode == "baseline":
                    moved = box(4, 14, 8, 24)
                    page.lines[0].glyphs[0] = (
                        page.lines[0].glyphs[0].model_copy(update={"box": moved})
                    )
                    page.lines[0] = page.lines[0].model_copy(update={"box": moved})
                else:
                    indices = (
                        [1]
                        if mode == "second-gap"
                        else [2]
                        if mode == "indent"
                        else [1, 2]
                        if mode == "wide-tab"
                        else [3]
                    )
                    for index in indices:
                        item = page.lines[index]
                        dx, dy = (0, 19) if mode == "distant-subtitle" else (10, 0)
                        glyphs = [
                            g.model_copy(
                                update={
                                    "box": g.box.model_copy(
                                        update={
                                            "x0": g.box.x0 + dx,
                                            "x1": g.box.x1 + dx,
                                            "y0": g.box.y0 + dy,
                                            "y1": g.box.y1 + dy,
                                        }
                                    )
                                }
                            )
                            if mode != "second-gap" or i >= 8
                            else g
                            for i, g in enumerate(item.glyphs)
                        ]
                        moved = item.box.model_copy(
                            update={
                                "x0": item.box.x0 + dx,
                                "x1": item.box.x1 + dx,
                                "y0": item.box.y0 + dy,
                                "y1": item.box.y1 + dy,
                            }
                        )
                        page.lines[index] = item.model_copy(update={"box": moved, "glyphs": glyphs})
                        if mode == "distant-subtitle":
                            owners[1] = owners[1].model_copy(update={"box": moved})
                    if mode == "wide-tab":
                        owners[0] = owners[0].model_copy(update={"box": box(4, 10, 94, 32)})
                with self.subTest(mode=mode), self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                    f.resolve(page=page, owners=owners)
