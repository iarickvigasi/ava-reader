"""Observed regular/reset and role/style patches conserve every immutable source field."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.apply_refinement import apply_refinement
from ava_pdf_epub.reconstruction_v2.findings import Finding
from ava_pdf_epub.reconstruction_v2.source_feature_binding import bind_source_features
from ava_pdf_epub.reconstruction_v2.source_feature_coverage_contract import SourceFeatureCoverage

from .source_feature_answers import decisions
from .source_feature_fixtures import QUOTE, case


class FeatureApplication(unittest.TestCase):
    def test_quote_newlines_spans_and_chapter_identity_remain_exact(self):
        with tempfile.TemporaryDirectory() as d:
            _, _, segments, state, tasks = case(Path(d))
            finding = Finding(
                code="UNRELATED_SOURCE_SIGNAL",
                message="Unresolved independent signal",
                severity="review",
                block_id="heading",
            )
            state.structure_findings.append(finding)
            answers = [
                decisions(
                    t,
                    {
                        ("quoted", "block_inset"): dict(value=2.0),
                        ("quoted", "first_line_indent"): dict(value=1.0),
                    },
                )
                for t in tasks
            ]
            updated = apply_refinement(segments, tasks, answers, state)
            old, new = {s.id: s for s in segments}, {s.id: s for s in updated}
            self.assertEqual("quote", new["quoted"].kind)
            self.assertEqual(QUOTE, new["quoted"].text)
            self.assertEqual(old["quoted"].spans, new["quoted"].spans)
            for ident in old:
                self.assertEqual(
                    old[ident].model_dump(exclude={"kind", "style"}),
                    new[ident].model_dump(exclude={"kind", "style"}),
                )
            self.assertFalse(new["heading"].style.bold)
            self.assertEqual(0, new["short"].style.indent_em or 0)
            self.assertEqual(2, new["quoted"].style.block_indent_em)
            self.assertEqual([finding], state.structure_findings)
            bind_source_features(state)
            ledger = SourceFeatureCoverage.model_validate(
                dict(
                    policy_id="ava-ocr-source-features-1",
                    requested_features=state.requested_source_features,
                    inspected_features=state.requested_source_features,
                    uninspected_features=0,
                    unrequested_optional_candidates=0,
                    evidence=state.source_feature_evidence,
                )
            )
            self.assertEqual(15, len(ledger.evidence))
            self.assertTrue(
                all(e.canonical_block_id and e.canonical_start == 0 for e in ledger.evidence)
            )

    def test_optional_unknown_does_not_create_a_style_default(self):
        with tempfile.TemporaryDirectory() as d:
            _, _, segments, state, tasks = case(Path(d))
            updated = apply_refinement(
                segments,
                tasks,
                [
                    decisions(
                        t,
                        {
                            ("short", "family"): dict(
                                disposition="unknown", value=None, reason="source_blurred"
                            )
                        },
                    )
                    for t in tasks
                ],
                state,
            )
            self.assertIsNone(next(s for s in updated if s.id == "short").style.family)
            self.assertTrue(
                any(
                    e["node_id"] == "short" and e["disposition"] == "unknown"
                    for e in state.source_feature_evidence
                )
            )
