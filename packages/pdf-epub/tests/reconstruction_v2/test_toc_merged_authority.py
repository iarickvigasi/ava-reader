"""A merged folio still needs every original source authority and whole caller coverage."""

import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, NumberObject, TextStringObject

from .merged_toc_fixture import merged_fixture
from .test_pdf_links import box


class TocMergedAuthorityTests(unittest.TestCase):
    def test_changed_label_outline_destination_and_duplicate_outline_refuse(self):
        for mode in ("label", "outline", "destination", "duplicate"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                f = merged_fixture(Path(directory))
                writer = PdfWriter(clone_from=f.source)
                if mode == "label":
                    writer._root_object["/PageLabels"]["/Nums"][5][NameObject("/St")] = (
                        NumberObject(2)
                    )
                elif mode == "outline":
                    writer._root_object["/Outlines"]["/First"][NameObject("/Title")] = (
                        TextStringObject("Alpha")
                    )
                elif mode == "destination":
                    writer.pages[0]["/Annots"][0]["/A"]["/D"][0] = writer.pages[
                        4
                    ].indirect_reference
                else:
                    writer.add_outline_item("1 Alpha - beta continued", 3)
                writer.write(f.source)
                f.reader.close()
                f.reader = PdfReader(f.source)
                self.addCleanup(f.reader.close)
                f.annotation = f.reader.pages[0]["/Annots"][0].get_object()
                self.assertIsNone(f.prove())

    def test_missing_repeated_rows_partial_caller_and_folio_only_offsets(self):
        with tempfile.TemporaryDirectory() as directory:
            f = merged_fixture(Path(directory))
            self.addCleanup(f.reader.close)
            self.assertIsNone(f.prove(page=f.page.model_copy(update={"lines": f.page.lines[:-2]})))
            self.assertIsNone(f.prove(caller=box(6, 20, 108, 42)))
            self.assertEqual(
                [("wrapped", len(f.owners[0].text) - 1, len(f.owners[0].text))],
                f.prove(caller=box(104, 32, 108, 42)),
            )
