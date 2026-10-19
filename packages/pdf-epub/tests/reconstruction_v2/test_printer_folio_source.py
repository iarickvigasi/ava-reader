"""Actual inclusive-table/footer source stays unchanged through strict source reconstruction."""

import hashlib
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    DictionaryObject,
    FloatObject,
    NameObject,
    NullObject,
    NumberObject,
    TextStringObject,
)

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.protocol import ReconstructionInput
from ava_pdf_epub.reconstruction_v2.reconstruct_source import reconstruct_source

from .printer_folio_pdf_fixture import prose_wrapper

SHEET = Path(__file__).parent / "fixtures" / "fx-table-20x8.pdf"


def convert(source, scratch):
    return reconstruct_source(
        source,
        scratch,
        ReconstructionInput(
            schema_version="ava-reconstruct-input-1",
            source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
            profile_id=BILINGUAL_PROFILE,
            responses=[],
        ),
    )[0]


class PrinterFolioSourceTests(unittest.TestCase):
    def test_same_table_page_all_160_cells_headers_and_observed_page_reference(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "prose.pdf"
            prose_wrapper(source, SHEET)
            self.assertEqual(
                PdfReader(SHEET).pages[0].get_contents().get_data(),
                PdfReader(source).pages[1].get_contents().get_data(),
            )
            result = convert(source, Path(tmp) / "scratch")
        book = result.book
        table = next(b for b in book.blocks if b.kind == "table")
        self.assertEqual((20, 8, 160), (table.row_count, table.column_count, len(table.cells)))
        for cell in table.cells:
            expected = (
                f"C{cell.column + 1}"
                if cell.row == 0
                else f"R{cell.row}"
                if cell.column == 0
                else f"{cell.row}.{cell.column + 1}"
            )
            self.assertEqual(expected, cell.content.text)
            expected_axis = (
                "both"
                if cell.row == cell.column == 0
                else "column"
                if cell.row == 0
                else "row"
                if cell.column == 0
                else None
            )
            self.assertEqual(expected_axis, cell.header_axis)
            if cell.row and cell.column:
                self.assertEqual(
                    [f"{table.id}-cell0-{cell.column}", f"{table.id}-cell{cell.row}-0"],
                    cell.header_ids,
                )
        self.assertEqual(["i", "1"], [p.label for p in book.pages])
        self.assertFalse(
            any(
                "Qualification print page" in getattr(b, "content", {}).text
                for b in book.blocks
                if hasattr(b, "content")
            )
        )
        ref = next(
            b for b in book.blocks if hasattr(b, "content") and "See page 1" in b.content.text
        )
        target = next(span.link for span in ref.content.spans if span.link)
        self.assertEqual(
            "FX-TABLE-20x8", next(b.content.text for b in book.blocks if b.id == target.block_id)
        )
        imported, assets = portable_epub(result.epub)
        self.assertEqual(book, imported)
        self.assertEqual(result.assets, assets)

    def test_genuine_external_internal_linked_printer_footer_and_malformed_target(self):
        for action in ["external", "internal", "invalid"]:
            with self.subTest(action=action), tempfile.TemporaryDirectory() as tmp:
                base = Path(tmp) / "base.pdf"
                prose_wrapper(base, SHEET)
                writer = PdfWriter(clone_from=str(base))
                annotation = DictionaryObject(
                    {
                        NameObject("/Type"): NameObject("/Annot"),
                        NameObject("/Subtype"): NameObject("/Link"),
                        NameObject("/Rect"): ArrayObject(
                            [FloatObject(v) for v in [207, 20, 297, 31]]
                        ),
                        NameObject("/Border"): ArrayObject(
                            [NumberObject(0), NumberObject(0), NumberObject(0)]
                        ),
                    }
                )
                if action == "external":
                    annotation[NameObject("/A")] = DictionaryObject(
                        {
                            NameObject("/S"): NameObject("/URI"),
                            NameObject("/URI"): TextStringObject("https://example.invalid/book"),
                        }
                    )
                else:
                    page = (
                        writer.pages[1].indirect_reference
                        if action == "internal"
                        else NumberObject(99)
                    )
                    annotation[NameObject("/Dest")] = ArrayObject(
                        [page, NameObject("/XYZ"), FloatObject(252), FloatObject(662), NullObject()]
                    )
                writer.add_annotation(1, annotation)
                source = Path(tmp) / "linked.pdf"
                writer.write(source)
                if action == "invalid":
                    with self.assertRaises(ValueError):
                        convert(source, Path(tmp) / "scratch")
                    continue
                result = convert(source, Path(tmp) / "scratch")
                footer = next(
                    b
                    for b in result.book.blocks
                    if hasattr(b, "content") and b.content.text == "Qualification print page 1"
                )
                links = [span.link for span in footer.content.spans if span.link]
                self.assertEqual(1, len(links))
                self.assertEqual(action, links[0].kind)
                if action == "external":
                    self.assertEqual("https://example.invalid/book", links[0].url)

    def test_standalone_numeric_source_keeps_its_independent_language_refusal(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError, "book language requires review"):
                convert(SHEET, Path(tmp))
