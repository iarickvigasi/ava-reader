"""An authored zero-NativeTask PDF crosses Input5, Exchange2, normalization and artifacts."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2 import attempt_stream as worker
from ava_pdf_epub.reconstruction_v2.protocol_native_word_wrap import (
    NativeWordWrapReconstructionInput,
)

from .attempt_peer import PeerOutput
from .word_wrap_stream_fixture import answer, request, source_pdf


class WordWrapAttemptStreamTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = source_pdf(self.root)

    def peer(self, disposition=None):
        tasks = {}

        def callback(packet):
            kind, payload = packet["kind"], packet["payload"]
            if kind in {"page", "refinement_batch", "word_wrap_batch"}:
                tasks.update({task["task_id"]: task for task in payload["tasks"]})
                if kind == "page":
                    self.assertEqual(payload["schema_version"], "ava-prepare-result-4")
                    self.assertEqual(
                        payload["source_normalization_policy"], "ava-native-word-wrap-1"
                    )
                    self.assertEqual(payload["tasks"], [])
                return []
            self.assertEqual(kind, "word_wrap")
            return [answer(tasks[payload["task_id"]], disposition)]

        return PeerOutput(callback)

    def test_zero_native_tasks_still_classify_raw_endings_and_emit_complete_artifacts(self):
        peer = self.peer()
        original = worker.reconstruct_from_pages
        captured = []

        def final(source, scratch, pages, complete):
            captured.append(complete)
            return original(source, scratch, pages, complete)

        with patch.object(worker, "reconstruct_from_pages", side_effect=final):
            worker.attempt_stream(
                self.source, self.root / "attempt", request(self.source), peer.incoming, peer
            )
        self.assertIsInstance(captured[0], NativeWordWrapReconstructionInput)
        self.assertEqual(len(captured[0].word_wrap_responses), 1)
        self.assertEqual(
            [control["kind"] for control in peer.controls],
            ["page", "refinement_batch", "word_wrap_batch", "word_wrap", "artifacts"],
        )
        self.assertTrue(
            all(
                control["schema_version"] == "ava-reconstruction-exchange-2"
                for control in peer.controls
            )
        )
        book = json.loads(peer.decoded_artifacts()["canonical.json"])
        texts = [block["content"]["text"] for block in book["blocks"] if "content" in block]
        self.assertIn("We are transforming stable proof.", texts[0])
        self.assertIn("True long-term compounds", texts[0])
        self.assertEqual(
            book["blocks"][0]["content"]["normalization"]["schema_version"],
            "ava-source-normalization-3",
        )

    def test_unresolved_active_job_emits_refusal_and_never_final_artifacts(self):
        peer = self.peer("unresolved")
        with self.assertRaises(worker.AttemptFailure) as refused:
            worker.attempt_stream(
                self.source, self.root / "attempt", request(self.source), peer.incoming, peer
            )
        self.assertIn("unresolved", str(refused.exception.cause))
        self.assertEqual(peer.controls[-1]["kind"], "refusal")
        self.assertFalse(any(control["kind"] == "artifacts" for control in peer.controls))
