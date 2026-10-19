"""A context appearance may be a separately reviewed target in another source group."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.feature_group_nodes import feature_group_nodes
from ava_pdf_epub.reconstruction_v2.refinement_response import accept_refinement
from ava_pdf_epub.reconstruction_v2.source_feature_task_contract import SourceFeatureResponse

from .source_feature_answers import decisions, remake
from .source_feature_fixtures import case


class FeatureGroupNodeTests(unittest.TestCase):
    def test_remote_context_pointer_is_omitted_without_mutating_observations(self):
        with tempfile.TemporaryDirectory() as directory:
            _, _, _, _, tasks = case(Path(directory), include_quote=False)
            task = tasks[0]
            group = task.source_features
            context = group[0].reference_ids[0]
            nodes = {n.id: n for n in task.nodes}
            nodes[context] = nodes[context].model_copy(update={"body_reference_id": "far"})
            nodes["far"] = nodes[context].model_copy(
                update={"id": "far", "body_reference_id": None}
            )
            before = {k: n.model_dump() for k, n in nodes.items()}
            projected = feature_group_nodes(group, nodes, 256)
            self.assertIsNone(next(n for n in projected if n["id"] == context)["body_reference_id"])
            self.assertEqual(before, {k: n.model_dump() for k, n in nodes.items()})
            task = remake(task, nodes=projected)
            response = decisions(task)
            accept_refinement(task, response)
            invalid = response.model_dump(mode="json")
            invalid["feature_decisions"][0]["features"][0]["evidence_ids"].pop()
            with self.assertRaisesRegex(ValueError, "exact local source/reference crops"):
                accept_refinement(task, SourceFeatureResponse.model_validate(invalid))
            old = feature_group_nodes(group, nodes, 24)
            self.assertEqual("far", next(n for n in old if n["id"] == context)["body_reference_id"])

    def test_required_pointer_cannot_be_hidden_and_included_body_pointer_stays(self):
        with tempfile.TemporaryDirectory() as directory:
            _, _, _, _, tasks = case(Path(directory), include_quote=False)
            task = tasks[0]
            group = task.source_features
            nodes = {n.id: n for n in task.nodes}
            target, reference = group[0].node_id, group[0].reference_ids[0]
            nodes[target] = nodes[target].model_copy(update={"body_reference_id": reference})
            current = feature_group_nodes(group, nodes, 256)
            self.assertEqual(
                reference, next(n for n in current if n["id"] == target)["body_reference_id"]
            )
            nodes[target] = nodes[target].model_copy(update={"body_reference_id": "missing"})
            with self.assertRaisesRegex(ValueError, "Required feature body reference"):
                feature_group_nodes(group, nodes, 256)
