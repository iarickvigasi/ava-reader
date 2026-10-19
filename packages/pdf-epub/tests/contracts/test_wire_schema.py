import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.common import MAX_WIRE_BYTES
from ava_pdf_epub.contracts.registry import MODELS
from ava_pdf_epub.contracts.schema_export import export_schemas
from ava_pdf_epub.contracts.wire import decode_wire

from .helpers import fixture


class WireTests(unittest.TestCase):
    def test_wire_ambiguity_encoding_and_bounds_rejected(self):
        for value in [b"", b"\xff", b'{"a":1,"a":2}', b'{"x":NaN}', b" " * (MAX_WIRE_BYTES + 1)]:
            with self.subTest(size=len(value)), self.assertRaises((ValueError, UnicodeError)):
                decode_wire(value)

    def test_schema_exports_are_reproducible_and_checked_in(self):
        import ava_pdf_epub.contracts

        installed = Path(ava_pdf_epub.contracts.__file__).parent / "schemas"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            export_schemas(root)
            self.assertEqual(len(list(root.glob("*.json"))), 5)
            for version in MODELS:
                name = version + ".schema.json"
                self.assertEqual((root / name).read_bytes(), (installed / name).read_bytes())

    def test_cli_returns_only_boolean_protocol(self):
        requests = [
            (dict(schema_version=version, payload=fixture(version)), True) for version in MODELS
        ]
        requests += [
            (dict(schema_version="unknown", payload={"private": "secret"}), False),
            (dict(schema_version="ava-book-2", payload={"schema_version": "ava-book-2"}), False),
        ]
        for request, expected in requests:
            result = subprocess.run(
                [sys.executable, "-m", "ava_pdf_epub.contracts", "validate"],
                input=json.dumps(request).encode(),
                capture_output=True,
                timeout=5,
            )
            self.assertEqual(result.returncode, 0 if expected else 1)
            self.assertEqual(json.loads(result.stdout), {"valid": expected})
            self.assertEqual(result.stderr, b"")
