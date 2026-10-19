import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.admission import inspect_admission
from ava_pdf_epub.admission_actions import AdmissionError

from .helpers import save, writer


class AdmissionLimitsTests(unittest.TestCase):
    def test_hash_geometry_and_metadata_bind_exact_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            document = writer()
            document.add_metadata({"/Title": "An authored source"})
            path = save(document, directory)
            result = inspect_admission(path)
            self.assertEqual(result["source_sha256"], hashlib.sha256(path.read_bytes()).hexdigest())
            self.assertEqual(result["pages"], [{"width": 300.0, "height": 400.0}])
            self.assertEqual(result["metadata"]["Title"], "An authored source")

    def test_encrypted_pdf_is_explicitly_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            document = writer()
            document.encrypt("private")
            with self.assertRaisesRegex(AdmissionError, "PDF_ENCRYPTED"):
                inspect_admission(save(document, directory))

    def test_page_count_and_byte_bounds(self):
        with tempfile.TemporaryDirectory() as directory:
            document = writer()
            for _ in range(500):
                document.add_blank_page(width=300, height=400)
            with self.assertRaisesRegex(AdmissionError, "PDF_PAGE_LIMIT"):
                inspect_admission(save(document, directory))
            path = Path(directory) / "large.pdf"
            with path.open("wb") as stream:
                stream.truncate(50 * 1024 * 1024 + 1)
            with self.assertRaisesRegex(AdmissionError, "PDF_SIZE_LIMIT"):
                inspect_admission(path)

    def test_malformed_cli_returns_safe_fixed_code(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "secret-user-title.pdf"
            path.write_bytes(b"%PDF-1.7\nmissing objects and SECRET")
            result = subprocess.run(
                [sys.executable, "-m", "ava_pdf_epub.admission", str(path)],
                capture_output=True,
                text=True,
                timeout=20,
            )
            self.assertEqual(result.returncode, 0)
            self.assertEqual(json.loads(result.stdout), {"accepted": False, "code": "PDF_INVALID"})
            self.assertNotIn("SECRET", result.stdout)
