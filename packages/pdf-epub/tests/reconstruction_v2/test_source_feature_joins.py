"""A denied prose join stays denied after quote classification; true conflicts still refuse."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.apply_refinement import apply_refinement

from .source_feature_answers import decisions
from .source_feature_fixtures import case
from .source_feature_join_fixture import join_fixture


class FeatureJoins(unittest.TestCase):
    def test_false_join_and_quote_feature_compose_without_rewriting_or_merging(self):
        with tempfile.TemporaryDirectory() as d:
            _, _, segments, state, tasks = case(Path(d))
            feature = next(
                t for t in tasks if any(q.node_id == "quoted" for q in t.source_features)
            )
            legacy, response = join_fixture(feature, False)
            result = apply_refinement(
                segments, [legacy, *tasks], [response, *[decisions(t) for t in tasks]], state
            )
            self.assertEqual("quote", next(s for s in result if s.id == "quoted").kind)
            self.assertEqual([s.text for s in segments], [s.text for s in result])
            self.assertFalse(state.refined_joins[("quoted", "body")])

    def test_true_join_conflicting_with_source_quote_role_refuses(self):
        with tempfile.TemporaryDirectory() as d:
            _, _, segments, state, tasks = case(Path(d))
            feature = next(
                t for t in tasks if any(q.node_id == "quoted" for q in t.source_features)
            )
            legacy, response = join_fixture(feature, True)
            with self.assertRaisesRegex(ValueError, "not prose"):
                apply_refinement(
                    segments, [legacy, *tasks], [response, *[decisions(t) for t in tasks]], state
                )
