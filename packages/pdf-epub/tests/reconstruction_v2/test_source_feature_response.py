"""Each finite feature needs its own exact disposition/evidence and preserves historic authority."""

import copy
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.refinement_response import accept_refinement
from ava_pdf_epub.reconstruction_v2.source_feature_task_contract import SourceFeatureResponse
from ava_pdf_epub.reconstruction_v2.source_refusal import SourceContentRefusal

from .source_feature_answers import decisions, remake
from .source_feature_fixtures import case


class FeatureAcceptance(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source, self.page, self.segments, self.state, self.tasks = case(Path(self.temp.name))
        self.task = next(
            t for t in self.tasks if any(q.node_id == "quoted" for q in t.source_features)
        )
        self.response = decisions(self.task)

    def test_sparse_family_does_not_require_fabricated_weight_size_or_other_values(self):
        raw = self.task.model_dump(mode="json")
        request = raw["source_features"][0]
        request["requested_features"], request["allowed_roles"] = ["family"], []
        raw["source_features"] = [request]
        raw["crops"] = [c for c in raw["crops"] if c["request_node_id"] == request["node_id"]]
        task = remake(self.task, **{k: v for k, v in raw.items() if k != "task_id"})
        response = decisions(task)
        accept_refinement(task, response)
        self.assertEqual(["family"], [f.feature for f in response.feature_decisions[0].features])

    def test_stale_missing_duplicate_foreign_and_replacement_fields_refuse(self):
        original = self.response.model_dump(mode="json")
        for change in [
            "stale",
            "missing",
            "duplicate",
            "foreign",
            "replacement",
            "role",
            "heading",
        ]:
            raw = copy.deepcopy(original)
            d = raw["feature_decisions"][0]
            if change == "stale":
                raw["observation_sha256"] = "a" * 64
            if change == "missing":
                d["features"].pop()
            if change == "duplicate":
                d["features"].append(d["features"][0])
            if change == "foreign":
                d["features"][0]["evidence_ids"] = ["other-column"]
            if change == "replacement":
                d["text"] = "invented replacement"
            if change == "role":
                d["features"][0]["value"] = "heading"
            if change == "heading":
                d["parent_id"] = "invented-chapter"
            with self.subTest(change=change), self.assertRaises(ValueError):
                accept_refinement(self.task, SourceFeatureResponse.model_validate(raw))

    def test_unknown_optional_family_is_retained_but_unknown_essential_role_is_source_linked(self):
        response = decisions(
            self.task,
            {
                ("quoted", "family"): dict(
                    disposition="unknown", value=None, reason="source_blurred"
                )
            },
        )
        accept_refinement(self.task, response)
        self.assertIsNone(
            next(
                f
                for d in response.feature_decisions
                if d.node_id == "quoted"
                for f in d.features
                if f.feature == "family"
            ).value
        )
        response = decisions(
            self.task,
            {
                ("quoted", "paragraph_role"): dict(
                    disposition="unknown", value=None, reason="source_context_insufficient"
                )
            },
        )
        with self.assertRaises(SourceContentRefusal) as caught:
            accept_refinement(self.task, response)
        finding = caught.exception.diagnostic.findings[0]
        self.assertEqual("quoted", finding.block_id)
        self.assertEqual(self.task.task_id, finding.task_id)
        self.assertEqual(self.task.source_sha256, caught.exception.diagnostic.source_sha256)
        self.assertEqual(self.segments[1].box, finding.box)
