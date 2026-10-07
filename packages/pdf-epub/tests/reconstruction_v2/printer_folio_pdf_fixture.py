"""Authored English context surrounds an unchanged existing inclusive-table sheet."""

from pathlib import Path

from pdfminer.fontmetrics import FONT_METRICS
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

TITLE = "The Inclusive Table Notebook"
CHAPTER = "1. The Table Boundary"
SHEET_TITLE = "FX-TABLE-20x8"
LINES = [
    "The keeper opens the notebook and checks every value in the table before reading the story.",
    "Each printed row and column has its own name, so the numbers stay connected to their headers.",
    "The first row names all eight columns and the first column names the nineteen remaining rows.",
    "A reader can follow each value across the sheet without losing the meaning of the source.",
    "This table belongs to an English prose book and remains original selectable source content.",
    "The table is not a picture of guessed numbers and its blank space "
    "does not hide an omitted cell.",
    "The book keeps the same original table page, including its printed footer "
    "and its own caption.",
    "The introduction gives the table a clear reading context without changing any of its values.",
    "The keeper returns to the prose after checking the complete inclusive boundary "
    "of the profile.",
    "Every header relationship matters when the type becomes larger or the reading window narrows.",
    "See page 1 for the table.",
]


def prose_wrapper(path: Path, sheet: Path) -> None:
    writer = PdfWriter()
    page = writer.add_blank_page(width=504, height=720)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
    )
    widths = FONT_METRICS["Helvetica"][1]

    def centered(text, size, y):
        width = sum(widths[c] for c in text) * size / 1000
        return (text, size, (504 - width) / 2, y)

    rows = [
        centered(TITLE, 24, 677),
        centered("AVA Fixture Studio / English / 2026-09-28", 8, 645),
        centered(CHAPTER, 18, 600),
        *[(text, 10, 48, 550 - index * 28) for index, text in enumerate(LINES)],
        centered("i", 8, 24),
    ]
    stream = DecodedStreamObject()
    stream.set_data(
        "\n".join(
            f"BT /F1 {size} Tf {x} {y} Td ({text}) Tj ET" for text, size, x, y in rows
        ).encode()
    )
    page[NameObject("/Contents")] = writer._add_object(stream)
    writer.add_page(PdfReader(sheet).pages[0])
    writer.add_outline_item(CHAPTER, 0)
    writer.add_outline_item(SHEET_TITLE, 1)
    writer.add_metadata({"/Title": TITLE, "/Author": "AVA Fixture Studio"})
    writer.write(path)
