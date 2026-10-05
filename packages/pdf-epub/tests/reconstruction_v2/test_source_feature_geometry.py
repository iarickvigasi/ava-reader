"""The target/source column context is complete and physically comparable."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.source_feature_geometry import feature_dimensions

from .source_feature_answers import remake
from .source_feature_fixtures import case


class FeatureGeometry(unittest.TestCase):
    def test_complete_quote_body_margin_attribution_and_two_column_reference(self):
        with tempfile.TemporaryDirectory() as d:
            _, page, segments, _, tasks = case(Path(d), two_columns=True)
            quote = next(s for s in segments if s.id == "quoted")
            task = next(t for t in tasks if any(q.node_id == quote.id for q in t.source_features))
            request = next(q for q in task.source_features if q.node_id == quote.id)
            self.assertEqual(["body"], request.reference_ids)
            self.assertLess(request.column_box.x0, quote.box.x0)
            self.assertLess(request.column_box.x1, 290)
            crops = [c for c in task.crops if c.request_node_id == quote.id]
            self.assertEqual({quote.id, "body"}, {c.node_id for c in crops})
            target = next(c for c in crops if c.node_id == quote.id)
            self.assertLessEqual(target.source_box.y0, quote.box.y0)
            self.assertGreaterEqual(target.source_box.y1, quote.box.y1)
            self.assertEqual(
                feature_dimensions(target.source_box),
                (
                    target.image_box[2] - target.image_box[0],
                    target.image_box[3] - target.image_box[1],
                ),
            )
            self.assertEqual(page.observation.render_sha256, target.render_sha256)

    def test_changed_scale_clipped_lines_or_foreign_column_are_refused(self):
        with tempfile.TemporaryDirectory() as d:
            *_, tasks = case(Path(d), two_columns=True)
            task = tasks[0]
            raw = task.model_dump(mode="json")
            for change in ["scale", "clip", "column"]:
                import copy

                value = copy.deepcopy(raw)
                crop = value["crops"][0]
                if change == "scale":
                    crop["image_box"][2] -= 1
                if change == "clip":
                    crop["source_box"]["y1"] = crop["source_box"]["y0"] + 1
                if change == "column":
                    value["source_features"][0]["reference_ids"] = ["right-body"]
                with self.subTest(change=change), self.assertRaises(ValueError):
                    remake(task, **{k: v for k, v in value.items() if k != "task_id"})

    def test_selection_is_bounded_and_does_not_request_all_body_paragraphs(self):
        with tempfile.TemporaryDirectory() as d:
            _, _, segments, state, tasks = case(Path(d))
            requested = [q.node_id for t in tasks for q in t.source_features]
            self.assertNotIn("body", requested)
            self.assertIn("heading", requested)
            self.assertIn("short", requested)
            self.assertEqual(15, state.requested_source_features)
            self.assertLessEqual(len(tasks), 3)
            self.assertEqual(
                4,
                len(
                    next(
                        q for t in tasks for q in t.source_features if q.node_id == "short"
                    ).requested_features
                ),
            )
