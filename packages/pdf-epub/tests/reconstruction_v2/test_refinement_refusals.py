"""Changed IDs, hashes, text and ancestry cannot be accepted as refinement."""

import copy
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.apply_refinement import apply_refinement
from ava_pdf_epub.reconstruction_v2.refinement_contract import BookRefinementResponse
from ava_pdf_epub.reconstruction_v2.refinement_response import accept_refinement

from .refinement_helpers import authored_responses, source_case


class RefinementRefusalsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.case = source_case(Path(cls.directory.name))
        cls.receipts = authored_responses(cls.case[-1])

    @classmethod
    def tearDownClass(cls):
        cls.directory.cleanup()

    def test_changed_scope_or_replacement_content_is_rejected(self):
        task, response = self.case[-1][0], self.receipts[0]
        raw = response.model_dump(mode="json")
        mutations = [
            lambda r: r.update(task_id="different"),
            lambda r: r.update(source_sha256="0" * 64),
            lambda r: r.update(observation_sha256="0" * 64),
            lambda r: r.update(image_sha256="0" * 64),
            lambda r: r.update(unresolved=["essential rank uncertain"]),
            lambda r: r["decisions"].pop(),
            lambda r: r["decisions"].append(r["decisions"][0]),
            lambda r: r["decisions"][0].update(text="rewritten source"),
            lambda r: r["decisions"][0].update(text_sha256="0" * 64),
            lambda r: r["decisions"][0].update(node_id="invented"),
            lambda r: r["decisions"][0].update(parent_id="invented"),
            lambda r: r["decisions"][0].update(evidence_ids=["crop-invented"]),
            lambda r: r["decisions"][0]["style"].update(relative_size=None),
            lambda r: r["decisions"][0]["style"].update(bold=None),
        ]
        for change in mutations:
            with self.subTest(change=mutations.index(change)), self.assertRaises(ValueError):
                value = copy.deepcopy(raw)
                change(value)
                accept_refinement(task, BookRefinementResponse.model_validate(value))

    def test_later_self_and_missing_parents_fail_before_evidence_is_attached(self):
        _, _, _, segments, state, tasks = self.case
        for parent in ("invented", segments[-2].id):
            values = [r.model_dump(mode="json") for r in self.receipts]
            target = next(d for r in values for d in r["decisions"] if d["heading_level"] == 3)
            target["parent_id"] = parent
            with self.assertRaisesRegex(ValueError, "parent|ancestor"):
                apply_refinement(
                    segments,
                    tasks,
                    [BookRefinementResponse.model_validate(v) for v in values],
                    state,
                )
            self.assertEqual([], state.refinement_evidence)

    def test_changed_original_text_is_not_patched_by_old_receipt(self):
        _, _, _, segments, state, tasks = self.case
        changed = [segments[0].model_copy(update={"text": "other text"}), *segments[1:]]
        with self.assertRaisesRegex(ValueError, "observation identity"):
            apply_refinement(changed, tasks, self.receipts, state)
