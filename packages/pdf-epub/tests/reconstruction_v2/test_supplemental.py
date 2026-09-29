"""Selected independently authored style/note/metadata/source-composite qualification cases."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.protocol import ReconstructionInput
from ava_pdf_epub.reconstruction_v2.reconstruct_source import reconstruct_source

FIXTURES = Path(__file__).parent / "fixtures"


def convert(name):
    source = FIXTURES / f"{name}.pdf"
    with tempfile.TemporaryDirectory() as directory:
        return reconstruct_source(
            source,
            Path(directory),
            ReconstructionInput(
                schema_version="ava-reconstruct-input-1",
                source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                responses=[],
            ),
        )[0]


class SupplementalTests(unittest.TestCase):
    def test_crosspage_note_numbering_smallcaps_composite_and_metadata(self):
        result = convert("supplemental")
        book = result.book
        oracle = json.loads((FIXTURES / "supplemental-oracle.json").read_text())
        notes = [block for block in book.blocks if block.kind == "note"]
        self.assertEqual(
            [n["joined_text"] for n in oracle["notes"]], [n.content.text for n in notes]
        )
        self.assertEqual([3, 5], [group.start for group in book.lists])
        text = [
            b
            for b in book.blocks
            if hasattr(b, "content") and b.content.text == oracle["small_caps"]["text"]
        ]
        self.assertEqual(2, len(text))
        styles = {style.id: style for style in book.styles}
        self.assertTrue(
            any(
                styles[span.style_id].small_caps
                for b in text
                for span in b.content.spans
                if span.style_id
            )
        )
        self.assertEqual(1, len(book.resources))
        figure = next(b for b in book.blocks if b.kind == "figure")
        box = figure.evidence[0].box
        # Authored raster starts at x=64; circle reaches x=401 with a 3pt stroke.
        # The reference crop includes optional whitespace, not required figure ink.
        self.assertLessEqual(box.x0, 64)
        self.assertGreaterEqual(box.x1, 402.5)
        accepted = {(m.field, m.value) for m in book.metadata if m.status == "accepted"}
        for field, value in [
            ("title", "Atlas Supplements"),
            ("contributor", "F. Sample"),
            ("contributor", "E. Example"),
            ("edition", "fixture edition 1"),
            ("date", "2026-09-28"),
            ("identifier", "9780000000002"),
        ]:
            self.assertIn((field, value), accepted)
        self.assertTrue(
            any(m.value == "9780000000019" and m.status == "candidate" for m in book.metadata)
        )

    def test_inherited_resets_spacing_table_headers_and_metadata(self):
        result = convert("qualification")
        book = result.book
        oracle = json.loads((FIXTURES / "qualification-oracle.json").read_text())
        blocks = {b.content.text: b for b in book.blocks if hasattr(b, "content")}
        styles = {style.id: style for style in book.styles}
        for expected in oracle["style_blocks"]:
            self.assertTrue(expected["text"] in blocks, expected["id"])
            style = styles[blocks[expected["text"]].style_id]
            self.assertEqual(expected["style"]["bold"], style.bold)
            self.assertEqual(expected["style"]["family_role"], style.family)
            self.assertAlmostEqual(
                expected["style"]["line_height_em"], style.line_height, delta=0.02
            )
            self.assertAlmostEqual(
                expected["style"]["first_line_indent_em"], style.indent_em, delta=0.02
            )
        tables = [b for b in book.blocks if b.kind == "table"]
        self.assertEqual(3, len(tables))
        for expected, table in zip(oracle["tables"], tables, strict=True):
            self.assertEqual(
                [text for row in expected["matrix"] for text in row],
                [cell.content.text for cell in table.cells],
            )
            for cell in table.cells:
                row = cell.row in expected["header_rows"]
                col = cell.column in expected["header_columns"]
                self.assertEqual(
                    "both" if row and col else "column" if row else "row" if col else None,
                    cell.header_axis,
                )
            self.assertIsNotNone(table.caption_id)
        accepted = {(m.field, m.value) for m in book.metadata if m.status == "accepted"}
        for field, key in [
            ("subtitle", "subtitle"),
            ("rights", "rights_statement"),
            ("language", "language"),
        ]:
            self.assertIn((field, oracle["metadata"][key]), accepted)


if __name__ == "__main__":
    unittest.main()
