"""The actual worker seam validates source2 before advancing; no provider or book run."""

import contextlib
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2 import attempt_stream as worker
from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.prepared_native_structure_v2 import NativeStructure2PreparedPage

from .attempt_peer import PeerOutput
from .native_structure_v2_fixture import initial2, native_structure2_source_fixture


class AttemptNativeStructure2Tests(unittest.TestCase):
    def run_authored(self, invalid=False):
        observation, task, answer, candidate = native_structure2_source_fixture()
        page = NativeStructure2PreparedPage.model_validate(
            dict(
                schema_version="ava-prepared-page-5",
                source_layout_policy="ava-native-layout-1",
                source_structure_policy="ava-native-structure-2",
                source_normalization_policy="ava-native-word-wrap-1",
                profile_id=task.profile_id,
                source_sha256=task.source_sha256,
                source_byte_length=10000,
                source_page_count=1,
                observation=observation,
                tables=[],
                native_segments=[],
                tasks=[task],
                layout_hyphen_candidates=[candidate],
            )
        )
        raw = answer.model_dump(mode="json")
        raw["groups"].reverse()
        if invalid:
            raw["groups"][1]["chapter_role"] = "bodymatter"
        prep = SimpleNamespace(check_unchanged=lambda: None, verify_inputs=lambda: None)

        class Pages(list):
            def verify(self):
                pass

            def clear_cache(self):
                pass

        pages = Pages([page])

        @contextlib.contextmanager
        def prepared(*args):
            yield prep, pages

        captured = []
        reached = RuntimeError("AUTHORED_NATIVE2_REFINEMENT_REACHED")

        def refine(source, scratch, current_pages, current):
            captured.append(current)
            raise reached

        def callback(packet):
            if packet["kind"] == "page":
                self.assertEqual(packet["payload"]["schema_version"], "ava-prepare-result-5")
                return []
            self.assertEqual(packet["kind"], "native_structure")
            self.assertEqual(packet["schema_version"], "ava-native-structure-exchange-2")
            self.assertEqual(packet["payload"], {"task_id": task.task_id})
            return [raw]

        peer = PeerOutput(callback)
        request = {**initial2(), "profile_id": task.profile_id}
        with (
            tempfile.TemporaryDirectory() as temp,
            patch.object(worker, "_prepared_attempt", prepared),
            patch.object(worker, "prepare_refinement_from_pages", refine),
        ):
            with self.assertRaises(worker.AttemptFailure) as caught:
                worker.attempt_stream(
                    Path(temp) / "source.pdf",
                    Path(temp) / "scratch",
                    json_bytes(dict(mode="attempt_stream", input=request)),
                    peer.incoming,
                    peer,
                )
        self.assertEqual(
            [p["kind"] for p in peer.controls], ["page", "native_structure", "refusal"]
        )
        if invalid:
            self.assertEqual(captured, [])
            self.assertIsNot(caught.exception.cause, reached)
        else:
            self.assertIs(caught.exception.cause, reached)
            self.assertEqual(captured[0].schema_version, "ava-reconstruct-input-8")
            self.assertEqual(captured[0].native_structure_responses[0].model_dump(mode="json"), raw)
            self.assertEqual(len(captured[0].native_structure_responses), 1)

    def test_source2_validation_precedes_refinement_and_preserves_raw2(self):
        self.run_authored()

    def test_irrelevant_native2_role_fields_refuse_before_next_stage(self):
        self.run_authored(invalid=True)
