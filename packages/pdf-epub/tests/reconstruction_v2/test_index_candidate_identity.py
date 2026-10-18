"""Candidate data changes request identity, never the image, prompt or source checks."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from pydantic import ValidationError

from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.index_page_projection import index_page_projection
from ava_pdf_epub.reconstruction_v2.make_task import make_task
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse, RecognitionTask
from ava_pdf_epub.reconstruction_v2.task_identity import task_identifier

from .index_projection_fixture import projection_case


class IndexCandidateIdentityTests(unittest.TestCase):
    def test_old_receipts_and_edited_evidence_cannot_bind_to_new_candidates(self):
        with tempfile.TemporaryDirectory() as d:
            checkpoint, owners, _ = projection_case(Path(d), fused=True)
            task = checkpoint.tasks[0]
            evidence = json.loads(task.native_evidence)
            self.assertFalse(evidence["reliable"])
            self.assertEqual([], evidence["lines"])
            self.assertIn("untrusted_index_candidates", evidence)
            del evidence["untrusted_index_candidates"]
            old = task.model_dump()
            old["native_evidence"] = json.dumps(evidence, ensure_ascii=False, separators=(",", ":"))
            old["native_evidence_sha256"] = hashlib.sha256(
                old["native_evidence"].encode()
            ).hexdigest()
            old["task_id"] = task_identifier(old)
            historical = RecognitionTask.model_validate(old)
            self.assertNotEqual(historical.task_id, task.task_id)
            self.assertEqual(historical.image, task.image)
            self.assertEqual(historical.prompt_version, task.prompt_version)
            response = RecognitionResponse(
                schema_version="ava-recognition-response-2",
                task_id=historical.task_id,
                source_sha256=task.source_sha256,
                render_sha256=task.image.sha256,
                segments=[],
                unresolved=[],
                language="en",
            )
            with self.assertRaisesRegex(ValueError, "another source/task/render"):
                accept_response(task, response)
            forged = task.model_copy(update={"native_evidence": historical.native_evidence})
            with self.assertRaises(ValidationError):
                RecognitionTask.model_validate(forged.model_dump())
            wrong = owners[0].model_copy(update={"text": "älpha0 10"})
            self.assertIsNone(index_page_projection(checkpoint, [wrong, *owners[1:]], POLICY))
            self.assertEqual("älpha0 10", wrong.text)

    def test_non_index_prompt_purpose_and_partial_region_do_not_receive_hints(self):
        with tempfile.TemporaryDirectory() as d:
            checkpoint, _, _ = projection_case(Path(d))
            task = checkpoint.tasks[0]
            partial = task.region_box.model_copy(update={"y0": 80.0})
            for region, purpose, prompt in [
                (task.region_box, "pdf_structure_repair", "ava-prose-region-15"),
                (task.region_box, "pdf_region_recognition", task.prompt_version),
                (partial, task.purpose, task.prompt_version),
            ]:
                result = make_task(
                    checkpoint.observation,
                    task.source_sha256,
                    region,
                    Path(d),
                    purpose=purpose,
                    profile_id=task.profile_id,
                    prompt_version=prompt,
                )
                self.assertEqual(
                    {"reliable": False, "lines": []}, json.loads(result.native_evidence)
                )
