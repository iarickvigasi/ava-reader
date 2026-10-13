"""The real task validator gates a one-pass correction before the next attempt phase."""

import contextlib
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2 import attempt_stream as worker
from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.recognition_anchor_context import RecognitionAnchorContextTask

from .attempt_peer import PeerOutput
from .test_recognition_anchor_context import correction, fixture


class AttemptAnchorContextTests(unittest.TestCase):
    def test_invalid_parent_is_corrected_once_before_refinement_without_text_or_style_loss(self):
        task, raw = fixture()
        reached = RuntimeError("AUTHORED_REFINEMENT_REACHED")
        captured = []
        prep = SimpleNamespace(check_unchanged=lambda: None, verify_inputs=lambda: None)

        class Pages(list):
            def verify(self):
                pass

            def clear_cache(self):
                pass

        pages = Pages([SimpleNamespace(tasks=[task])])

        @contextlib.contextmanager
        def prepared(*args):
            yield prep, pages

        def callback(packet):
            if packet["kind"] == "page":
                return []
            if packet["kind"] == "recognition":
                return [raw]
            self.assertEqual("anchor_context", packet["kind"])
            self.assertEqual("ava-recognition-anchor-context-exchange-1", packet["schema_version"])
            context = RecognitionAnchorContextTask.model_validate(packet["payload"])
            return [correction(context).model_dump(mode="json")]

        def refine(source, scratch, current_pages, current):
            captured.extend(current.responses)
            raise reached

        peer = PeerOutput(callback)
        request = dict(
            mode="attempt_stream",
            input=dict(
                schema_version="ava-reconstruct-input-3",
                source_sha256=task.source_sha256,
                profile_id=task.profile_id,
                source_feature_policy="ava-ocr-source-features-1",
                source_layout_policy="ava-native-layout-1",
                responses=[],
                refinements=[],
            ),
        )
        with (
            tempfile.TemporaryDirectory() as temp,
            patch.object(worker, "_prepared_attempt", prepared),
            patch.object(
                worker,
                "prepared_result",
                return_value=SimpleNamespace(model_dump=lambda **kw: {"page_number": 1}),
            ),
            patch.object(worker, "prepare_refinement_from_pages", refine),
        ):
            with self.assertRaises(worker.AttemptFailure) as caught:
                worker.attempt_stream(
                    Path(temp) / "source.pdf",
                    Path(temp) / "work",
                    json_bytes(request),
                    peer.incoming,
                    peer,
                )
        self.assertIs(reached, caught.exception.cause)
        self.assertEqual(
            ["page", "recognition", "anchor_context", "refusal"], [p["kind"] for p in peer.controls]
        )
        self.assertEqual(1, len(captured))
        self.assertEqual(raw["segments"][0]["text"], captured[0].segments[0].text)
        self.assertTrue(captured[0].segments[0].spans[0].style.bold)


if __name__ == "__main__":
    unittest.main()
