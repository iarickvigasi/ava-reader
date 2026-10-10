"""New instruction identities extend byte-exact history without relaxing host authority."""

import hashlib
import unittest

from ava_pdf_epub.reconstruction_v2 import ordered_list_prompt as history
from ava_pdf_epub.reconstruction_v2 import text_style_prompt as current
from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.source_refusal import SourceContentRefusal

from .response_fixtures import wire_segment
from .test_recognition_coordinates import response_for
from .test_unicode_style_prompt import style_span, versioned_task


class TextStylePrompt(unittest.TestCase):
    def test_historical_thirteen_fourteen_bytes_remain_exact(self):
        for text, digest in [
            (
                history.ORDERED_LIST_PROMPT,
                "b4b059229ed953dc85827025e09837f2257c2769cb4a9dc01e6dacf550e241ea",
            ),
            (
                history.PINNED_ORDERED_LIST_PROMPT,
                "183ac21a4783acfe99fc193ab97cfcfc3a10a170ed05b99bf87e3ac2d747025d",
            ),
        ]:
            self.assertEqual(digest, hashlib.sha256(text.encode()).hexdigest())
        self.assertEqual(
            history.ORDERED_LIST_PROMPT + current.TEXT_STYLE_CONSISTENCY_INSTRUCTIONS,
            current.TEXT_STYLE_PROMPT,
        )
        self.assertEqual(
            history.PINNED_ORDERED_LIST_PROMPT + current.TEXT_STYLE_CONSISTENCY_INSTRUCTIONS,
            current.PINNED_TEXT_STYLE_PROMPT,
        )

    def test_new_versions_are_source_bound_and_retain_quoted_authority(self):
        for old, new in [(13, 15), (14, 16)]:
            before, task = [versioned_task(f"ava-prose-region-{v}") for v in [old, new]]
            self.assertNotEqual(before.task_id, task.task_id)
            self.assertEqual(before.image, task.image)
            self.assertEqual(before.native_evidence, task.native_evidence)
            self.assertEqual(before.source_sha256, task.source_sha256)
            valid = wire_segment(text="x2", spans=[style_span("2", "sub", before="x")])
            self.assertEqual("x2", accept_response(task, response_for(task, [valid]))[0].text)
            numeric = {**style_span("2"), "anchor": None, "start": 1, "end": 2}
            with self.assertRaisesRegex(ValueError, "task version"):
                accept_response(
                    task, response_for(task, [wire_segment(text="x2", spans=[numeric])])
                )
            with self.assertRaisesRegex(ValueError, "another source/task/render"):
                accept_response(task, response_for(before, [valid]))

    def test_essential_uncertainty_is_retained_as_source_refusal(self):
        task = versioned_task("ava-prose-region-15")
        raw = response_for(task, [wire_segment()]).model_dump()
        raw["unresolved"] = ["Essential character identity cannot be established"]
        response = type(response_for(task, [wire_segment()])).model_validate(raw)
        with self.assertRaises(SourceContentRefusal) as caught:
            accept_response(task, response)
        finding = caught.exception.diagnostic.findings[0]
        self.assertEqual("RECOGNITION_UNRESOLVED", finding.code)
        self.assertEqual(task.task_id, finding.task_id)
        self.assertEqual(task.source_sha256, caught.exception.diagnostic.source_sha256)
