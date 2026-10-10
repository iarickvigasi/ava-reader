"""Rehash malformed image descriptors so semantic rejection cannot rely only on task IDs."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.task_identity import task_identifier
from ava_pdf_epub.reconstruction_v2.validate_tasks import validate_tasks


class TaskValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(__file__).parent / "fixtures/two-column-scan.pdf"
            cls.task = prepare_page(source, Path(directory), 1).tasks[0].model_dump(mode="json")

    def encode(self, task):
        return json.dumps({"mode": "validate_tasks", "tasks": [task]}, ensure_ascii=False).encode()

    def test_receipt_binds_exact_request_bytes(self):
        raw = self.encode(self.task)
        receipt = validate_tasks(raw)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), receipt.request_sha256)
        self.assertEqual(1, receipt.task_count)
        self.assertNotEqual(receipt.request_sha256, validate_tasks(raw + b" ").request_sha256)

    def test_recomputed_invalid_dimensions_format_and_geometry_refuse(self):
        for field, value in [("width", 2), ("height", 2), ("media_type", "image/jpeg")]:
            task = json.loads(json.dumps(self.task))
            task["image"][field] = value
            task["task_id"] = task_identifier(task)
            with self.assertRaises(ValueError):
                validate_tasks(self.encode(task))
        task = json.loads(json.dumps(self.task))
        task["region_box"]["x1"] = 9999
        task["task_id"] = task_identifier(task)
        with self.assertRaises(ValueError):
            validate_tasks(self.encode(task))

    def test_forged_identity_duplicate_tasks_and_wire_bound_refuse(self):
        task = {**self.task, "task_id": "recognize-" + "0" * 64}
        with self.assertRaises(ValueError):
            validate_tasks(self.encode(task))
        with self.assertRaises(ValueError):
            validate_tasks(
                json.dumps({"mode": "validate_tasks", "tasks": [self.task] * 2}).encode()
            )
        with self.assertRaisesRegex(ValueError, "byte bound"):
            validate_tasks(b" " * (16 * 1024 * 1024 + 1))
        with self.assertRaises(ValueError):
            validate_tasks(b'{"mode":"validate_tasks","tasks":[],"command":"extra"}')


if __name__ == "__main__":
    unittest.main()
