import base64
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.contracts.legacy_result import adapt_legacy_result
from ava_pdf_epub.runtime.bundle import encode_bundle
from ava_pdf_epub.runtime.faults import trigger_fault
from tests.contracts.legacy_helpers import legacy_fixture


class BundleTests(unittest.TestCase):
    def test_exact_manifest_bytes_and_symlink_refusal(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            job, binding, _ = legacy_fixture(root)
            result = adapt_legacy_result(
                job,
                binding=binding,
                exit_code=2,
                result_bytes=(root / "stdout.json").read_bytes(),
                artifact_root=root,
            )
            output = json.loads(encode_bundle(result, root))
            self.assertFalse(output["result"]["outcome"]["publication_eligible"])
            for entry in output["artifacts"]:
                data = base64.b64decode(entry["base64"], validate=True)
                descriptor = next(
                    item
                    for item in [
                        result.outcome.canonical_book,
                        result.outcome.epub,
                        result.outcome.validation_report,
                    ]
                    if item.id == entry["id"]
                )
                self.assertEqual(hashlib.sha256(data).hexdigest(), descriptor.sha256)
            epub = root / result.outcome.epub.path
            epub.unlink()
            epub.symlink_to(root / "source.pdf")
            with self.assertRaises((ValueError, OSError)):
                encode_bundle(result, root)

    def test_bundle_limit_is_enforced_before_encoding(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            job, binding, _ = legacy_fixture(root)
            result = adapt_legacy_result(
                job,
                binding=binding,
                exit_code=2,
                result_bytes=(root / "stdout.json").read_bytes(),
                artifact_root=root,
            )
            with patch("ava_pdf_epub.runtime.bundle.MAX_ARTIFACT_BYTES", 1):
                with self.assertRaisesRegex(ValueError, "RESULT_SIZE_LIMIT"):
                    encode_bundle(result, root)

    def test_fault_requires_exact_development_acknowledgement(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            job, _, _ = legacy_fixture(root)
            for mode, acknowledgement in [
                ("production", "AVA_PDF_RUNTIME_FAULTS_V1"),
                ("development", "missing"),
            ]:
                with patch.dict(
                    "os.environ",
                    {
                        "AVA_PDF_RUNTIME_FAULT": "deadline",
                        "AVA_PDF_RUNTIME_MODE": mode,
                        "AVA_PDF_FAULT_ACK": acknowledgement,
                    },
                ):
                    with self.assertRaisesRegex(ValueError, "FAULT_NOT_AUTHORIZED"):
                        trigger_fault(job, root)
