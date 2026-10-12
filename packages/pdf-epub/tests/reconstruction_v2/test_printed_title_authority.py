"""Source-bound title/null decisions cannot edit text, choose foreign crops or create an author."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.apply_refinement import apply_refinement
from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.printed_metadata import printed_metadata
from ava_pdf_epub.reconstruction_v2.printed_title_contract import PrintedTitleResponse
from ava_pdf_epub.reconstruction_v2.printed_title_response import accept_printed_title
from ava_pdf_epub.reconstruction_v2.validate_refinement import validate_refinement

from .printed_title_fixture import title_fixture, title_response


class PrintedTitleAuthorityTests(unittest.TestCase):
    def test_native_and_scan_title_and_null_receipts_use_real_acceptance_and_state(self):
        for method in ["native", "ocr"]:
            for role in ["title", None]:
                with (
                    self.subTest(method=method, role=role),
                    tempfile.TemporaryDirectory() as directory,
                ):
                    task, _, segments, state = title_fixture(Path(directory), method)
                    response = title_response(task, role)
                    before = [segment.model_dump() for segment in segments]
                    result = apply_refinement(segments, [task], [response], state)
                    self.assertEqual(before, [segment.model_dump() for segment in result])
                    self.assertEqual(
                        (task.node.id, task.node.text_sha256, role), state.printed_title
                    )
                    claims = printed_metadata(state, "A quoted or branded name")
                    self.assertEqual(role is not None, any(c["field"] == "title" for c in claims))
                    self.assertFalse(any(c["field"] == "contributor" for c in claims))
                    raw = json_bytes(
                        dict(
                            mode="validate_refinement",
                            task=task.model_dump(mode="json"),
                            response=response.model_dump(mode="json"),
                        )
                    )
                    self.assertTrue(validate_refinement(raw)["valid"])

    def test_foreign_stale_and_partial_decisions_are_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            task, _, _, _ = title_fixture(Path(directory))
            for key in [
                "task_id",
                "source_sha256",
                "observation_sha256",
                "image_sha256",
                "node_id",
                "text_sha256",
                "crop",
                "duplicate_crop",
                "partial",
                "author",
            ]:
                with self.subTest(key=key):
                    raw = title_response(task).model_dump(mode="json")
                    if key in {"task_id", "source_sha256", "observation_sha256", "image_sha256"}:
                        raw[key] = "foreign-task" if key == "task_id" else "f" * 64
                    elif key in {"node_id", "text_sha256"}:
                        raw["decision"][key] = "foreign-node" if key == "node_id" else "f" * 64
                    elif key == "crop":
                        raw["decision"]["evidence_ids"] = [task.crops[0].id, "foreign-crop"]
                    elif key == "duplicate_crop":
                        raw["decision"]["evidence_ids"] = [task.crops[0].id] * 2
                    elif key == "partial":
                        raw["decision"].update(start=0, end=5)
                    else:
                        raw["decision"]["role"] = "author"
                    with self.assertRaises(ValueError):
                        accept_printed_title(task, PrintedTitleResponse.model_validate(raw))
