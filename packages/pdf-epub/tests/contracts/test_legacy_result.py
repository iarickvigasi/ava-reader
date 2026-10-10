import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.bindings import validate_result_for_job
from ava_pdf_epub.contracts.legacy_result import adapt_legacy_result

from .legacy_helpers import legacy_fixture


class LegacyBridgeTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.job, self.binding, self.report = legacy_fixture(self.root)

    def adapt(self, exit_code=2):
        return adapt_legacy_result(
            self.job,
            binding=self.binding,
            exit_code=exit_code,
            result_bytes=(self.root / "stdout.json").read_bytes(),
            artifact_root=self.root,
        )

    def rewrite_stdout(self):
        (self.root / "stdout.json").write_text(json.dumps(self.report))

    def test_exit2_is_v1_candidate_and_reuse_does_not_publish(self):
        result = self.adapt()
        validate_result_for_job(self.job, result)
        self.assertEqual(result.outcome.canonical_schema, "ava-book-1")
        self.assertFalse(result.outcome.publication_eligible)
        self.assertEqual(result.outcome.cli_exit_code, 2)
        self.report["reused"] = True
        self.rewrite_stdout()
        self.assertEqual(self.adapt().outcome.candidate_id, result.outcome.candidate_id)

    def test_tampered_report_paths_hashes_or_source_fail(self):
        for field, value in [
            ("epub_path", "/etc/hosts"),
            ("source_sha256", "0" * 64),
            ("epub_sha256", "0" * 64),
            ("book_revision_sha256", "0" * 64),
            ("job_id", "b" * 32),
            ("schema_version", "unknown"),
        ]:
            old = self.report[field]
            self.report[field] = value
            self.rewrite_stdout()
            with (
                self.subTest(field=field),
                self.assertRaisesRegex(ValueError, "^Legacy result cannot be adapted$"),
            ):
                self.adapt()
            self.report[field] = old

    def test_tampered_private_bytes_or_symlink_fail(self):
        for filename in ["book.json", "book.epub", "configuration.json"]:
            path = self.root / self.binding.attempt_path / filename
            original = path.read_bytes()
            path.write_bytes(b"changed")
            with self.subTest(filename=filename), self.assertRaises(ValueError):
                self.adapt()
            path.write_bytes(original)
        epub = self.root / self.binding.attempt_path / "book.epub"
        epub.unlink()
        epub.symlink_to(self.root / "source.pdf")
        with self.assertRaises(ValueError):
            self.adapt()

    def test_mismatched_job_or_unrecognized_exit_fail(self):
        self.job = self.job.model_copy(update={"attempt_fence": 2})
        with self.assertRaises(ValueError):
            self.adapt()
        for exit_code in [-1, True, 3]:
            with self.subTest(exit=exit_code), self.assertRaises(ValueError):
                self.adapt(exit_code)

    def test_failure_reason_is_safe_and_private_diagnostic_is_integrity_bound(self):
        self.report = {
            "status": "failed",
            "error_type": "ValueError",
            "message": "SECRET /private/path",
        }
        self.rewrite_stdout()
        result = self.adapt(1)
        self.assertNotIn("SECRET", result.model_dump_json())
        self.assertEqual(result.outcome.status, "failed")
        self.assertFalse(result.outcome.reader_retry_allowed)
        self.assertEqual(result.outcome.diagnostic.path, "stdout.json")
