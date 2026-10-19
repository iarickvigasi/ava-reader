"""Real source crops retain every required role while title and optional work share the current64 slots."""

import tempfile
import unittest
from dataclasses import asdict
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.refinement_feature_comparisons import feature_comparisons
from ava_pdf_epub.reconstruction_v2.source_feature_contract import FEATURE_POLICY
from ava_pdf_epub.reconstruction_v2.source_refusal import SourceContentRefusal

from .feature_budget_fixture import feature_book
from .source_feature_fixtures import case


class FeatureTitleReservationTests(unittest.TestCase):
    def test_title_slot_precedes_optional_budget_without_creating_a_65th_task(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source, page, segments, state, _ = case(scratch, include_quote=False)
            state.source_title_policy = "ava-frontmatter-title-1"
            state.source_continuation_policy = "ava-source-continuation-presentation-1"
            tasks = feature_comparisons(
                source,
                scratch,
                [page],
                segments,
                state,
                63,
                FEATURE_POLICY,
                state.source_title_policy,
            )
            self.assertEqual(["ava-printed-title-2"], [t.prompt_version for t in tasks])
            self.assertEqual(8, len(state.source_feature_evidence))
            self.assertTrue(
                all(e["disposition"] == "unknown" for e in state.source_feature_evidence)
            )

    def test_legacy_24_cap_and_current_early_title_failure_are_explicit(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source, pages, segments, state = feature_book(scratch, current=False)
            with self.assertRaises(SourceContentRefusal):
                feature_comparisons(
                    source, scratch, pages, segments, state, 0, FEATURE_POLICY, None
                )
            state.source_title_policy = "ava-frontmatter-title-1"
            state.source_continuation_policy = "ava-source-continuation-presentation-1"
            before = asdict(state)
            (scratch / pages[0].observation.render_path).write_bytes(b"changed source pixels")
            with self.assertRaisesRegex(ValueError, "source render is stale"):
                feature_comparisons(
                    source,
                    scratch,
                    pages,
                    segments,
                    state,
                    0,
                    FEATURE_POLICY,
                    state.source_title_policy,
                )
            self.assertEqual(before, asdict(state))
