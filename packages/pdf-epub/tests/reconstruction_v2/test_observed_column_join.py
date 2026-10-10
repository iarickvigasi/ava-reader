"""The actual settled response joins source-supported prose without a paid replay."""

import base64
import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.assemble_pages import assemble_pages
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_margins import continuation_margins
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse, RecognitionTask
from ava_pdf_epub.reconstruction_v2.stream_joins import stream_joins

FIXTURES = Path(__file__).parent / "fixtures"


class ObservedColumnJoinTest(unittest.TestCase):
    def test_settled_fragments_join_without_changing_text_note_or_evidence(self):
        raw = json.loads((FIXTURES / "observed-two-column-page1-task.json").read_text())
        raw["image"]["base64"] = base64.b64encode(
            (FIXTURES / "observed-two-column-page1.png").read_bytes()
        ).decode()
        task = RecognitionTask.model_validate(raw)
        response = RecognitionResponse.model_validate_json(
            (FIXTURES / "observed-two-column-page1-semantics.json").read_bytes()
        )
        # First band only; the later page-two continuation is outside this receipt test.
        segments = accept_response(task, response)[:8]
        before = [s.model_dump() for s in segments]
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            prepared = prepare_page(FIXTURES / "two-column-scan.pdf", scratch, 1)
            state = AssemblyState()
            _, ordered = assemble_pages([prepared], {1: segments}, state)
            continuation_margins(ordered, [prepared], scratch, state)
            self.assertTrue(state.flush_starts["s0006"])
            result = stream_joins(ordered, state)
        self.assertEqual(7, len(result))
        self.assertEqual(" ".join(s.text for s in segments), " ".join(s.text for s in result))
        joined = next(s for s in result if s.id == "s0005")
        self.assertEqual(segments[4].text + " " + segments[5].text, joined.text)
        self.assertEqual(("s0005", len(segments[4].text) + 1), state.aliases["s0006"])
        self.assertEqual(2, len(state.evidence["s0005"]))
        note = next(s for s in result if s.id == "s0007")
        self.assertEqual("[1]", note.text[note.spans[0].start : note.spans[0].end])
        self.assertEqual(before, [s.model_dump() for s in segments])
