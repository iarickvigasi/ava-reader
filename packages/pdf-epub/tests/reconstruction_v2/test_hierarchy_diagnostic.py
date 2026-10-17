"""A cached invalid hierarchy remains refused with finite original-source provenance."""

import copy
import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.apply_refinement import apply_refinement
from ava_pdf_epub.reconstruction_v2.refinement_contract import BookRefinementResponse
from ava_pdf_epub.reconstruction_v2.source_refusal import SourceContentRefusal
from ava_pdf_epub.worker_observation_packet import failure

from .refinement_helpers import authored_responses, source_case


class HierarchyDiagnosticTests(unittest.TestCase):
    def test_cached_rank_skipping_parent_keeps_strict_refusal_and_safe_location(self):
        with tempfile.TemporaryDirectory() as temp:
            _, _, _, segments, state, tasks = source_case(Path(temp))
            responses = authored_responses(tasks)
            values = [copy.deepcopy(r.model_dump(mode="json")) for r in responses]
            # Authored H2 is made H1; its following H3 still claims that old H2 as parent.
            changed = next(d for r in values for d in r["decisions"] if d["heading_level"] == 2)
            changed.update(heading_level=1, parent_id=None)
            with self.assertRaises(SourceContentRefusal) as caught:
                apply_refinement(
                    segments,
                    tasks,
                    [BookRefinementResponse.model_validate(v) for v in values],
                    state,
                )
            diagnostic = caught.exception.diagnostic
            self.assertEqual("assembly", diagnostic.stage)
            code, findings, complete = failure(caught.exception, tasks[0].source_sha256)
            self.assertEqual("HEADING_PARENT_MISSING", code)
            self.assertTrue(complete)
            self.assertEqual(1, len(findings))
            segment = next(s for s in segments if s.id == findings[0]["block_id"])
            self.assertEqual(segment.page, findings[0]["page"])
            self.assertEqual(segment.box.model_dump(), findings[0]["box"])
            self.assertTrue(findings[0]["task_id"])
            self.assertNotIn(segment.text, json.dumps(findings))
            self.assertEqual([], state.refinement_evidence)

    def test_unknown_exception_does_not_claim_complete_empty_diagnostics(self):
        self.assertEqual(
            ("RECONSTRUCTION_REVIEW_REQUIRED", [], False),
            failure(ValueError("private source text"), "a" * 64),
        )
