"""Optional comparison bounds preserve unknowns; essential role checks cannot silently skip."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.source_refusal import SourceContentRefusal

from .source_feature_fixtures import case


class FeatureBudget(unittest.TestCase):
    def test_optional_budget_exhaustion_records_unknown_without_spending_but_essential_cannot_skip(
        self,
    ):
        with tempfile.TemporaryDirectory() as d:
            _, _, _, state, tasks = case(Path(d), include_quote=False, existing_tasks=32)
            self.assertEqual([], tasks)
            self.assertEqual(8, state.requested_source_features)
            self.assertEqual(8, len(state.source_feature_evidence))
            self.assertTrue(
                all(
                    e["reason"] == "comparison_budget_bound" and e["task_id"] is None
                    for e in state.source_feature_evidence
                )
            )
        with tempfile.TemporaryDirectory() as d, self.assertRaises(SourceContentRefusal):
            case(Path(d), existing_tasks=32)
