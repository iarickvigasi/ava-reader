"""The actual join guard emits finite provenance, without private book/style values."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.reconstruction_v2.continuation_presentation_response import (
    presentation_projection,
)
from ava_pdf_epub.reconstruction_v2.join_typography_refusal import JoinTypographyRefusal
from ava_pdf_epub.reconstruction_v2.refinement_contract import RefinementStyle
from ava_pdf_epub.worker_observation_packet import PACKET_BYTES, PREFIX, failure

from .test_continuation_presentation import fixture
from .test_worker_observation import emitted
from .worker_observation_fixture import observation_context


def refused():
    task, response = fixture()
    choice = response.presentations[0].model_copy(update={"candidate_id": None, "evidence_ids": []})
    decision = response.decisions[0].model_copy(
        update={
            "style": RefinementStyle(id="observed", relative_size=1, bold=False, line_height=1.25)
        }
    )
    response = response.model_copy(update={"presentations": [choice], "decisions": [decision]})
    before = document_digest(task), document_digest(response)
    try:
        presentation_projection(task, response)
    except JoinTypographyRefusal as error:
        assert before == (document_digest(task), document_digest(response))
        return task, error
    raise AssertionError("Incompatible ordinary join was accepted")


class JoinTypographyTests(unittest.TestCase):
    def test_real_guard_retains_refusal_and_exact_edge_identity_without_values(self):
        task, error = refused()
        self.assertIsInstance(error, ValueError)
        self.assertEqual("Refined join would discard fragment typography", str(error))
        code, findings, complete = failure(error, task.source_sha256)
        self.assertEqual("RECONSTRUCTION_REVIEW_REQUIRED", code)
        self.assertTrue(complete)
        finding = findings[0]
        self.assertEqual(
            hashlib.sha256(task.task_id.encode()).hexdigest(), finding["task_id_sha256"]
        )
        self.assertEqual("JOIN_TYPOGRAPHY_CONFLICT", finding["code"])
        self.assertEqual(1, finding["previous_page"])
        self.assertEqual(2, finding["next_page"])
        self.assertEqual(hashlib.sha256(b"edge").hexdigest(), finding["edge_id_sha256"])
        self.assertEqual(hashlib.sha256(b"left").hexdigest(), finding["previous_id_sha256"])
        self.assertIn("line_height", finding["conflicting_fields"])
        self.assertIn("italic", finding["conflicting_fields"])
        self.assertNotIn("indent_em", finding["conflicting_fields"])
        self.assertNotIn("space_before_em", finding["conflicting_fields"])
        wire = json.dumps(findings)
        for private in (task.nodes[0].text_excerpt, task.nodes[1].text_excerpt, "1.25", "#231f20"):
            self.assertNotIn('"' + private + '"', wire)
        self.assertNotIn('"line_height":', wire)

    def test_foreign_source_and_arbitrary_exception_never_gain_findings(self):
        _, error = refused()
        for candidate in (error, ValueError("PRIVATE_BOOK sk-secret")):
            self.assertEqual(
                ("RECONSTRUCTION_REVIEW_REQUIRED", [], False), failure(candidate, "c" * 64)
            )

    def test_actual_observer_emits_one_bounded_failure_and_no_source_inventory_claim(self):
        task, error = refused()
        with tempfile.TemporaryDirectory() as directory:
            observer = observation_context(Path(directory), request={"mode": "validate_refinement"})
            error.source_sha256 = observer.job.source.sha256
            observer.failed(error)
            data = emitted(observer)
        packet = json.loads(data.strip().removeprefix(PREFIX))
        self.assertLessEqual(len(data.encode()), PACKET_BYTES)
        self.assertEqual("failed", packet["outcome"])
        self.assertEqual("RECONSTRUCTION_REVIEW_REQUIRED", packet["failure_code"])
        self.assertEqual(1, len(packet["findings"]))
        self.assertTrue(packet["findings_complete"])
        self.assertFalse(packet["inventory"]["source_bytes_verified"])
        self.assertEqual("unknown", packet["inventory"]["coverage"])
        self.assertEqual(task.observation_sha256, packet["findings"][0]["observation_sha256"])

    def test_equal_styles_and_finite_choice_still_pass(self):
        task, response = fixture()
        self.assertIsNotNone(presentation_projection(task, response))

    def test_private_view_identity_cannot_be_rebound_to_an_unrelated_edge_or_source(self):
        task, error = refused()
        original = error.finding.model_dump()
        for patch in ({"source_sha256": "c" * 64}, {"observation_sha256": "c" * 64}, {"edges": []}):
            error.bind_task(task.model_copy(update={"task_id": "foreign", **patch}))
            self.assertEqual(original, error.finding.model_dump())
