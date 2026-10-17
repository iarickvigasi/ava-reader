"""Input6 crosses unchanged source preparation, and box repair precedes the next phase."""

import contextlib
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2 import attempt_stream as worker
from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.protocol_recognition_geometry import (
    RecognitionGeometryReconstructionInput,
)
from ava_pdf_epub.reconstruction_v2.recognition_geometry_contract import RecognitionGeometryTask

from .attempt_peer import PeerOutput
from .geometry_repair_fixture import authored_fixture, correction
from .test_geometry_attempt import initial
from .word_wrap_stream_fixture import answer, source_pdf


class GeometryStreamTests(unittest.TestCase):
    def test_actual_native_source_completes_input6_with_no_unnecessary_repair(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = source_pdf(root)
            request = initial()
            request["source_sha256"] = hashlib.sha256(source.read_bytes()).hexdigest()
            tasks, captured = {}, []

            def callback(packet):
                kind, payload = packet["kind"], packet["payload"]
                if kind in {"page", "refinement_batch", "word_wrap_batch"}:
                    tasks.update({task["task_id"]: task for task in payload["tasks"]})
                    return []
                self.assertEqual(kind, "word_wrap")
                return [answer(tasks[payload["task_id"]])]

            peer = PeerOutput(callback)
            original = worker.reconstruct_from_pages

            def final(source, scratch, pages, complete):
                captured.append(complete)
                return original(source, scratch, pages, complete)

            with patch.object(worker, "reconstruct_from_pages", side_effect=final):
                worker.attempt_stream(
                    source,
                    root / "attempt",
                    json_bytes(dict(mode="attempt_stream", input=request)),
                    peer.incoming,
                    peer,
                )
            self.assertIsInstance(captured[0], RecognitionGeometryReconstructionInput)
            self.assertEqual(captured[0].geometry_corrections, [])
            book = json.loads(peer.decoded_artifacts()["canonical.json"])
            self.assertEqual(book["source"]["sha256"], request["source_sha256"])
            self.assertEqual(peer.controls[-1]["kind"], "artifacts")

    def test_geometry_proof_is_retained_before_next_refinement_and_raw_bytes_stay_exact(self):
        task, raw, _, _ = authored_fixture()
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
                return [
                    dict(
                        schema_version="ava-recognition-attempt-reply-1",
                        response=json.loads(raw),
                        original_response_json=raw,
                        original_response_sha256=hashlib.sha256(raw.encode()).hexdigest(),
                    )
                ]
            self.assertEqual(packet["kind"], "geometry")
            return [
                correction(RecognitionGeometryTask.model_validate(packet["payload"])).model_dump(
                    mode="json"
                )
            ]

        def refine(source, scratch, current_pages, current):
            captured.append(current)
            raise reached

        peer = PeerOutput(callback)
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
                    json_bytes(dict(mode="attempt_stream", input=initial())),
                    peer.incoming,
                    peer,
                )
        self.assertIs(caught.exception.cause, reached)
        self.assertEqual(
            [p["kind"] for p in peer.controls], ["page", "recognition", "geometry", "refusal"]
        )
        self.assertEqual(captured[0].geometry_corrections[0].original_response_json, raw)
        self.assertEqual(
            captured[0].responses[0].segments[0].text, json.loads(raw)["segments"][0]["text"]
        )
