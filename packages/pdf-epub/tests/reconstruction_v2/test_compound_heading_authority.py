"""The new same-owner exception requires one complete depth-zero original outline claim."""

import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, TextStringObject

from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.numbered_heading_map import numbered_heading_map

from .compound_heading_fixture import fixture


class CompoundHeadingAuthorityTests(unittest.TestCase):
    def test_missing_partial_changed_duplicate_wrong_page_or_nested_outline_refuses(self):
        for mode in ("missing", "partial", "changed", "duplicate", "page", "nested"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                f = fixture(Path(directory))
                writer = PdfWriter(clone_from=f.source)
                first = writer._root_object["/Outlines"]["/First"]
                title = str(first["/Title"])
                if mode == "missing":
                    del writer._root_object["/Outlines"]
                elif mode in ("partial", "changed"):
                    first[NameObject("/Title")] = TextStringObject(
                        title.split("with a")[0].strip() if mode == "partial" else title + " extra"
                    )
                elif mode == "duplicate":
                    writer.add_outline_item(title, 0)
                elif mode == "page":
                    first["/A"]["/D"][0] = writer.pages[1].indirect_reference
                else:
                    del writer._root_object["/Outlines"]
                    parent = writer.add_outline_item("Parent", 0)
                    writer.add_outline_item(title, 0, parent=parent)
                writer.write(f.source)
                f.reader = PdfReader(f.source)
                with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                    f.resolve()

    def test_foreign_target_page_url_and_noncurrent_policy_cannot_use_new_proof(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            for target, page, policy in (
                (replace(f.target, page=2), f.page, POLICY),
                (replace(f.target, url="https://example.org"), f.page, POLICY),
                (f.target, f.page, None),
                (f.target, f.page, "old"),
                (f.target, f.page.model_copy(update={"number": 2}), POLICY),
            ):
                with self.subTest(target=target, policy=policy):
                    self.assertIsNone(
                        numbered_heading_map(f.reader, target, page, f.owners[0], f.owners, policy)
                    )

    def test_no_reader_cannot_authorize_compound_target(self):
        from ava_pdf_epub.reconstruction_v2.ocr_glyph_target import ocr_glyph_target

        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                ocr_glyph_target(
                    f.page, f.page.lines[0], f.owners, -10, -5, POLICY, source_target=f.target
                )
