"""Input5 is an explicit closed empty initial packet; prior versions retain their markers."""

import unittest

from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.attempt_stream import _input, initial_input
from ava_pdf_epub.reconstruction_v2.protocol_native_word_wrap import (
    NativeWordWrapReconstructionInput,
)

from .word_wrap_fixture import word_wrap_batch
from .word_wrap_stream_fixture import answer, initial


class WordWrapInitialTests(unittest.TestCase):
    def test_closed_empty_initial_and_complete_response_round_trip(self):
        current = initial_input(json_bytes(dict(mode="attempt_stream", input=initial())))
        self.assertIsInstance(current, NativeWordWrapReconstructionInput)
        receipt = answer(word_wrap_batch().tasks[0].model_dump(mode="json"), "literal")
        complete = _input(current, [], [], [], [receipt])
        self.assertIsInstance(complete, NativeWordWrapReconstructionInput)
        self.assertEqual(complete.word_wrap_responses[0].task_id, receipt["task_id"])
        self.assertEqual(current.word_wrap_responses, [])

    def test_missing_policy_unknown_fields_or_prior_decisions_refuse_before_preparation(self):
        raw = initial()
        receipt = answer(word_wrap_batch().tasks[0].model_dump(mode="json"), "literal")
        cases = [
            {key: value for key, value in raw.items() if key != "source_normalization_policy"},
            {**raw, "source_normalization_policy": None},
            {**raw, "unknown": True},
            {**raw, "word_wrap_responses": [receipt]},
            {**raw, "native_structure_responses": [{}]},
        ]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(ValueError):
                initial_input(json_bytes(dict(mode="attempt_stream", input=case)))

    def test_word_wrap_fields_cannot_downgrade_to_historical_input(self):
        for marker in (
            "ava-reconstruct-input-1",
            "ava-reconstruct-input-3",
            "ava-reconstruct-input-4",
        ):
            with self.subTest(marker=marker), self.assertRaises(ValueError):
                initial_input(
                    json_bytes(
                        dict(
                            mode="attempt_stream",
                            input={
                                **initial(),
                                "schema_version": marker,
                            },
                        )
                    )
                )
