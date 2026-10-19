"""Declared normalized coordinates are converted once, never inferred from old output."""

import json
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse
from ava_pdf_epub.reconstruction_v2.recognition_segment import RecognitionSegment

from .recognition_task_fixture import task_fixture
from .response_fixtures import wire_segment


def response_for(task, segments):
    return RecognitionResponse(
        schema_version="ava-recognition-response-2",
        task_id=task.task_id,
        source_sha256=task.source_sha256,
        render_sha256=task.image.sha256,
        language="en",
        unresolved=[],
        segments=segments,
    )


class RecognitionCoordinates(unittest.TestCase):
    def test_whole_page_and_nonzero_crop_endpoints(self):
        for crop in [(0, 0, 504, 720), (100, 200, 300, 600)]:
            task = task_fixture(crop)
            source = accept_response(task, response_for(task, [wire_segment()]))[0]
            self.assertEqual((source.box.x0, source.box.y0, source.box.x1, source.box.y1), crop)
            self.assertEqual("page_points_top_left", source.box.coordinate_space)

    def test_nested_cells_use_same_crop_not_table_local_space(self):
        task = task_fixture()
        cell = dict(
            text="Cell",
            box=dict(coordinate_space="render_normalized_1000", x0=250, y0=250, x1=750, y1=750),
            style=None,
            header_axis="column",
            spans=[],
        )
        response = response_for(task, [wire_segment(kind="table", text="", cells=[[cell]])])
        source = accept_response(task, response)[0]
        self.assertEqual(
            (150, 300, 250, 500),
            tuple(getattr(source.cells[0][0].box, k) for k in ("x0", "y0", "x1", "y1")),
        )
        self.assertEqual(250, response.segments[0].cells[0][0].box.x0)

    def test_invalid_degenerate_and_mislabeled_boxes_refuse(self):
        for change in [
            dict(x0=-1),
            dict(x1=1001),
            dict(x0=1000),
            dict(y1=0),
            dict(x0=500, x1=500),
            dict(x1=float("nan")),
            dict(y1=float("inf")),
            dict(coordinate_space="page_points_top_left"),
            dict(coordinate_space="normalized_top_left"),
        ]:
            value = wire_segment()
            value["box"].update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                RecognitionSegment.model_validate(value)

    def test_exact_rejected_v1_receipt_is_not_reinterpreted(self):
        raw = json.loads((Path(__file__).parent / "fixtures/rejected-provider-v1.json").read_text())
        with self.assertRaises(ValueError):
            RecognitionResponse.model_validate(raw)
        self.assertEqual("page_points_top_left", raw["segments"][0]["box"]["coordinate_space"])
