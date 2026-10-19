import copy
import unittest

from ava_pdf_epub.contracts.blocks import TableBlock
from ava_pdf_epub.contracts.graph_structure import validate_tables

from .helpers import block, fixture


def merged_table():
    raw = copy.deepcopy(block(fixture(), "table-one"))
    raw["cells"].pop(1)
    raw["cells"][0].update(column_span=2, header_axis="column")
    for cell in raw["cells"]:
        cell["header_ids"] = []
    # Independently authored relationships: merged column heading covers both
    # body columns; the left body header additionally covers its own row.
    for data, headers in zip(raw["cells"], [[], ["cell-00"], ["cell-00", "cell-10"]], strict=True):
        data["header_ids"] = headers
    return TableBlock.model_validate(raw)


class TableSpanTests(unittest.TestCase):
    def test_merged_header_covers_both_body_columns(self):
        table = merged_table()
        validate_tables({table.id: table})
        self.assertEqual(len(table.cells), 3)
        self.assertTrue(all("cell-00" in c.header_ids for c in table.cells[1:]))
        self.assertEqual(table, TableBlock.model_validate_json(table.model_dump_json()))

    def test_regular_cells_omit_default_spans(self):
        table = TableBlock.model_validate(block(fixture(), "table-one"))
        for cell in table.model_dump()["cells"]:
            self.assertNotIn("row_span", cell)
            self.assertNotIn("column_span", cell)
        validate_tables({table.id: table})

    def test_overlaps_holes_overflow_and_wrong_headers_fail(self):
        for change in [
            lambda t: t["cells"][0].update(row_span=2),
            lambda t: t["cells"][0].update(column_span=1),
            lambda t: t["cells"][0].update(column_span=3),
            lambda t: t["cells"][2]["header_ids"].remove("cell-00"),
        ]:
            raw = merged_table().model_dump()
            change(raw)
            table = TableBlock.model_validate(raw)
            with self.assertRaises(ValueError):
                validate_tables({table.id: table})

    def test_row_span_covers_empty_origin_row(self):
        table = merged_table()
        raw = table.model_dump()
        raw["cells"] = raw["cells"][:1]
        raw["cells"][0]["row_span"] = 2
        table = TableBlock.model_validate(raw)
        validate_tables({table.id: table})
