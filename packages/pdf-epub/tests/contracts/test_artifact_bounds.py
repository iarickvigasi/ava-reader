import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts import JobInputV1, WorkerResultV1
from ava_pdf_epub.contracts.bindings import validate_result_for_job

from .helpers import fixture


class ArtifactBoundTests(unittest.TestCase):
    def test_result_aggregate_has_a_hard_bound(self):
        raw = fixture("ava-pdf-worker-result-1")
        raw["outcome"]["epub"]["byte_length"] = 2147483648
        with self.assertRaisesRegex(ValidationError, "Aggregate artifact"):
            WorkerResultV1.model_validate(raw)

    def test_job_specific_scratch_bound_is_contextual(self):
        raw = fixture("ava-pdf-job-1")
        raw["scratch_byte_limit"] = 1
        job = JobInputV1.model_validate(raw)
        result = WorkerResultV1.model_validate(fixture("ava-pdf-worker-result-1"))
        with self.assertRaisesRegex(ValueError, "Aggregate artifact"):
            validate_result_for_job(job, result)
