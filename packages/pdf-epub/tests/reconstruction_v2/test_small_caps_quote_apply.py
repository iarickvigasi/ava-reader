"""A separate Task3 changes only anchored metadata and rechecks the selected word."""

import copy
import unittest

from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.recognition_anchor_quote import (
    apply_anchor_quote,
    prepare_anchor_quote,
    validate_anchor_quote,
)
from ava_pdf_epub.reconstruction_v2.recognition_anchor_quote_contract import (
    RecognitionAnchorQuoteTask,
)
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse

from .small_caps_fixture import correction, fixture


class SmallCapsApply(unittest.TestCase):
    def test_current_task_reuses_response2_and_preserves_all_other_data(self):
        parent, raw = fixture()
        before = copy.deepcopy(raw)
        with self.assertRaises(ValueError):
            prepare_anchor_quote(parent, json_bytes(raw).decode())
        task = prepare_anchor_quote(parent, json_bytes(raw).decode(), small_caps=True)
        self.assertEqual("ava-recognition-anchor-quote-task-3", task.schema_version)
        self.assertEqual([["BC"]], [s.allowed_quotations for s in task.slots])
        with self.assertRaises(ValueError):
            RecognitionAnchorQuoteTask.model_validate(task.model_dump())
        checked = validate_anchor_quote(
            json_bytes(
                dict(
                    mode="validate_anchor_quote",
                    task=parent.model_dump(mode="json"),
                    correction=task.model_dump(mode="json"),
                )
            )
        )
        self.assertEqual(task.task_id, checked["task_id"])
        result = apply_anchor_quote(parent, task, correction(task))
        RecognitionResponse.model_validate(result)
        result["segments"][0]["spans"][0]["anchor"] = before["segments"][0]["spans"][0]["anchor"]
        self.assertEqual(before, result)
        self.assertEqual(before, raw)

    def test_offered_whole_word_does_not_allow_selecting_inner_substring(self):
        parent, raw = fixture()
        task = prepare_anchor_quote(parent, json_bytes(raw).decode(), small_caps=True)
        with self.assertRaisesRegex(ValueError, "SELECTED_RANGE_NOT_WHOLE_TOKEN"):
            apply_anchor_quote(parent, task, correction(task, "and A", "D."))

    def test_reference_or_noncase_task_cannot_acquire_task3(self):
        parent, raw = fixture()
        raw["segments"][0]["spans"][0]["url"] = "https://example.com"
        with self.assertRaises(ValueError):
            prepare_anchor_quote(parent, json_bytes(raw).decode(), small_caps=True)
        parent, raw = fixture("A bc then bc.")
        with self.assertRaisesRegex(ValueError, "REQUIRES_DISTINCT_CASE"):
            prepare_anchor_quote(parent, json_bytes(raw).decode(), small_caps=True)
