"""Whole-book limits no longer get mistaken for a single request's node limit."""

import unittest

from ava_pdf_epub.reconstruction_v2.refinement_groups import refinement_groups
from ava_pdf_epub.reconstruction_v2.refinement_task_nodes import task_nodes

from .catalogue_batching_fixture import catalogue


class CatalogueBatchingTests(unittest.TestCase):
    def test_long_book_keeps_every_heading_and_covers_edges_once(self):
        observed = catalogue()
        before = [n.model_dump_json() for n in observed.nodes]
        self.assertEqual(297, len(observed.nodes))
        self.assertEqual(80, len(observed.decisions))
        self.assertEqual(80, len(observed.edges))
        groups = refinement_groups(observed)
        self.assertEqual(10, len(groups))
        heading_ids = [n.id for n in observed.nodes if n.kind == "heading"]
        decisions, edges = [], []
        for wanted, crops, boundary in groups:
            nodes = task_nodes(observed, wanted, crops, boundary, projected=True)
            self.assertLessEqual(len(nodes), 256)
            self.assertEqual(heading_ids, [n.id for n in nodes if n.kind == "heading"])
            self.assertTrue(set(wanted + crops) <= {n.id for n in nodes})
            decisions.extend(wanted)
            edges.extend(e.id for e in boundary)
        self.assertEqual(observed.decisions, decisions)
        self.assertEqual({e.id for e in observed.edges}, set(edges))
        self.assertEqual(len(edges), len(set(edges)))
        self.assertEqual(before, [n.model_dump_json() for n in observed.nodes])
        self.assertEqual(1530, sum(len(task_nodes(observed, *g, projected=True)) for g in groups))

    def test_historical_book_bound_remains_unchanged(self):
        with self.assertRaisesRegex(ValueError, "catalogue exceeds supported bound"):
            catalogue(current=False)
