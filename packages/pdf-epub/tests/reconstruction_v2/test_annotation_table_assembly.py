"""True scanned table with real local OCR; transcription is an independent authored oracle."""

import tempfile
import unittest
from pathlib import Path

from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
)

from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from tests.admission.appearance_fixture import passive_document
from tests.admission.scan_fixture import scan_first_page

from .response_fixtures import wire_segment

CELL_TEXT = [["The book", "Source words"], ["Native reader", "Source stays"]]


def scanned_table_source(scratch):
    document = passive_document("/Underline")
    document.pages[0]["/Resources"]["/Font"][NameObject("/F2")] = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica-Bold"),
        }
    )
    stream = DecodedStreamObject()
    stream.set_data(
        b"q 0 G 0.5 w 20 180 265 90 re S 150 180 m 150 270 l S "
        b"20 225 m 285 225 l S Q BT /F2 14 Tf 26 250 Td (The book) Tj "
        b"140 0 Td (Source words) Tj ET BT /F1 14 Tf 26 205 Td "
        b"(Native reader) Tj 140 0 Td (Source stays) Tj ET"
    )
    document.pages[0][NameObject("/Contents")] = document._add_object(stream)
    annotation = document.pages[0]["/Annots"][0].get_object()
    annotation[NameObject("/Rect")] = ArrayObject([NumberObject(n) for n in [24, 244, 90, 263]])
    annotation[NameObject("/QuadPoints")] = ArrayObject(
        [NumberObject(n) for n in [24, 263, 90, 263, 24, 244, 90, 244]]
    )
    appearance = annotation["/AP"]["/N"].get_object()
    appearance[NameObject("/BBox")] = ArrayObject([NumberObject(n) for n in [0, 0, 66, 19]])
    appearance.set_data(b"q 0 0 1 RG 1 w 0 1 m 66 1 l S Q")
    return scan_first_page(document, scratch)


def table_response(task):
    table_box = dict(coordinate_space="page_points_top_left", x0=20, y0=130, x1=285, y1=220)
    cells = []
    for row, texts in enumerate(CELL_TEXT):
        cells.append([])
        for column, text in enumerate(texts):
            cell_box = dict(
                coordinate_space="page_points_top_left",
                x0=20 if column == 0 else 150,
                x1=150 if column == 0 else 285,
                y0=130 + row * 45,
                y1=175 + row * 45,
            )
            wire_box = wire_segment(task, box=cell_box)["box"]
            cells[-1].append(
                dict(
                    text=text,
                    box=wire_box,
                    style={"id": "header", "bold": True, "family": "sans-serif"}
                    if row == 0
                    else None,
                    header_axis="column" if row == 0 else None,
                    spans=[],
                )
            )
    return RecognitionResponse.model_validate(
        dict(
            schema_version="ava-recognition-response-2",
            task_id=task.task_id,
            source_sha256=task.source_sha256,
            render_sha256=task.image.sha256,
            language="en",
            unresolved=[],
            segments=[
                wire_segment(task, id="table", kind="table", text="", box=table_box, cells=cells)
            ],
        )
    )


@unittest.skipUnless(Path("/usr/bin/tesseract").is_file(), "Requires packaged OCR worker")
class InstalledScannedTableAnnotations(unittest.TestCase):
    def test_underlined_cell_is_selectable_and_round_trips_without_styling_neighbors(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = scanned_table_source(scratch)
            pages = [prepare_page(source, scratch, number) for number in (1, 2)]
            self.assertFalse(pages[0].observation.lines)
            self.assertEqual(1, len(pages[0].tasks))
            response = table_response(pages[0].tasks[0])
            result = reconstruct(source, scratch, pages, [response])
            table = next(block for block in result.book.blocks if block.kind == "table")
            self.assertEqual(
                CELL_TEXT,
                [
                    [
                        next(
                            cell.content.text
                            for cell in table.cells
                            if cell.row == row and cell.column == column
                        )
                        for column in range(2)
                    ]
                    for row in range(2)
                ],
            )
            styles = {style.id: style for style in result.book.styles}
            selected = next(cell.content for cell in table.cells if cell.row == cell.column == 0)
            positions = {
                i
                for span in selected.spans
                if styles[span.style_id].underline
                for i in range(span.start, span.end)
            }
            self.assertEqual(set(range(8)), positions)
            self.assertTrue(
                all(
                    styles[span.style_id].decoration_color == "#0000ff"
                    for span in selected.spans
                    if styles[span.style_id].underline
                )
            )
            for cell in table.cells:
                if (cell.row, cell.column) != (0, 0):
                    self.assertFalse(
                        any(styles[span.style_id].underline for span in cell.content.spans)
                    )
            self.assertEqual(result.book, portable_epub(result.epub)[0])
