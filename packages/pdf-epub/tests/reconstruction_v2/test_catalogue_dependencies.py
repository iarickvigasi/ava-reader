"""Local comparison context closes evidence dependencies and retains baseline guards."""

import unittest

from ava_pdf_epub.reconstruction_v2.refinement_catalogue import RefinementCatalogue
from ava_pdf_epub.reconstruction_v2.refinement_task_nodes import task_nodes

from .catalogue_batching_fixture import node


def padded(values):
    return RefinementCatalogue([*values, *(node(f"extra{i}") for i in range(260))], [], [])


class CatalogueDependencyTests(unittest.TestCase):
    def test_remote_heading_keeps_baseline_link_when_that_body_is_decided(self):
        values = [
            node("head", heading=True, reference="body"),
            node("body"),
            node("far", heading=True, reference="absent-body"),
            node("absent-body"),
        ]
        original = padded(values)
        nodes = task_nodes(original, ["body"], ["body"], [], projected=True)
        self.assertEqual(["head", "body", "far"], [n.id for n in nodes])
        self.assertEqual("body", nodes[0].body_reference_id)
        self.assertIsNone(nodes[2].body_reference_id)
        self.assertEqual("absent-body", original.nodes[2].body_reference_id)

    def test_required_crops_and_decisions_close_body_references(self):
        original = padded([node("head", heading=True, reference="body"), node("body")])
        nodes = task_nodes(original, ["head"], ["head"], [], projected=True)
        self.assertEqual(["head", "body"], [n.id for n in nodes])
        self.assertEqual("body", nodes[0].body_reference_id)
        with self.assertRaisesRegex(ValueError, "missing source node"):
            task_nodes(
                padded([node("head", heading=True, reference="missing")]),
                ["head"],
                ["head"],
                [],
                projected=True,
            )

    def test_oversized_parent_context_refuses_instead_of_dropping_headings(self):
        original = RefinementCatalogue([node(f"h{i}", heading=True) for i in range(257)], [], [])
        with self.assertRaisesRegex(ValueError, "request bound"):
            task_nodes(original, ["h256"], ["h256"], [], projected=True)

    def test_small_and_historical_views_remain_byte_identical(self):
        original = RefinementCatalogue(
            [node("head", heading=True, reference="body"), node("body")], [], []
        )
        self.assertIs(original.nodes, task_nodes(original, ["head"], ["head"], [], projected=True))
        large = padded(original.nodes)
        self.assertIs(large.nodes, task_nodes(large, ["head"], ["head"], [], projected=False))
