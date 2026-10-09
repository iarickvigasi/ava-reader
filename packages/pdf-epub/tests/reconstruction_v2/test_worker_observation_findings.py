"""Source refusals preserve known coordinates and explicit diagnostic truncation."""

import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.admission_actions import AdmissionError
from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.reconstruction_v2.source_refusal import (
    SourceBlockingFinding,
    SourceContentRefusal,
    SourceRefusalDiagnostic,
)
from ava_pdf_epub.worker_observation_packet import PACKET_BYTES, PREFIX

from .test_worker_observation import emitted
from .worker_observation_fixture import observation_context


class WorkerFindingTests(unittest.TestCase):
    def test_source_findings_keep_bounded_original_geometry_and_report_partial_details(self):
        box = Box(coordinate_space="page_points_top_left", x0=1, y0=2, x1=3, y1=4)
        with tempfile.TemporaryDirectory() as directory:
            collector = observation_context(Path(directory))
            collector.failed(SourceContentRefusal(SourceRefusalDiagnostic(
                source_sha256=collector.job.source.sha256, stage="extraction", findings=[
                    SourceBlockingFinding(code="ESSENTIAL_STRUCTURE_UNSUPPORTED", page=number,
                                          box=box, region_box=box, block_id="safe-source-id",
                                          task_id="safe-task-id", render_sha256="a" * 64)
                    for number in (1, 2, 3)])))
            data = emitted(collector)
            packet = json.loads(data.strip().removeprefix(PREFIX))
            self.assertLessEqual(len(data.encode()), PACKET_BYTES)
            self.assertEqual(2, len(packet["findings"]))
            self.assertFalse(packet["findings_complete"])
            self.assertEqual(box.model_dump(), packet["findings"][0]["box"])
            self.assertEqual("blocking", packet["findings"][0]["severity"])

    def test_foreign_source_diagnostic_has_no_source_refusal_authority(self):
        box = Box(coordinate_space="page_points_top_left", x0=0, y0=0, x1=1, y1=1)
        with tempfile.TemporaryDirectory() as directory:
            collector = observation_context(Path(directory))
            collector.failed(SourceContentRefusal(SourceRefusalDiagnostic(
                source_sha256="b" * 64, stage="assembly", findings=[
                    SourceBlockingFinding(code="ESSENTIAL_STRUCTURE_UNSUPPORTED", page=1,
                                          box=box, region_box=box)])))
            packet = json.loads(emitted(collector).strip().removeprefix(PREFIX))
            self.assertEqual("RECONSTRUCTION_REVIEW_REQUIRED", packet["failure_code"])
            self.assertEqual([], packet["findings"])

    def test_invalid_relationship_values_are_never_exported_as_coordinates(self):
        with tempfile.TemporaryDirectory() as directory:
            collector = observation_context(Path(directory))
            collector.failed(AdmissionError("PDF_ANNOTATION_INVALID", finding=dict(
                page_number=1, annotation_number=1, relationship_path=["private value"])))
            data = emitted(collector)
            packet = json.loads(data.strip().removeprefix(PREFIX))
            self.assertEqual([], packet["findings"][0]["relationship_path"])
            self.assertFalse(packet["findings_complete"])
            self.assertNotIn("private value", data)
