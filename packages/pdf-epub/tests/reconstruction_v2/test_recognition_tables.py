import copy
import unittest

from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.reconstruction_v2.recognition_tables import qualify_recognized_tables
from ava_pdf_epub.reconstruction_v2.segments import ObservedCell, Segment


def box(x0, y0, x1, y1):
    return Box(coordinate_space="page_points_top_left", x0=x0, y0=y0, x1=x1, y1=y1)


def source_table():
    rectangles = [box(0, 0, 20, 10), box(0, 10, 10, 20), box(10, 10, 20, 20)]
    segment = Segment(
        id="table",
        page=1,
        box=box(0, 0, 20, 20),
        kind="table",
        method="ocr",
        cells=[
            [ObservedCell(text="Header", box=rectangles[0], column_span=2, header_axis="column")],
            [
                ObservedCell(text="", box=rectangles[1]),
                ObservedCell(text="Value", box=rectangles[2]),
            ],
        ],
    )
    evidence = [
        {
            "box": segment.box.model_dump(),
            "cells": [
                {
                    "row": y,
                    "column": x,
                    "row_span": 1,
                    "column_span": span,
                    "box": rect.model_dump(),
                }
                for (y, x, span), rect in zip(
                    [(0, 0, 2), (1, 0, 1), (1, 1, 1)], rectangles, strict=True
                )
            ],
        }
    ]
    return evidence, segment


class RecognizedTableCoverageTests(unittest.TestCase):
    def test_exact_physical_blank_and_header_origins_are_preserved(self):
        evidence, segment = source_table()
        qualify_recognized_tables(evidence, [segment])
        self.assertEqual(segment.cells[1][0].text, "")
        self.assertEqual(segment.cells[1][1].text, "Value")

    def test_omitted_table_or_duplicated_match_is_refused(self):
        evidence, segment = source_table()
        for candidates in [[], [segment, segment.model_copy(update={"id": "other"})]]:
            with self.assertRaisesRegex(ValueError, "omitted or ambiguously"):
                qualify_recognized_tables(evidence, candidates)

    def test_wrong_physical_count_and_source_span_are_refused(self):
        evidence, segment = source_table()
        for change in [
            lambda e: e[0]["cells"].pop(),
            lambda e: e[0]["cells"][0].update(column_span=1),
        ]:
            changed = copy.deepcopy(evidence)
            change(changed)
            with self.assertRaises(ValueError):
                qualify_recognized_tables(changed, [segment])
