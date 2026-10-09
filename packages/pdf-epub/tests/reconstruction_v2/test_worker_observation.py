"""Packet identity, source refusal safety and instrumentation isolation."""

import hashlib
import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from ava_pdf_epub.admission_actions import AdmissionError
from ava_pdf_epub.worker_observation import ACTIVE, Observation, phase
from ava_pdf_epub.worker_observation_packet import PACKET_BYTES, PREFIX

from .worker_observation_fixture import observation_context


def emitted(observation):
    output = io.StringIO()
    with redirect_stderr(output):
        observation.finish()
    return output.getvalue()


class WorkerObservationTests(unittest.TestCase):
    def test_bound_packet_matches_actual_request_and_inclusive_failed_work(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            request = dict(mode="prepare", page_number=2)
            observation = observation_context(root, request=request)
            with self.assertRaisesRegex(ValueError, "private source"):
                with phase("prepare_source"):
                    raise ValueError("private source")
            observation.failed(ValueError("private source"))
            data = emitted(observation)
            packet = json.loads(data.strip().removeprefix(PREFIX))
            self.assertLessEqual(len(data.encode()), PACKET_BYTES)
            self.assertEqual(hashlib.sha256(json.dumps(request).encode()).hexdigest(),
                             packet["binding"]["request_sha256"])
            self.assertEqual("reconstruction_request_json_bytes", packet["request_binding_scope"])
            self.assertNotEqual(observation.job.request_sha256, packet["binding"]["request_sha256"])
            self.assertEqual(("unit-fixture", 2, "failed"),
                             (packet["binding"]["unit_id"], packet["page_number"], packet["outcome"]))
            work = packet["phases"][0]
            self.assertEqual(work["work_ms"], work["ended_ms"] - work["started_ms"])
            self.assertLessEqual(work["ended_ms"], packet["work_ms"])
            self.assertEqual("failed", work["outcome"])
            self.assertEqual("main_command_excludes_interpreter_startup_and_observation_export",
                             packet["work_scope"])
            self.assertEqual("worker_process_local_decode_and_annotation_memo",
                             packet["reuse"]["scope"])
            self.assertNotIn("private source", data)
            self.assertNotIn("owner-fixture", data)
            self.assertIsNone(ACTIVE.get())

    def test_missing_or_invalid_trusted_context_omits_packet(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            observation = observation_context(root)
            emitted(observation)
            for invalid in (None, dict(schema_version="ava-worker-observation-binding-1",
                                       job_id="../private", attempt_id="attempt", unit_id="unit")):
                (root / "worker-observation.json").unlink(missing_ok=True)
                if invalid is not None:
                    (root / "worker-observation.json").write_text(json.dumps(invalid))
                current = Observation(root)
                current.start(b'{"mode":"prepare"}', {"mode": "prepare"}, root)
                self.assertEqual("", emitted(current))

    def test_known_admission_coordinates_survive_without_arbitrary_diagnostic_data(self):
        with tempfile.TemporaryDirectory() as directory:
            observation = observation_context(Path(directory))
            observation.failed(AdmissionError("PDF_ANNOTATIONS_UNSUPPORTED", finding=dict(
                page_number=3, annotation_number=4, relationship_path=["/Parent", "/Popup"],
                contents="private annotation", filename="private.pdf")))
            data = emitted(observation)
            packet = json.loads(data.strip().removeprefix(PREFIX))
            self.assertEqual(dict(kind="admission", code="PDF_ANNOTATIONS_UNSUPPORTED", page=3,
                                  annotation_number=4, relationship_path=["/Parent", "/Popup"]),
                             packet["findings"][0])
            self.assertNotIn("private", data)

    def test_metric_failure_does_not_change_the_conversion_exception(self):
        with tempfile.TemporaryDirectory() as directory:
            observation = observation_context(Path(directory))
            page = SimpleNamespace(source_sha256=observation.job.source.sha256,
                                   profile_id=observation.job.profile_id)
            with patch.object(observation.inventory, "page", side_effect=RuntimeError("metrics")):
                observation.record("page", page)
            self.assertEqual("", emitted(observation))
