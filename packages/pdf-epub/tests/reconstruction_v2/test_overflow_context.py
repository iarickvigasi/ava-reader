"""A new raw-candidate boundary cannot widen canonical anchors or the historical task."""

import copy
import unittest

from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.overflow_context_apply import apply_overflow_context
from ava_pdf_epub.reconstruction_v2.overflow_context_prepare import prepare_overflow_context
from ava_pdf_epub.reconstruction_v2.recognition_anchor_context import prepare_anchor_context
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse
from ava_pdf_epub.reconstruction_v2.validate_tasks import validate_tasks

from .overflow_context_fixture import overflow_fixture
from .test_recognition_anchor_context import correction


class OverflowContextTests(unittest.TestCase):
    def test_context_only_repair_preserves_raw_source_and_reaches_normal_acceptance(self):
        parent, raw = overflow_fixture()
        original = copy.deepcopy(raw)
        wire = json_bytes(raw).decode()
        for operation in (
            lambda: RecognitionResponse.model_validate(raw),
            lambda: prepare_anchor_context(parent, wire),
        ):
            with self.assertRaises(ValueError):
                operation()
        task = prepare_overflow_context(parent, wire)
        self.assertEqual("ava-recognition-anchor-context-task-2", task.schema_version)
        self.assertEqual(["CONTEXT_LIMIT", "AMBIGUOUS_CONTEXT"], [s.reason for s in task.slots])
        self.assertEqual(wire, task.original_response_json)
        patched = apply_overflow_context(parent, task, correction(task))
        self.assertEqual(original, raw)
        self.assertEqual(
            1,
            validate_tasks(
                json_bytes(
                    dict(
                        mode="validate_tasks",
                        tasks=[parent.model_dump(mode="json")],
                        responses=[patched],
                    )
                )
            ).task_count,
        )
        for before, after in zip(raw["segments"], patched["segments"], strict=True):
            self.assertEqual(before["text"], after["text"])
            self.assertEqual(before["spans"][0]["style"], after["spans"][0]["style"])
            self.assertEqual(
                before["spans"][0]["anchor"]["exact_text"],
                after["spans"][0]["anchor"]["exact_text"],
            )

    def test_context_limit_uses_unicode_scalars_and_does_not_authorize_a_long_output(self):
        parent, raw = overflow_fixture()
        raw["segments"][0]["spans"][0]["anchor"]["before"] = "😀" * 129
        task = prepare_overflow_context(parent, json_bytes(raw).decode())
        reply = correction(task).model_dump(mode="json")
        reply["patches"][0]["before"] = "😀" * 129
        from ava_pdf_epub.reconstruction_v2.recognition_anchor_context import (
            RecognitionAnchorContextResponse,
        )

        with self.assertRaises(ValueError):
            RecognitionAnchorContextResponse.model_validate(reply)

    def test_missing_duplicate_foreign_or_still_invalid_reply_remains_terminal(self):
        parent, raw = overflow_fixture()
        task = prepare_overflow_context(parent, json_bytes(raw).decode())
        reply = correction(task)
        for value in (
            reply.model_copy(update={"patches": reply.patches[:1]}),
            reply.model_copy(update={"patches": [reply.patches[0]] * 2}),
            reply.model_copy(update={"original_response_sha256": "b" * 64}),
            reply.model_copy(
                update={
                    "patches": [
                        p.model_copy(update={"before": "", "after": ""}) for p in reply.patches
                    ]
                }
            ),
        ):
            with self.assertRaises(ValueError):
                apply_overflow_context(parent, task, value)
