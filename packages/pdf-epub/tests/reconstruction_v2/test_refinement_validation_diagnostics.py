"""Known semantic refusal diagnostics preserve strict decisions and private source values."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.reconstruction_v2.refinement_response import accept_refinement
from ava_pdf_epub.worker_observation_packet import PACKET_BYTES, PREFIX, failure

from .observed_refinement import FIXTURES, observed_case, observed_decisions
from .test_continuation_presentation import fixture as presentation_fixture
from .test_worker_observation import emitted
from .worker_observation_fixture import observation_context


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


class RefinementValidationDiagnostics(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        _, _, tasks = observed_case(Path(cls.directory.name))
        for task, response in zip(tasks, observed_decisions(tasks), strict=True):
            references = {n.body_reference_id for n in task.nodes if n.body_reference_id}
            for decision in response.decisions:
                if decision.node_id in references:
                    cls.task, cls.response, cls.decision = task, response, decision
                    return
        raise AssertionError("Authored fixture has no body-reference decision")

    @classmethod
    def tearDownClass(cls):
        cls.directory.cleanup()

    def refused(self, **changes):
        decision = self.decision.model_copy(update=changes)
        response = self.response.model_copy(
            update={
                "decisions": [
                    decision if d.node_id == decision.node_id else d
                    for d in self.response.decisions
                ]
            }
        )
        before = document_digest(self.task), document_digest(response)
        with self.assertRaisesRegex(ValueError, "size baseline") as caught:
            accept_refinement(self.task, response)
        self.assertEqual(before, (document_digest(self.task), document_digest(response)))
        return caught.exception

    def test_actual_guard_has_finite_reason_page_and_hashed_provenance(self):
        error = self.refused(style=self.decision.style.model_copy(update={"relative_size": 0.95}))
        code, findings, complete = failure(error, self.task.source_sha256)
        self.assertEqual("RECONSTRUCTION_REVIEW_REQUIRED", code)
        self.assertTrue(complete)
        node = next(n for n in self.task.nodes if n.id == self.decision.node_id)
        self.assertEqual(
            [
                {
                    "kind": "refinement",
                    "code": "REFINEMENT_ROLE_BASELINE_INVALID",
                    "stage": "refinement",
                    "check": "body_reference_size_baseline",
                    "task_id_sha256": digest(self.task.task_id),
                    "node_id_sha256": digest(node.id),
                    "observation_sha256": self.task.observation_sha256,
                    "render_sha256": self.task.image.sha256,
                    "page": node.page,
                }
            ],
            findings,
        )
        for private in (node.text_excerpt, node.id, self.task.task_id, "0.95"):
            self.assertNotIn('"' + private + '"', json.dumps(findings))

    def test_non_heading_ancestry_has_distinct_finite_check_and_valid_control_still_passes(self):
        error = self.refused(chapter_start=False)
        _, findings, complete = failure(error, self.task.source_sha256)
        self.assertTrue(complete)
        self.assertEqual("non_heading_ancestry", findings[0]["check"])
        accept_refinement(self.task, self.response)

    def test_foreign_source_and_unknown_errors_never_gain_diagnostic_authority(self):
        error = self.refused(style=self.decision.style.model_copy(update={"relative_size": 0.95}))
        self.assertEqual(("RECONSTRUCTION_REVIEW_REQUIRED", [], False), failure(error, "c" * 64))
        self.assertEqual(
            ("RECONSTRUCTION_REVIEW_REQUIRED", [], False),
            failure(ValueError("PRIVATE_BOOK sk-private"), self.task.source_sha256),
        )

    def test_observer_emits_bound_finite_failure_without_claiming_source_inventory(self):
        error = self.refused(style=self.decision.style.model_copy(update={"relative_size": 0.95}))
        with tempfile.TemporaryDirectory() as directory:
            observer = observation_context(
                Path(directory),
                source=(FIXTURES / "two-column-scan.pdf").read_bytes(),
                request={"mode": "validate_refinement"},
            )
            self.assertEqual(self.task.source_sha256, observer.job.source.sha256)
            observer.failed(error)
            wire = emitted(observer)
        packet = json.loads(wire.strip().removeprefix(PREFIX))
        self.assertLessEqual(len(wire.encode()), PACKET_BYTES)
        self.assertEqual("failed", packet["outcome"])
        self.assertEqual("REFINEMENT_ROLE_BASELINE_INVALID", packet["findings"][0]["code"])
        self.assertTrue(packet["findings_complete"])
        self.assertFalse(packet["inventory"]["source_bytes_verified"])
        self.assertEqual("unknown", packet["inventory"]["coverage"])

    def test_private_presentation_view_reports_original_task_and_refuses_foreign_rebinding(self):
        from ava_pdf_epub.reconstruction_v2.continuation_presentation_response import (
            presentation_projection,
        )

        task, response = presentation_fixture()
        bad = response.decisions[0].model_copy(update={"chapter_start": False})
        before = document_digest(task), document_digest(response)
        with self.assertRaisesRegex(ValueError, "size baseline") as caught:
            presentation_projection(task, response.model_copy(update={"decisions": [bad]}))
        error = caught.exception
        _, findings, complete = failure(error, task.source_sha256)
        self.assertTrue(complete)
        self.assertEqual(digest(task.task_id), findings[0]["task_id_sha256"])
        self.assertEqual(before, (document_digest(task), document_digest(response)))
        original = error.finding.model_dump()
        for patch in ({"source_sha256": "c" * 64}, {"observation_sha256": "c" * 64}, {"nodes": []}):
            error.bind_task(task.model_copy(update={"task_id": "foreign", **patch}))
            self.assertEqual(original, error.finding.model_dump())

    def test_actual_cli_keeps_generic_stdout_and_exit_with_optional_finding(self):
        import io
        from contextlib import redirect_stderr, redirect_stdout
        from unittest.mock import patch

        from ava_pdf_epub.reconstruction_v2.__main__ import main

        bad = self.decision.model_copy(
            update={"style": self.decision.style.model_copy(update={"relative_size": 0.95})}
        )
        response = self.response.model_copy(
            update={
                "decisions": [
                    bad if d.node_id == bad.node_id else d for d in self.response.decisions
                ]
            }
        )
        raw = json.dumps(
            {
                "mode": "validate_refinement",
                "task": self.task.model_dump(mode="json"),
                "response": response.model_dump(mode="json"),
            }
        ).encode()
        results = []
        for measured in (False, True):
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                setup = observation_context(
                    root,
                    source=(FIXTURES / "two-column-scan.pdf").read_bytes(),
                    request={"mode": "validate_refinement"},
                )
                emitted(setup)
                raw_out, err = io.BytesIO(), io.StringIO()
                output = io.TextIOWrapper(raw_out, encoding="utf-8", write_through=True)

                def trusted(_root, name, _limit, _measured=measured, _root_path=root):
                    if not _measured:
                        raise FileNotFoundError()
                    return (_root_path / name).read_bytes()

                with (
                    patch("ava_pdf_epub.reconstruction_v2.__main__.snapshot", return_value=raw),
                    patch("ava_pdf_epub.worker_observation.snapshot", side_effect=trusted),
                    patch.object(Path, "mkdir"),
                    redirect_stdout(output),
                    redirect_stderr(err),
                ):
                    with self.assertRaises(SystemExit) as caught:
                        main()
                self.assertEqual(1, caught.exception.code)
                results.append((raw_out.getvalue(), err.getvalue()))
        self.assertEqual(results[0][0], results[1][0])
        self.assertEqual(
            {
                "schema_version": "ava-reconstruction-error-1",
                "code": "RECONSTRUCTION_REVIEW_REQUIRED",
            },
            json.loads(results[1][0]),
        )
        self.assertEqual("", results[0][1])
        packet = json.loads(results[1][1].strip().removeprefix(PREFIX))
        self.assertEqual("REFINEMENT_ROLE_BASELINE_INVALID", packet["findings"][0]["code"])
        self.assertEqual(hashlib.sha256(raw).hexdigest(), packet["binding"]["request_sha256"])
