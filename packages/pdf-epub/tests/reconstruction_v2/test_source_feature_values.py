"""Finite styles retain explicit false/zero and only host-supported non-applicability."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.refinement_response import accept_refinement

from .source_feature_answers import decisions, remake
from .source_feature_fixtures import case


class FeatureValues(unittest.TestCase):
    def test_generic_families_explicit_regular_and_zero_are_observed_values(self):
        with tempfile.TemporaryDirectory() as d:
            *_, tasks = case(Path(d))
            for family in ["serif", "sans-serif", "monospace"]:
                for task in tasks:
                    response = decisions(
                        task,
                        {(q.node_id, "family"): dict(value=family) for q in task.source_features},
                    )
                    accept_refinement(task, response)
                    for decision in response.feature_decisions:
                        self.assertFalse(
                            next(f.value for f in decision.features if f.feature == "weight")
                        )
                        for feature in decision.features:
                            if feature.feature in {"block_inset", "first_line_indent"}:
                                self.assertEqual(0, feature.value)

    def test_not_applicable_needs_host_heading_role_and_exact_reason(self):
        with tempfile.TemporaryDirectory() as d:
            *_, tasks = case(Path(d), include_quote=False)
            original = tasks[0]
            raw = original.model_dump(mode="json")
            request = next(q for q in raw["source_features"] if q["node_id"] == "heading")
            request["requested_features"] = ["first_line_indent"]
            raw["source_features"] = [request]
            raw["crops"] = [c for c in raw["crops"] if c["request_node_id"] == "heading"]
            task = remake(original, **{k: v for k, v in raw.items() if k != "task_id"})
            response = decisions(
                task,
                {
                    ("heading", "first_line_indent"): dict(
                        disposition="not_applicable",
                        value=None,
                        reason="heading_has_no_prose_first_line",
                    )
                },
            )
            accept_refinement(task, response)
            bad = decisions(
                task,
                {
                    ("heading", "first_line_indent"): dict(
                        disposition="not_applicable",
                        value=0.0,
                        reason="heading_has_no_prose_first_line",
                    )
                },
            )
            with self.assertRaises(ValueError):
                accept_refinement(task, bad)

    def test_numeric_boolean_or_out_of_range_appearance_guesses_refuse(self):
        with tempfile.TemporaryDirectory() as d:
            *_, tasks = case(Path(d))
            task = tasks[0]
            for feature, value in [
                ("weight", 1.0),
                ("relative_size", True),
                ("relative_size", 4.0),
                ("family", "paragraph"),
                ("block_inset", -1.0),
            ]:
                with self.subTest(feature=feature, value=value), self.assertRaises(ValueError):
                    accept_refinement(
                        task, decisions(task, {("quoted", feature): dict(value=value)})
                    )
