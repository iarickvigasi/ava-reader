"""Measured cells retain geometry while OCR supplies visible text and styles."""

import copy
import hashlib
import json
import unittest

from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse, RecognitionTask
from ava_pdf_epub.reconstruction_v2.recognition_fields import RecognitionCell
from ava_pdf_epub.reconstruction_v2.task_identity import task_identifier

from .recognition_task_fixture import task_fixture
from .response_fixtures import wire_segment
from .test_recognition_tables import source_table


def fixture(version="ava-prose-region-4"):
    evidence, source = source_table()
    raw = task_fixture((0, 0, 20, 20)).model_dump()
    cells = [cell for row in source.cells for cell in row]
    for i, cell in enumerate(evidence[0]["cells"]):
        cell["source_cell_id"] = f"p1-table0-cell{i}"
    native = json.dumps(dict(reliable=False, lines=[], ruled_tables=evidence))
    raw.update(
        native_evidence=native,
        native_evidence_sha256=hashlib.sha256(native.encode()).hexdigest(),
        prompt_version=version,
    )
    raw["task_id"] = task_identifier(raw)
    task = RecognitionTask.model_validate(raw)
    wire = []
    for original, cell in zip(evidence[0]["cells"], cells, strict=True):
        wire.append(
            dict(
                text=cell.text,
                box=None,
                source_cell_id=original["source_cell_id"],
                column_span=cell.column_span,
                style=None,
                header_axis=cell.header_axis,
                spans=[],
            )
        )
    response = dict(
        schema_version="ava-recognition-response-2",
        task_id=task.task_id,
        source_sha256=task.source_sha256,
        render_sha256=task.image.sha256,
        language="en",
        unresolved=[],
        segments=[wire_segment(kind="table", text="", cells=[wire[:1], wire[1:]])],
    )
    return task, response, source


class PinnedTableCells(unittest.TestCase):
    def test_blank_cells_and_merged_header_use_exact_measured_geometry(self):
        task, raw, source = fixture("ava-prose-region-6")
        result = accept_response(task, RecognitionResponse.model_validate(raw))[0]
        self.assertEqual(result.cells, source.cells)
        self.assertEqual(result.cells[1][0].text, "")
        self.assertGreater(result.cells[1][0].box.y1, result.cells[1][0].box.y0)
        self.assertEqual(raw["segments"][0]["cells"][1][0]["box"], None)

    def test_unknown_repeated_or_swapped_source_references_cannot_be_accepted(self):
        for replacement in ["unknown", "p1-table0-cell0", "p1-table0-cell2"]:
            task, raw, _ = fixture()
            raw["segments"][0]["cells"][1][0]["source_cell_id"] = replacement
            with self.subTest(replacement=replacement), self.assertRaises(ValueError):
                accept_response(task, RecognitionResponse.model_validate(raw))

    def test_old_tasks_cannot_reinterpret_pinned_references(self):
        for version in ["ava-prose-region-2", "ava-prose-region-3", "ava-prose-region-5"]:
            task, raw, _ = fixture(version)
            with self.subTest(version=version), self.assertRaises(ValueError):
                accept_response(task, RecognitionResponse.model_validate(raw))

    def test_geometry_requires_exactly_one_authority(self):
        _, raw, _ = fixture()
        cell = raw["segments"][0]["cells"][0][0]
        normalized = dict(coordinate_space="render_normalized_1000", x0=0, y0=0, x1=1000, y1=500)
        for change in [dict(box=normalized), dict(source_cell_id=None)]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                RecognitionCell.model_validate({**cell, **change})

    def test_wrong_span_or_out_of_text_style_is_refused_after_binding(self):
        for change in [
            dict(column_span=1),
            dict(
                spans=[
                    dict(start=0, end=99, style=None, note_label=None, target_text=None, url=None)
                ]
            ),
        ]:
            task, raw, _ = fixture()
            raw = copy.deepcopy(raw)
            raw["segments"][0]["cells"][0][0].update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                accept_response(task, RecognitionResponse.model_validate(raw))
