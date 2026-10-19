import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts import AcceptedContentV1, JobInputV1, WorkerResultV1
from ava_pdf_epub.contracts.bindings import validate_accepted_binding, validate_result_for_job

from .helpers import fixture


class BoundaryContractTests(unittest.TestCase):
    def test_exit2_retains_legacy_candidate_but_never_readiness(self):
        result = WorkerResultV1.model_validate(fixture("ava-pdf-worker-result-1"))
        self.assertEqual(result.outcome.cli_exit_code, 2)
        self.assertEqual(result.outcome.canonical_schema, "ava-book-1")
        self.assertIs(result.outcome.publication_eligible, False)
        job = JobInputV1.model_validate(fixture("ava-pdf-job-1"))
        validate_result_for_job(job, result)
        accepted = AcceptedContentV1.model_validate(fixture("ava-accepted-content-1"))
        with self.assertRaisesRegex(ValueError, "version2"):
            validate_accepted_binding(accepted, job, result)
        for field, value in [
            ("status", "ready"),
            ("publication_eligible", True),
            ("publication_eligible", 0),
        ]:
            raw = fixture("ava-pdf-worker-result-1")
            raw["outcome"][field] = value
            with self.subTest(field=field, value=value), self.assertRaises(ValidationError):
                WorkerResultV1.model_validate(raw)

    def test_missing_manifest_wrong_role_and_unknown_versions_fail(self):
        for mutation in ["missing", "wrong-role", "new-version"]:
            raw = fixture("ava-pdf-worker-result-1")
            if mutation == "missing":
                raw["outcome"].pop("validation_report")
            elif mutation == "wrong-role":
                raw["outcome"]["epub"] = raw["outcome"]["canonical_book"]
            else:
                raw["schema_version"] = "ava-pdf-worker-result-2"
            with self.subTest(mutation=mutation), self.assertRaises(ValidationError):
                WorkerResultV1.model_validate(raw)

    def test_bound_context_rejects_stale_or_foreign_result(self):
        job = JobInputV1.model_validate(fixture("ava-pdf-job-1"))
        for field, value in [
            ("operation_id", "other"),
            ("source_sha256", "0" * 64),
            ("attempt_fence", 2),
            ("cancellation_epoch", 1),
            ("config_sha256", "0" * 64),
        ]:
            raw = fixture("ava-pdf-worker-result-1")
            raw[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate_result_for_job(job, WorkerResultV1.model_validate(raw))

    def test_failed_never_has_reader_retry_or_candidate_artifacts(self):
        raw = fixture("ava-pdf-worker-result-1")
        diagnostic = raw["outcome"]["validation_report"]
        diagnostic["role"] = "DIAGNOSTIC"
        raw["outcome"] = {
            "status": "failed",
            "cli_exit_code": 1,
            "failure_id": "failure-one",
            "code": "SOURCE_INVALID",
            "stage": "preflight",
            "safe_reason": "Cannot process this source.",
            "diagnostic": diagnostic,
            "investigation_required": True,
            "notification_required": True,
            "reader_retry_allowed": False,
        }
        WorkerResultV1.model_validate(raw)
        raw["outcome"]["reader_retry_allowed"] = True
        with self.assertRaises(ValidationError):
            WorkerResultV1.model_validate(raw)

    def test_native_mode_cannot_smuggle_dispatch_or_reconversion_intent(self):
        for field, value in [
            ("dispatch_authority_id", "spend-one"),
            ("intent", "reconversion"),
            ("active_deadline_seconds", 7201),
            ("provider_key", "secret"),
        ]:
            raw = fixture("ava-pdf-job-1")
            raw[field] = value
            with self.subTest(field=field), self.assertRaises(ValidationError):
                JobInputV1.model_validate(raw)
