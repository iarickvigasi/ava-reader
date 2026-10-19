"""A source-linked folio column is a specific layout witness, not a blanket column exemption."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.observations import Graphic

from .test_pdf_links import box
from .toc_caller_fixture import fixture


class TocCallerLayoutTests(unittest.TestCase):
    def test_missing_ambiguous_hidden_or_obscured_header_and_incomplete_rows_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            for mode in (
                "header",
                "double-header",
                "hidden-header",
                "graphic-header",
                "rows",
                "alignment",
                "baseline",
            ):
                page = f.page.model_copy(deep=True)
                if mode == "header":
                    page = page.model_copy(update={"lines": page.lines[1:]})
                elif mode == "double-header":
                    page.lines.append(page.lines[0].model_copy(update={"id": "header2"}))
                elif mode == "hidden-header":
                    page.lines[0].glyphs[0] = (
                        page.lines[0].glyphs[0].model_copy(update={"visible": False})
                    )
                elif mode == "graphic-header":
                    page = page.model_copy(
                        update={"graphics": [Graphic(kind="vector", box=page.lines[0].box)]}
                    )
                elif mode == "rows":
                    page = page.model_copy(update={"lines": page.lines[:-2]})
                elif mode == "alignment":
                    moved = box(80, 77, 84, 87)
                    glyph = page.lines[-1].glyphs[0].model_copy(update={"box": moved})
                    page.lines[-1] = page.lines[-1].model_copy(
                        update={"box": moved, "glyphs": [glyph]}
                    )
                elif mode == "baseline":
                    moved = box(104, 20, 108, 30)
                    glyph = page.lines[3].glyphs[0].model_copy(update={"box": moved})
                    page.lines[3] = page.lines[3].model_copy(
                        update={"box": moved, "glyphs": [glyph]}
                    )
                with self.subTest(mode=mode):
                    self.assertIsNone(f.prove(page=page))

    def test_second_wide_gap_in_title_and_non_numeric_prefix_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            for mode in ("second-gap", "letter", "oversized-gap"):
                page = f.page.model_copy(deep=True)
                owners = list(f.owners)
                first = page.lines[1]
                if mode == "second-gap":
                    for i, glyph in enumerate(first.glyphs[7:], start=7):
                        moved = glyph.box.model_copy(
                            update={"x0": glyph.box.x0 + 12, "x1": glyph.box.x1 + 12}
                        )
                        first.glyphs[i] = glyph.model_copy(update={"box": moved})
                elif mode == "letter":
                    first.glyphs[0] = first.glyphs[0].model_copy(update={"text": "A"})
                    page.lines[1] = first.model_copy(
                        update={"text": first.text.replace("1 ", "A ", 1)}
                    )
                    owners[0] = owners[0].model_copy(
                        update={"text": owners[0].text.replace("1 ", "A ", 1)}
                    )
                elif mode == "oversized-gap":
                    for i, glyph in enumerate(first.glyphs[1:], start=1):
                        moved = glyph.box.model_copy(
                            update={"x0": glyph.box.x0 + 35, "x1": glyph.box.x1 + 35}
                        )
                        first.glyphs[i] = glyph.model_copy(update={"box": moved})
                    page.lines[1] = first.model_copy(update={"box": box(4, 20, 103, 30)})
                with self.subTest(mode=mode):
                    self.assertIsNone(f.prove(page=page, owners=owners))
