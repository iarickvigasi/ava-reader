"""Explicit boundary decisions preserve typography and only clear the selected pending edge."""

import unittest

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.refinement_joins import refined_boundaries

from .test_refinement_grouping import segment


class RefinementBoundaryTest(unittest.TestCase):
    def test_separate_clears_only_the_decided_edge_and_preserves_original_observations(self):
        left = segment("left", "Before the page turns").model_copy(
            update={"continues_from_previous": True, "continues_to_next": True}
        )
        right = segment("right", "the prose continues.", page=2).model_copy(
            update={"continues_from_previous": False, "continues_to_next": True}
        )
        result = refined_boundaries([left, right], {("left", "right"): False})
        self.assertTrue(result[0].continues_from_previous)
        self.assertFalse(result[0].continues_to_next)
        self.assertFalse(result[1].continues_from_previous)
        self.assertTrue(result[1].continues_to_next)
        self.assertTrue(left.continues_to_next)
        self.assertEqual([left.text, right.text], [s.text for s in result])

    def test_join_refuses_nonrepresentable_base_style_loss(self):
        left = segment("left", "Across the gutter").model_copy(
            update={"style": Style(id="a", bold=False, relative_size=1)}
        )
        for style in (
            None,
            Style(id="b", bold=True, relative_size=1),
            Style(id="b", bold=False, relative_size=1.4),
        ):
            right = segment("right", "more text").model_copy(update={"style": style})
            with self.assertRaisesRegex(ValueError, "typography"):
                refined_boundaries([left, right], {("left", "right"): True})
        right = segment("right", "more text").model_copy(update={"style": left.style})
        self.assertEqual(
            [left, right], refined_boundaries([left, right], {("left", "right"): True})
        )
