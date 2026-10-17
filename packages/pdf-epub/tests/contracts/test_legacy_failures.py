import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.legacy_result import adapt_legacy_result

from .legacy_helpers import legacy_fixture


class LegacyFailureTests(unittest.TestCase):
    def test_failed_epub_validation_maps_terminal_safe_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            job, binding, report = legacy_fixture(root)
            report["assembly"] = {"export_valid": False}
            data = json.dumps(report).encode()
            (root / "stdout.json").write_bytes(data)
            (root / binding.attempt_path / "result.json").write_bytes(data)
            result = adapt_legacy_result(
                job, binding=binding, exit_code=1, result_bytes=data, artifact_root=root
            )
            self.assertEqual(result.outcome.status, "failed")
            self.assertTrue(result.outcome.investigation_required)
            self.assertFalse(result.outcome.reader_retry_allowed)
            self.assertNotIn("epub", result.outcome.model_dump())

    def test_candidate_cannot_report_unknown_success_exit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            job, binding, _ = legacy_fixture(root)
            for code in [0, 1, 3, True]:
                with self.subTest(code=code), self.assertRaises(ValueError):
                    adapt_legacy_result(
                        job,
                        binding=binding,
                        exit_code=code,
                        result_bytes=(root / "stdout.json").read_bytes(),
                        artifact_root=root,
                    )
