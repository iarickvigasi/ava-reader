"""Original complete title/page and immediate subtitle identity cannot be replaced by a prefix."""

import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, TextStringObject

from .numbered_heading_fixture import fixture
from .test_ocr_link_context import line


class NumberedHeadingAuthorityTests(unittest.TestCase):
    def test_missing_partial_changed_duplicate_or_wrong_page_outline_refuses(self):
        for mode in ("missing", "partial", "changed", "duplicate", "page"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                f = fixture(Path(directory))
                writer = PdfWriter(clone_from=f.source)
                first = writer._root_object["/Outlines"]["/First"]
                if mode == "missing":
                    del writer._root_object["/Outlines"]
                elif mode == "partial":
                    first[NameObject("/Title")] = TextStringObject("5 Rivers and roads")
                elif mode == "changed":
                    first[NameObject("/Title")] = TextStringObject(
                        "5 Rivers and roads at dusk - extra"
                    )
                elif mode == "duplicate":
                    writer.add_outline_item(str(first["/Title"]), 0)
                elif mode == "page":
                    first["/A"]["/D"][0] = writer.pages[1].indirect_reference
                writer.write(f.source)
                f.reader = PdfReader(f.source)
                with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                    f.resolve()

    def test_omitted_changed_or_intervening_subtitle_never_borrows_later_text(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            cases = [
                [f.owners[0], f.owners[-1]],
                [f.owners[0], f.owners[-1], f.owners[1]],
                [
                    f.owners[0],
                    f.owners[1].model_copy(update={"text": "quiet brіdges"}),
                    f.owners[-1],
                ],
                [f.owners[0], f.owners[1].model_copy(update={"kind": "paragraph"}), f.owners[-1]],
            ]
            for owners in cases:
                with (
                    self.subTest(ids=[o.id for o in owners]),
                    self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"),
                ):
                    f.resolve(owners=owners)
            page = f.page.model_copy(
                update={
                    "lines": [
                        *f.page.lines[:3],
                        line("intervening", "X", 100, 33),
                        *f.page.lines[3:],
                    ]
                }
            )
            with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                f.resolve(page=page)

    def test_model_heading_role_alone_cannot_authorize_a_different_block(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            for update in (
                {"kind": "paragraph"},
                {"chapter_start": False},
                {"heading_level": 2},
                {"chapter_role": "frontmatter"},
            ):
                owners = [f.owners[0].model_copy(update=update), *f.owners[1:]]
                with (
                    self.subTest(update=update),
                    self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"),
                ):
                    f.resolve(owners=owners)
