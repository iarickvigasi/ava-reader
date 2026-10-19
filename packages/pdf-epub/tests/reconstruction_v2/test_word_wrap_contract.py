"""Provider authority is a complete ordered finite decision set over an exact private task."""

import unittest

from pydantic import ValidationError

from ava_pdf_epub.reconstruction_v2.word_wrap_classifications import word_wrap_classifications
from ava_pdf_epub.reconstruction_v2.word_wrap_contract import WordWrapResponse, WordWrapTask
from ava_pdf_epub.reconstruction_v2.word_wrap_identity import word_wrap_public_task
from ava_pdf_epub.reconstruction_v2.word_wrap_response import validate_word_wrap_response

from .word_wrap_fixture import word_wrap_batch


def response(task, decisions=None):
    return dict(
        schema_version="ava-native-word-wrap-response-1",
        task_id=task.task_id,
        source_sha256=task.source_sha256,
        observation_sha256=task.observation_sha256,
        catalogue_sha256=task.catalogue_sha256,
        decisions=decisions or [dict(id=entry.id, disposition="layout") for entry in task.entries],
    )


class WordWrapContractTests(unittest.TestCase):
    def test_public_entries_have_only_opaque_ids_role_language_and_exact_context(self):
        task = word_wrap_batch().tasks[0]
        public = word_wrap_public_task(task)
        self.assertEqual(set(public["entries"][0]), {"id", "role", "language", "context"})
        self.assertEqual(public["entries"][0]["context"], "form-\nation.")
        self.assertNotIn("final-owner", str(public))
        accepted = WordWrapResponse.model_validate(response(task))
        receipt = word_wrap_classifications(task, accepted)[0]
        self.assertEqual(receipt.decision, "layout")
        self.assertEqual(receipt.candidate_id, task.entries[0].candidate.id)

    def test_response_rejects_missing_duplicate_reordered_foreign_and_prose(self):
        task = word_wrap_batch(2).tasks[0]
        for decisions in (
            [dict(id="w00001", disposition="literal")],
            [dict(id="w00001", disposition="literal")] * 2,
            [dict(id="w00002", disposition="literal"), dict(id="w00001", disposition="literal")],
            [dict(id="w00001", disposition="literal"), dict(id="w09999", disposition="literal")],
        ):
            with self.subTest(decisions=decisions), self.assertRaises(ValueError):
                validate_word_wrap_response(
                    task, WordWrapResponse.model_validate(response(task, decisions))
                )
        raw = response(task)
        raw["explanation"] = "untrusted replacement prose"
        with self.assertRaises(ValidationError):
            WordWrapResponse.model_validate(raw)

    def test_response_rejects_every_changed_binding(self):
        task = word_wrap_batch().tasks[0]
        for field in ("task_id", "source_sha256", "observation_sha256", "catalogue_sha256"):
            raw = response(task)
            raw[field] = "foreign" if field == "task_id" else "d" * 64
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate_word_wrap_response(task, WordWrapResponse.model_validate(raw))

    def test_task_rejects_tampered_context_or_original_witness(self):
        task = word_wrap_batch().tasks[0]
        for field in ("context", "source_pair"):
            raw = task.model_dump()
            raw["entries"][0][field] = "different-\nword"
            with self.subTest(field=field), self.assertRaises(ValidationError):
                WordWrapTask.model_validate(raw)

    def test_unresolved_receipt_is_parseable_but_refused_before_later_dispatch(self):
        task = word_wrap_batch().tasks[0]
        accepted = WordWrapResponse.model_validate(
            response(task, [dict(id="w00001", disposition="unresolved")])
        )
        self.assertEqual(accepted.decisions[0].disposition, "unresolved")
        with self.assertRaisesRegex(ValueError, "remains unresolved"):
            validate_word_wrap_response(task, accepted)
        with self.assertRaisesRegex(ValueError, "remains unresolved"):
            word_wrap_classifications(task, accepted)
