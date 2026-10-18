"""Real source crops retain every required role while title and optional work share 32 slots."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.refinement_feature_comparisons import feature_comparisons
from ava_pdf_epub.reconstruction_v2.source_feature_contract import FEATURE_POLICY
from ava_pdf_epub.reconstruction_v2.source_refusal import SourceContentRefusal

from .feature_budget_fixture import feature_book


class FeatureTotalBudgetTests(unittest.TestCase):
    def test_current_book_reviews_all_27_required_roles_within_remaining_slots(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source, pages, segments, state = feature_book(scratch)
            tasks = feature_comparisons(
                source,
                scratch,
                pages,
                segments,
                state,
                28,
                FEATURE_POLICY,
                state.source_title_policy,
            )
            roles = [
                q.node_id
                for t in tasks
                for q in getattr(t, "source_features", [])
                if q.allowed_roles
            ]
            self.assertEqual([f"quote{i}" for i in range(27)], roles)
            self.assertEqual("ava-printed-title-2", tasks[-1].prompt_version)
            self.assertLessEqual(28 + len(tasks), 32)
            self.assertTrue(all(len(t.source_features) <= 24 for t in tasks[:-1]))

    def test_absent_title_reserves_zero_but_required_roles_cannot_skip(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source, pages, segments, state = feature_book(scratch, title=False)
            tasks = feature_comparisons(
                source,
                scratch,
                pages,
                segments,
                state,
                29,
                FEATURE_POLICY,
                state.source_title_policy,
            )
            self.assertEqual(32, 29 + len(tasks))
            self.assertEqual(27, sum(len(t.source_features) for t in tasks))
            with self.assertRaises(SourceContentRefusal):
                feature_comparisons(
                    source,
                    scratch,
                    pages,
                    segments,
                    state,
                    30,
                    FEATURE_POLICY,
                    state.source_title_policy,
                )
