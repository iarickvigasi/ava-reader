"""These are response-contract checks, not evidence that a provider transcribed the image."""

import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.geometry import rectangle
from ava_pdf_epub.reconstruction_v2.make_task import make_task
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse, RecognitionTask

from .response_fixtures import wire_segment

FIXTURES = Path(__file__).parent / "fixtures"


class RecognitionBoundary(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp = tempfile.TemporaryDirectory()
        cls.scratch = Path(cls.temp.name)
        cls.page = prepare_page(FIXTURES / "native.pdf", cls.scratch, 3)
        page = cls.page.observation
        cls.task = make_task(
            page,
            cls.page.source_sha256,
            rectangle((0, 0, page.width_pt, page.height_pt), page.width_pt, page.height_pt),
            cls.scratch,
        )
        cls.response = RecognitionResponse(
            schema_version="ava-recognition-response-2",
            task_id=cls.task.task_id,
            source_sha256=cls.task.source_sha256,
            render_sha256=cls.task.image.sha256,
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
                for line in page.lines
            ],
        )

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temp.cleanup()

    def test_native_order_and_characters_cannot_be_rewritten(self) -> None:
        accept_response(self.task, self.response)
        raw = self.response.model_dump()
        raw["segments"][2]["text"] = " ".join(reversed(raw["segments"][2]["text"].split()))
        with self.assertRaisesRegex(ValueError, "native text"):
            accept_response(self.task, RecognitionResponse.model_validate(raw))

    def test_forged_render_and_uncertainty_are_refused(self) -> None:
        for update in [dict(render_sha256="0" * 64), dict(unresolved=["unreadable word"])]:
            with self.assertRaises(ValueError):
                accept_response(
                    self.task,
                    RecognitionResponse.model_validate({**self.response.model_dump(), **update}),
                )

    def test_duplicate_and_outside_segments_are_refused(self) -> None:
        raw = self.response.model_dump()
        raw["segments"].append(raw["segments"][0])
        with self.assertRaisesRegex(ValueError, "Repeated"):
            accept_response(self.task, RecognitionResponse.model_validate(raw))
        raw = self.response.model_dump()
        raw["segments"][0]["page"] = 2
        with self.assertRaisesRegex(ValueError, "geometry"):
            accept_response(self.task, RecognitionResponse.model_validate(raw))

    def test_unqualified_hidden_layer_is_not_sent_as_visual_transcription_hint(self):
        observation = self.page.observation.model_copy(update={"risks": ["conditional_visibility"]})
        task = make_task(observation, self.task.source_sha256, self.task.region_box, self.scratch)
        self.assertEqual({"reliable": False, "lines": []}, json.loads(task.native_evidence))
        self.assertNotEqual(self.task.task_id, task.task_id)

    def test_changed_image_payload_is_refused_before_dispatch(self) -> None:
        raw = self.task.model_dump()
        raw["image"]["base64"] = "AAAA"
        with self.assertRaises(ValueError):
            RecognitionTask.model_validate(raw)


if __name__ == "__main__":
    unittest.main()
