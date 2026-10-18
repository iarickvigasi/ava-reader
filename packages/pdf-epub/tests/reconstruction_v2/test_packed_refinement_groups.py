"""Readable contact-sheet packing covers decisions/edges with the unchanged book budget."""

import unittest

from ava_pdf_epub.reconstruction_v2.packed_refinement_groups import packed_refinement_groups
from ava_pdf_epub.reconstruction_v2.refinement_catalogue import RefinementCatalogue
from ava_pdf_epub.reconstruction_v2.refinement_groups import refinement_groups

from .catalogue_batching_fixture import catalogue, node


class PackedRefinementGroupsTests(unittest.TestCase):
    def test_largest_prefix_avoids_binary_split_waste(self):
        nodes = [node(f"p{i}") for i in range(8)]
        values = RefinementCatalogue(nodes, [n.id for n in nodes], [])

        def fits(crops):
            return len(crops) <= 5

        old = refinement_groups(values, fits)
        packed = packed_refinement_groups(values, fits)
        self.assertEqual([4, 4], [len(g[0]) for g in old])
        self.assertEqual([5, 3], [len(g[0]) for g in packed])
        self.assertEqual(values.decisions, [i for g in packed for i in g[0]])

    def test_complete_context_and_boundary_coverage_are_preserved(self):
        values = catalogue()
        packed = packed_refinement_groups(values, lambda crops: len(crops) <= 10)
        self.assertEqual(16, len(packed))
        self.assertEqual(values.decisions, [i for g in packed for i in g[0]])
        self.assertEqual([e.id for e in values.edges], [e.id for g in packed for e in g[2]])
        for wanted, crops, edges in packed:
            self.assertTrue(set(wanted) <= set(crops))
            self.assertTrue({i for e in edges for i in (e.previous_id, e.next_id)} <= set(crops))
            self.assertLessEqual(len(crops), 10)
        self.assertEqual(
            refinement_groups(values), packed_refinement_groups(values, lambda _: True)
        )

    def test_unsplittable_context_and_more_than_32_groups_still_refuse(self):
        values = RefinementCatalogue([node("one")], ["one"], [])
        with self.assertRaisesRegex(ValueError, "readable source context"):
            packed_refinement_groups(values, lambda _: False)
        nodes = [node(f"p{i}") for i in range(33)]
        values = RefinementCatalogue(nodes, [n.id for n in nodes], [])
        with self.assertRaisesRegex(ValueError, "exceed supported bound"):
            packed_refinement_groups(values, lambda ids: len(ids) == 1)
