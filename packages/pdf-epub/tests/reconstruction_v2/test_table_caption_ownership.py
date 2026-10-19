"""Reviewed explicit relations retain authority and cannot duplicate caption ownership."""

import copy
import unittest

from ava_pdf_epub.reconstruction_v2.associate_figures import associate_figures
from ava_pdf_epub.reconstruction_v2.associate_table_captions import associate_table_captions

from .table_caption_fixture import associations, observed, workspace


class TableCaptionOwnership(unittest.TestCase):
    def test_explicit_target_takes_precedence_over_the_closer_adjacency_candidate(self):
        state = workspace(
            [
                observed("first", "table", 20),
                observed("caption", "caption", 75, related_to="first"),
                observed("second", "table", 90),
            ]
        )
        associate_figures(state)
        associate_table_captions(state)
        self.assertEqual({"first": "caption", "second": None}, associations(state))

    def test_two_inferred_captions_for_one_table_refuse_before_assigning(self):
        state = workspace(
            [
                observed("above", "caption", 5),
                observed("table", "table", 20),
                observed("below", "caption", 45),
            ]
        )
        before = copy.deepcopy(state)
        with self.assertRaisesRegex(ValueError, "Conflicting source table captions"):
            associate_table_captions(state)
        self.assertEqual(before, state)

    def test_an_explicit_table_caption_cannot_be_overwritten_by_inference(self):
        state = workspace(
            [
                observed("above", "caption", 5, related_to="table"),
                observed("table", "table", 20),
                observed("below", "caption", 45),
            ]
        )
        associate_figures(state)
        with self.assertRaisesRegex(ValueError, "Conflicting source table captions"):
            associate_table_captions(state)
        self.assertEqual({"table": "above"}, associations(state))

    def test_existing_figure_caption_is_not_stolen_by_the_adjacent_table(self):
        state = workspace(
            [
                observed("figure", "figure", 20),
                observed("caption", "caption", 75, related_to="figure"),
                observed("table", "table", 90),
            ]
        )
        associate_figures(state)
        before = copy.deepcopy(state)
        associate_table_captions(state)
        self.assertEqual(before, state)
        self.assertEqual({"table": None}, associations(state))

    def test_missing_explicit_target_and_duplicate_existing_ownership_refuse(self):
        state = workspace([observed("caption", "caption", 20, related_to="missing")])
        with self.assertRaisesRegex(ValueError, "Missing caption or credit target"):
            associate_figures(state)
        state = workspace(
            [
                observed("first", "table", 20),
                observed("caption", "caption", 50),
                observed("second", "table", 70),
            ]
        )
        state.blocks[0]["caption_id"] = state.blocks[2]["caption_id"] = "caption"
        with self.assertRaisesRegex(ValueError, "multiple source owners"):
            associate_table_captions(state)
