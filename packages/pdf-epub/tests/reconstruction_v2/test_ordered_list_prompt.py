"""Instructions are new task identities; old receipts retain exact instruction bytes."""

import hashlib
import unittest

from ava_pdf_epub.reconstruction_v2 import ordered_list_prompt as prompts
from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse
from ava_pdf_epub.reconstruction_v2.recognition_prompt import (
    PINNED_UNICODE_PROMPT,
    UNICODE_STYLE_PROMPT,
)

from .response_fixtures import wire_segment
from .test_pinned_table_cells import fixture as pinned_fixture
from .test_recognition_coordinates import response_for
from .test_unicode_style_prompt import style_span, versioned_task


class OrderedListPrompt(unittest.TestCase):
    def test_historical_unicode_prompts_are_byte_exact(self):
        for text, digest in [
            (
                UNICODE_STYLE_PROMPT,
                "dc09798ec9e38afa7bd26e72b658b2e12625213348486d8fe0edbbb65efd65fb",
            ),
            (
                PINNED_UNICODE_PROMPT,
                "63803f6f6a1281f1ed829358e7809a5ad8ecad50d5c6c6335e8a5af6bbef7b8e",
            ),
        ]:
            self.assertEqual(digest, hashlib.sha256(text.encode()).hexdigest())

    def test_new_instructions_extend_exact_historical_prompts(self):
        self.assertEqual(
            UNICODE_STYLE_PROMPT + prompts.ORDERED_LIST_INSTRUCTIONS, prompts.ORDERED_LIST_PROMPT
        )
        self.assertEqual(
            PINNED_UNICODE_PROMPT + prompts.ORDERED_LIST_INSTRUCTIONS,
            prompts.PINNED_ORDERED_LIST_PROMPT,
        )
        for token in ["EVERY ordered item", "a. -> 1, b. -> 2", "ii. -> 2", "unresolved"]:
            self.assertIn(token, prompts.ORDERED_LIST_INSTRUCTIONS)

    def test_new_versions_are_distinct_source_bound_tasks_with_exact_anchor_authority(self):
        for old, new in [(11, 13), (12, 14)]:
            a, b = [versioned_task(f"ava-prose-region-{v}") for v in [old, new]]
            self.assertNotEqual(a.task_id, b.task_id)
            self.assertEqual(a.image, b.image)
            self.assertEqual(a.source_sha256, b.source_sha256)
            exact = wire_segment(text="x2", spans=[style_span("2", "sub", before="x")])
            self.assertEqual(1, accept_response(b, response_for(b, [exact]))[0].spans[0].start)
            exact["spans"][0].update(anchor=None, start=1, end=2)
            with self.assertRaisesRegex(ValueError, "task version"):
                accept_response(b, response_for(b, [exact]))
        with self.assertRaises(ValueError):
            versioned_task("ava-prose-region-17")

    def test_only_pinned_version_can_resolve_measured_cells(self):
        task, raw, source = pinned_fixture("ava-prose-region-14")
        cell = raw["segments"][0]["cells"][0][0]
        cell["spans"] = [style_span(cell["text"])]
        observed = accept_response(task, RecognitionResponse.model_validate(raw))[0]
        self.assertEqual(source.cells[0][0].box, observed.cells[0][0].box)
        self.assertEqual(source.cells[0][0].column_span, observed.cells[0][0].column_span)
        self.assertEqual(cell["text"], observed.cells[0][0].text)
        task, raw, _ = pinned_fixture("ava-prose-region-13")
        with self.assertRaises(ValueError):
            accept_response(task, RecognitionResponse.model_validate(raw))
