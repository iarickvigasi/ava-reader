"""Per-response gate prevents paying for more pages after a semantically unusable receipt."""

import copy
import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.geometry import rectangle
from ava_pdf_epub.reconstruction_v2.make_task import make_task
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse
from ava_pdf_epub.reconstruction_v2.validate_tasks import validate_tasks

from .response_fixtures import wire_segment


class ResponseValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            page = prepare_page(Path(__file__).parent / "fixtures/native.pdf", scratch, 3)
            obs = page.observation
            task = make_task(
                obs,
                page.source_sha256,
                rectangle((0, 0, obs.width_pt, obs.height_pt), obs.width_pt, obs.height_pt),
                scratch,
            )
            cls.task = task.model_dump(mode="json")
            cls.response = RecognitionResponse(
                schema_version="ava-recognition-response-2",
                task_id=task.task_id,
                source_sha256=task.source_sha256,
                render_sha256=task.image.sha256,
                language="en",
                unresolved=[],
                segments=[
                    wire_segment(
                        cls.task,
                        id=line.id,
                        page=3,
                        box=line.box.model_dump(),
                        kind="paragraph",
                        text=line.text,
                        method="ocr",
                    )
                    for line in obs.lines
                ],
            ).model_dump(mode="json")

    def request(self, response):
        return json.dumps(
            {"mode": "validate_tasks", "tasks": [self.task], "responses": [response]}
        ).encode()

    def test_valid_native_conserving_receipt_is_bound(self):
        self.assertEqual(1, validate_tasks(self.request(self.response)).task_count)

    def test_explicit_uncertainty_language_and_empty_pair_are_refused(self):
        for change in [
            dict(unresolved=["Unreadable word"]),
            dict(language="de"),
            dict(segments=[]),
        ]:
            with self.assertRaises(ValueError):
                validate_tasks(self.request({**self.response, **change}))
        with self.assertRaisesRegex(ValueError, "counts differ"):
            validate_tasks(
                json.dumps(
                    {"mode": "validate_tasks", "tasks": [self.task], "responses": []}
                ).encode()
            )

    def test_native_rewrite_outside_box_and_span_are_refused(self):
        changed = copy.deepcopy(self.response)
        changed["segments"][0]["text"] = "invented source sentence"
        with self.assertRaisesRegex(ValueError, "native text"):
            validate_tasks(self.request(changed))
        changed = copy.deepcopy(self.response)
        changed["segments"][0]["box"]["x1"] = 1001
        with self.assertRaises(ValueError):
            validate_tasks(self.request(changed))
        changed = copy.deepcopy(self.response)
        changed["segments"][0]["spans"] = [
            dict(
                start=0,
                end=200000,
                url="https://example.org",
                style=None,
                note_label=None,
                target_text=None,
            )
        ]
        with self.assertRaisesRegex(ValueError, "span outside"):
            validate_tasks(self.request(changed))


if __name__ == "__main__":
    unittest.main()
