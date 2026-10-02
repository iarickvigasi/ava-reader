import unittest
import xml.etree.ElementTree as ET

from ava_pdf_epub.epub_v2.context import Context
from ava_pdf_epub.epub_v2.tables import render_table
from tests.contracts.test_table_spans import merged_table

from .helpers import fixture


class ExportTableSpanTests(unittest.TestCase):
    def test_selectable_merged_header_and_reference_attributes(self):
        book, _, _ = fixture()
        tree = render_table(merged_table(), {}, Context(book))
        cells = [n for n in tree.iter() if n.tag.endswith("td") or n.tag.endswith("th")]
        self.assertEqual(len(cells), 3)
        self.assertEqual(cells[0].get("colspan"), "2")
        self.assertTrue(all(cells[0].get("id") in c.get("headers", "") for c in cells[1:]))
        self.assertIn("Location", ET.tostring(tree, encoding="unicode"))

    def test_vertical_span_keeps_all_declared_rows(self):
        book, _, _ = fixture()
        table = merged_table()
        table = table.model_copy(update={
            "cells": [table.cells[0].model_copy(update={"row_span": 2})]
        })
        tree = render_table(table, {}, Context(book))
        self.assertEqual(len([n for n in tree.iter() if n.tag.endswith("tr")]), 2)
        self.assertEqual(next(n for n in tree.iter() if n.tag.endswith("th")).get("rowspan"), "2")

    def test_complete_generated_epub_round_trip_preserves_merged_graph(self):
        from ava_pdf_epub.contracts.book import CanonicalBookV2
        from ava_pdf_epub.epub_v2.export import export_epub
        from ava_pdf_epub.epub_v2.portable import portable_epub

        book, assets, _ = fixture()
        raw = book.model_dump(mode="json")
        raw["blocks"] = [
            merged_table().model_dump(mode="json") if b["id"] == "table-one" else b
            for b in raw["blocks"]
        ]
        raw["addresses"] = [a for a in raw["addresses"] if a["target"]["block_id"] != "cell-01"]
        expected = CanonicalBookV2.model_validate(raw)
        again, recovered = portable_epub(export_epub(expected, assets))
        self.assertEqual(again, expected)
        self.assertEqual(recovered, assets)
