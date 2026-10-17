"""Measured merged ownership must neither duplicate text nor invent missing cells."""

import unittest

from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.reconstruction_v2.observe_tables import TableObservation
from ava_pdf_epub.reconstruction_v2.table_grid import measured_table_grid


def box(x0: float, y0: float, x1: float, y1: float) -> Box:
    return Box(coordinate_space="page_points_top_left", x0=x0, y0=y0, x1=x1, y1=y1)


class MeasuredTableGridTests(unittest.TestCase):
    def test_merged_header_and_vertical_stub_have_one_owner(self) -> None:
        source = TableObservation(
            box=box(0, 0, 30, 30),
            cells=[
                [box(0, 0, 30, 10), None, None],
                [box(0, 10, 10, 30), box(10, 10, 20, 20), box(20, 10, 30, 20)],
                [None, box(10, 20, 20, 30), box(20, 20, 30, 30)],
            ],
            line_ids=[],
        )
        cells = measured_table_grid(source)
        self.assertEqual(len(cells), 6)
        self.assertEqual((cells[0].row_span, cells[0].column_span), (1, 3))
        self.assertEqual((cells[1].row_span, cells[1].column_span), (2, 1))
        self.assertEqual(sum(c.row_span * c.column_span for c in cells), 9)

    def test_missing_slot_does_not_become_empty_cell(self) -> None:
        source = TableObservation(
            box=box(0, 0, 20, 10), cells=[[box(0, 0, 10, 10), None]], line_ids=[]
        )
        with self.assertRaisesRegex(ValueError, "Uncovered"):
            measured_table_grid(source)

    def test_duplicate_and_overlapping_rectangles_are_refused(self) -> None:
        for cells in [
            [[box(0, 0, 20, 10), box(0, 0, 20, 10)]],
            [[box(0, 0, 15, 10), box(10, 0, 20, 10)]],
        ]:
            with self.subTest(cells=cells), self.assertRaisesRegex(ValueError, "Overlapping"):
                measured_table_grid(
                    TableObservation(box=box(0, 0, 20, 10), cells=cells, line_ids=[])
                )

    def test_grid_and_outer_bounds_remain_enforced(self) -> None:
        for outer, cells in [
            (box(0, 0, 10, 21), [[box(0, n, 10, n + 1)] for n in range(21)]),
            (box(0, 0, 10, 10), [[box(0, 0, 11, 10)]]),
        ]:
            with self.subTest(outer=outer), self.assertRaises(ValueError):
                measured_table_grid(TableObservation(box=outer, cells=cells, line_ids=[]))


if __name__ == "__main__":
    unittest.main()
