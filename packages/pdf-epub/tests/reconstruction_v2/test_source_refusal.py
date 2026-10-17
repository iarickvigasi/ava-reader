"""Required source refusal keeps exact coordinates/identity, never prose or a candidate."""

import hashlib
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.assemble_blocks import assemble_blocks
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse
from ava_pdf_epub.reconstruction_v2.segments import Segment
from ava_pdf_epub.reconstruction_v2.source_refusal import SourceContentRefusal

from .response_fixtures import wire_segment

FIXTURES = Path(__file__).parent / "fixtures"


class SourceRefusalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.scratch = Path(cls.temp.name)
        cls.scan = prepare_page(FIXTURES / "two-column-scan.pdf", cls.scratch, 1)
        cls.native = prepare_page(FIXTURES / "native.pdf", cls.scratch, 1)
        cls.task = cls.scan.tasks[0]

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def response(self, **change):
        return RecognitionResponse.model_validate(
            dict(
                schema_version="ava-recognition-response-2",
                task_id=self.task.task_id,
                source_sha256=self.task.source_sha256,
                render_sha256=self.task.image.sha256,
                segments=[],
                unresolved=[],
                language="en",
                **change,
            )
        )

    def test_unresolved_and_language_refusals_keep_task_crop_not_private_prose(self):
        for change, code in [
            ({"unresolved": ["private source prose"]}, "RECOGNITION_UNRESOLVED"),
            ({"language": "fr"}, "SOURCE_LANGUAGE_UNSUPPORTED"),
        ]:
            raw = dict(
                schema_version="ava-recognition-response-2",
                task_id=self.task.task_id,
                source_sha256=self.task.source_sha256,
                render_sha256=self.task.image.sha256,
                segments=[],
                unresolved=[],
                language="en",
            )
            raw.update(change)
            with self.assertRaises(SourceContentRefusal) as caught:
                accept_response(self.task, RecognitionResponse.model_validate(raw))
            diagnostic = caught.exception.diagnostic
            finding = diagnostic.findings[0]
            self.assertEqual(code, finding.code)
            self.assertEqual(self.task.region_box, finding.box)
            self.assertEqual(self.task.task_id, finding.task_id)
            self.assertEqual(self.task.image.sha256, finding.render_sha256)
            self.assertNotIn("private source prose", diagnostic.model_dump_json())

    def test_native_required_unsupported_segment_blocks_before_any_book_output(self):
        segment = Segment(
            id="p1-required",
            page=1,
            box=self.native.native_segments[0].box,
            kind="unsupported",
            text="private required source material",
            method="native",
        )
        state = AssemblyState()
        with patch("ava_pdf_epub.reconstruction_v2.assemble_blocks.assemble_figure") as figure:
            with self.assertRaises(SourceContentRefusal) as caught:
                assemble_blocks([segment], [self.native], self.scratch, state)
            figure.assert_not_called()
        diagnostic = caught.exception.diagnostic
        self.assertEqual(self.native.source_sha256, diagnostic.source_sha256)
        self.assertEqual("assembly", diagnostic.stage)
        finding = diagnostic.findings[0]
        self.assertEqual("blocking", finding.severity)
        self.assertEqual(segment.box, finding.box)
        self.assertEqual(segment.id, finding.block_id)
        self.assertEqual(hashlib.sha256(segment.id.encode()).hexdigest(), finding.segment_id_sha256)
        self.assertEqual([], state.blocks)
        self.assertEqual({}, state.assets)
        self.assertNotIn("private required", diagnostic.model_dump_json())

    def test_foreign_response_never_receives_source_refusal_authority(self):
        raw = self.response().model_dump()
        raw.update(source_sha256="b" * 64, unresolved=["private prose"])
        with self.assertRaisesRegex(ValueError, "another source") as caught:
            accept_response(self.task, RecognitionResponse.model_validate(raw))
        self.assertNotIsInstance(caught.exception, SourceContentRefusal)

    def test_unsupported_ocr_segment_serializes_as_source_block_not_generic_failure(self):
        segment = wire_segment(
            self.task,
            id="required-structure",
            page=1,
            box=self.task.region_box.model_dump(),
            kind="unsupported",
            text="private book text",
            method="ocr",
        )
        raw = self.response().model_dump()
        raw["segments"] = [segment]
        with self.assertRaises(SourceContentRefusal) as caught:
            accept_response(self.task, RecognitionResponse.model_validate(raw))
        finding = caught.exception.diagnostic.findings[0]
        self.assertEqual("ESSENTIAL_STRUCTURE_UNSUPPORTED", finding.code)
        self.assertEqual(self.task.region_box, finding.box)
        self.assertEqual("required-structure", finding.block_id)
        self.assertNotIn("private book text", caught.exception.diagnostic.model_dump_json())
        from ava_pdf_epub.reconstruction_v2.__main__ import main

        packet = json.dumps(
            dict(mode="validate_tasks", tasks=[self.task.model_dump(mode="json")], responses=[raw])
        ).encode()
        output = io.StringIO()
        with (
            patch("ava_pdf_epub.reconstruction_v2.__main__.snapshot", return_value=packet),
            patch.object(Path, "mkdir"),
            redirect_stdout(output),
        ):
            with self.assertRaises(SystemExit) as exited:
                main()
        self.assertEqual(1, exited.exception.code)
        diagnostic = json.loads(output.getvalue())
        self.assertEqual("ava-source-refusal-1", diagnostic["schema_version"])
        self.assertEqual(self.task.source_sha256, diagnostic["source_sha256"])
        self.assertEqual(self.task.task_id, diagnostic["findings"][0]["task_id"])
        self.assertNotIn("private book text", output.getvalue())
