"""Routine paragraph endings are free; genuinely ambiguous edges batch across long books."""

import unittest

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.refinement_catalogue import refinement_catalogue
from ava_pdf_epub.reconstruction_v2.refinement_groups import refinement_groups

from .test_refinement_grouping import segment


class RefinementManyPagesTest(unittest.TestCase):
    def test_one_hundred_clear_page_breaks_produce_no_comparison_tasks(self):
        segments = [
            segment(f"p{i}", "A complete separate paragraph.", page=i + 1) for i in range(100)
        ]
        state = AssemblyState(placements={s.id: (s.page, 0, 0) for s in segments})
        catalogue = refinement_catalogue(segments, state)
        self.assertEqual([], catalogue.decisions)
        self.assertEqual([], catalogue.edges)
        self.assertEqual([], refinement_groups(catalogue))

    def test_forty_ambiguous_edges_are_covered_once_by_bounded_groups(self):
        segments = [
            segment(f"p{i}", "continuing prose over the page", page=i + 1) for i in range(41)
        ]
        state = AssemblyState(placements={s.id: (s.page, 0, 0) for s in segments})
        catalogue = refinement_catalogue(segments, state)
        self.assertEqual(40, len(catalogue.edges))
        groups = refinement_groups(catalogue)
        edges = [e.id for _, _, items in groups for e in items]
        self.assertEqual({e.id for e in catalogue.edges}, set(edges))
        self.assertEqual(len(edges), len(set(edges)))
        self.assertTrue(all(len(items) <= 16 and len(crops) <= 48 for _, crops, items in groups))
        self.assertEqual(41, sum(len(ids) for ids, _, _ in groups))
