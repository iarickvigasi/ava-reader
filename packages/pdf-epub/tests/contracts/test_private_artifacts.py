import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.artifact_bytes import verify_artifact_bytes
from ava_pdf_epub.contracts.artifacts import Artifact
from ava_pdf_epub.contracts.private_files import describe, snapshot


class PrivateArtifactTests(unittest.TestCase):
    def test_digest_size_symlink_and_traversal(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "book.epub").write_bytes(b"candidate")
            artifact = describe(root, "book.epub", "DERIVED_EPUB", "book-epub")
            verify_artifact_bytes(root, artifact)
            with self.assertRaises(ValueError):
                verify_artifact_bytes(root, artifact.model_copy(update={"sha256": "0" * 64}))
            with self.assertRaises(ValueError):
                describe(root, "../outside", "DERIVED_EPUB", "book-epub")
            (root / "link").symlink_to(root / "book.epub")
            with self.assertRaises(OSError):
                describe(root, "link", "DERIVED_EPUB", "book-epub")
            with self.assertRaises(ValueError):
                snapshot(root, "book.epub", 1)

    @unittest.skipUnless(hasattr(os, "mkfifo"), "POSIX FIFO integrity boundary")
    def test_fifo_rejected_without_blocking(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            os.mkfifo(root / "pipe")
            artifact = Artifact(
                id="pipe",
                role="DIAGNOSTIC",
                format="REPORT_JSON",
                media_type="application/json",
                path="pipe",
                byte_length=1,
                sha256=hashlib.sha256(b"x").hexdigest(),
            )
            code = """import json,sys,time
from pathlib import Path
from ava_pdf_epub.contracts.artifact_bytes import verify_artifact_bytes
from ava_pdf_epub.contracts.artifacts import Artifact
from ava_pdf_epub.contracts.private_files import describe
root=Path(sys.argv[1]); artifact=Artifact.model_validate(json.loads(sys.argv[2]))
started=time.monotonic()
for operation in (lambda: verify_artifact_bytes(root,artifact),
                  lambda: describe(root,'pipe','DIAGNOSTIC','fifo')):
    try: operation()
    except ValueError: pass
    else: raise AssertionError('FIFO accepted')
assert time.monotonic()-started < 1.0, 'FIFO rejection itself exceeded one second'
"""
            result = subprocess.run(
                [sys.executable, "-c", code, str(root), json.dumps(artifact.model_dump())],
                capture_output=True,
                timeout=20,
            )
            self.assertEqual(result.returncode, 0, result.stderr.decode())
