"""Independent table-cell oracles prevent cross-cell style or link corruption."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.annotation_coverage import annotation_coverage
from ava_pdf_epub.reconstruction_v2.annotation_scan_spans import scanned_marks
from ava_pdf_epub.reconstruction_v2.annotation_spans import apply_annotation_spans
from ava_pdf_epub.reconstruction_v2.annotation_words import ERROR, AnnotationWord
from ava_pdf_epub.reconstruction_v2.segments import ObservedCell, ObservedSpan, Segment

from .test_annotation_scan_spans import box, observation, source


def table():
    return Segment(
        id="table",
        page=1,
        kind="table",
        method="ocr",
        box=box(),
        cells=[
            [
                ObservedCell(
                    text="Source   book",
                    box=box(0, 0, 50, 20),
                    header_axis="column",
                    spans=[
                        ObservedSpan(
                            start=9,
                            end=13,
                            url="https://example.org/book",
                            style=Style(id="bold", bold=True),
                        )
                    ],
                ),
                ObservedCell(text="stays.", box=box(50, 0, 100, 20)),
            ]
        ],
    )


class ScannedTableAnnotationTests(unittest.TestCase):
    def test_one_printed_line_maps_to_cell_offsets_without_crossing_boundary(self):
        region, words, image, _ = source()
        marks = scanned_marks(observation(region), [table()], region, words, image)
        self.assertEqual({(0, 0)}, {target.cell for target, _ in marks})
        self.assertEqual(
            set(range(13)), {i for _, span in marks for i in range(span.start, span.end)}
        )
        self.assertTrue(all(target.text == "Source   book" for target, _ in marks))

    def test_style_across_cells_maps_independent_offsets_without_intercell_gap(self):
        region, words, image, _ = source()
        region = region.model_copy(
            update={
                "box": box(0, 0, 100, 20),
                "style": Style(id="stroke", underline=True, decoration_color="#0000ff"),
            }
        )
        marks = scanned_marks(observation(region), [table()], region, words, image)
        positions = {}
        for target, span in marks:
            positions.setdefault(target.cell, set()).update(range(span.start, span.end))
        self.assertEqual({(0, 0): set(range(13)), (0, 1): set(range(6))}, positions)

    def test_identical_cell_text_is_disambiguated_by_source_geometry(self):
        region, _, image, _ = source()
        words = [
            AnnotationWord((1, 1, 1), 1, "Same", 96, box(2, 3, 20, 17)),
            AnnotationWord((1, 1, 1), 2, "Same", 96, box(55, 3, 80, 17)),
        ]
        segment = table().model_copy(
            update={
                "cells": [
                    [
                        ObservedCell(text="Same", box=box(0, 0, 50, 20)),
                        ObservedCell(text="Same", box=box(50, 0, 100, 20)),
                    ]
                ]
            }
        )
        marks = scanned_marks(observation(region), [segment], region, words, image)
        self.assertEqual([(0, 0)], [target.cell for target, _ in marks])

    def test_ambiguous_overlapping_cells_and_partial_word_cell_box_require_review(self):
        region, words, image, _ = source()
        for cells in [
            [
                [
                    ObservedCell(text="Source book", box=box(0, 0, 50, 20)),
                    ObservedCell(text="Source book", box=box(0, 0, 50, 20)),
                ]
            ],
            [
                [
                    ObservedCell(text="Source book", box=box(0, 0, 35, 20)),
                    ObservedCell(text="stays.", box=box(35, 0, 100, 20)),
                ]
            ],
        ]:
            with self.subTest(cells=cells), self.assertRaisesRegex(ValueError, ERROR):
                scanned_marks(
                    observation(region),
                    [table().model_copy(update={"cells": cells})],
                    region,
                    words,
                    image,
                )

    def test_apply_preserves_cell_link_emphasis_header_text_and_unmarked_neighbor(self):
        region, words, image, _ = source()
        original = table()
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            image.save(scratch / "render.png")
            with patch(
                "ava_pdf_epub.reconstruction_v2.annotation_spans.recognize_annotation_words",
                return_value=words,
            ):
                result = apply_annotation_spans(observation(region), [original], scratch)[0]
        left, right = result.cells[0]
        self.assertEqual("Source   book", left.text)
        self.assertEqual("column", left.header_axis)
        self.assertTrue(all(span.style.background_color == "#ffff00" for span in left.spans))
        linked = [span for span in left.spans if span.url]
        self.assertEqual(
            [(9, 13, "https://example.org/book")],
            [(span.start, span.end, span.url) for span in linked],
        )
        self.assertTrue(linked[0].style.bold)
        self.assertEqual(original.cells[0][1], right)
        self.assertEqual(1, len(original.cells[0][0].spans))
        self.assertIsNone(original.cells[0][0].spans[0].style.background_color)

    def test_coverage_counts_local_cell_text_but_not_an_unmarked_neighbor(self):
        region, _, _, _ = source()
        evidence = {"required_regions": [region.model_dump()]}
        annotation_coverage(evidence, [table()])
        changed = table().model_copy(
            update={
                "cells": [
                    [
                        ObservedCell(text="", box=box(0, 0, 50, 20)),
                        ObservedCell(text="Neighbor text", box=box(50, 0, 100, 20)),
                    ]
                ]
            }
        )
        with self.assertRaisesRegex(ValueError, "omitted a required"):
            annotation_coverage(evidence, [changed])
