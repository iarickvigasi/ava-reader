"""Source adjacency alone cannot overwrite a closer observed table-caption relation."""

import copy
import unittest

from ava_pdf_epub.reconstruction_v2.associate_table_captions import associate_table_captions

from .table_caption_fixture import associations, observed, workspace


class TableCaptionGeometry(unittest.TestCase):
    def test_three_above_table_captions_have_one_correct_owner_and_immutable_content(self):
        rows = []
        for i, top in enumerate([30, 120, 210]):
            rows.extend(
                [observed(f"caption{i}", "caption", top - 15), observed(f"table{i}", "table", top)]
            )
        state = workspace(rows)
        before = copy.deepcopy(state)
        associate_table_captions(state)
        self.assertEqual({f"table{i}": f"caption{i}" for i in range(3)}, associations(state))
        for node in state.blocks:
            if node["kind"] == "table":
                node["caption_id"] = None
        self.assertEqual(before, state)

    def test_single_below_caption_and_standalone_caption_are_retained(self):
        state = workspace([observed("table", "table", 20), observed("caption", "caption", 45)])
        associate_table_captions(state)
        self.assertEqual({"table": "caption"}, associations(state))
        state = workspace([observed("caption", "caption", 20)])
        before = copy.deepcopy(state)
        associate_table_captions(state)
        self.assertEqual(before, state)

    def test_closest_of_two_observed_tables_can_be_above_or_below(self):
        for top, expected in [(45, "first"), (75, "second")]:
            state = workspace(
                [
                    observed("first", "table", 20),
                    observed("caption", "caption", top),
                    observed("second", "table", 90),
                ]
            )
            associate_table_captions(state)
            self.assertEqual("caption", associations(state)[expected])
            self.assertEqual(1, sum(v is not None for v in associations(state).values()))

    def test_equal_gaps_overlap_changed_column_and_cross_page_are_refused(self):
        cases = [
            [
                observed("first", "table", 20),
                observed("caption", "caption", 50),
                observed("second", "table", 70),
            ],
            [observed("table", "table", 20), observed("caption", "caption", 25)],
            [observed("table", "table", 20), observed("caption", "caption", 45, x=70)],
            [observed("table", "table", 20), observed("caption", "caption", 45, page=2)],
        ]
        for rows in cases:
            state = workspace(rows)
            before = copy.deepcopy(state)
            with (
                self.subTest(rows=[s.id for s in rows]),
                self.assertRaisesRegex(ValueError, "source-adjacent"),
            ):
                associate_table_captions(state)
            self.assertEqual(before, state)
