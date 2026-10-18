"""Only the complete whitespace-delimited decimal token can own an ordinal tab."""

import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, TextStringObject

from .merged_toc_fixture import merged_fixture
from .test_pdf_links import box


class TocOrdinalTokenTests(unittest.TestCase):
    def test_contiguous_complete_ordinal_passes_internal_gap_and_reversed_digits_refuse(self):
        for mode in ("contiguous", "gap", "reversed"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                f = merged_fixture(Path(directory), single=True)
                page = f.page.model_copy(deep=True)
                source = page.lines[1]
                digit = source.glyphs[0].model_copy(
                    update={
                        "text": "2",
                        "box": box(14, 20, 18, 30) if mode == "gap" else box(8, 20, 12, 30),
                    }
                )
                if mode == "reversed":
                    digit = digit.model_copy(update={"box": box(0, 20, 4, 30)})
                page.lines[1] = source.model_copy(
                    update={
                        "text": source.text.replace("1 Alpha", "12 Alpha", 1),
                        "glyphs": [source.glyphs[0], digit, *source.glyphs[1:]],
                    }
                )
                owners = [
                    f.owners[0].model_copy(update={"text": "12 Alpha – beta 1"}),
                    *f.owners[1:],
                ]
                writer = PdfWriter(clone_from=f.source)
                writer._root_object["/Outlines"]["/First"][NameObject("/Title")] = TextStringObject(
                    "12 Alpha - beta"
                )
                writer.write(f.source)
                f.reader.close()
                f.reader = PdfReader(f.source)
                self.addCleanup(f.reader.close)
                f.annotation = f.reader.pages[0]["/Annots"][0].get_object()
                result = f.prove(page=page, owners=owners)
                if mode == "contiguous":
                    self.assertEqual([("wrapped", 0, len(owners[0].text))], result)
                else:
                    self.assertIsNone(result)
