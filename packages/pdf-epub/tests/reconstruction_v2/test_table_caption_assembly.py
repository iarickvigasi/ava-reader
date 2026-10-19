"""The complete assembler respects explicit caption authority before figure heuristics."""

import tempfile
import unittest
from pathlib import Path

from .table_caption_fixture import assembled, associations, observed


class TableCaptionAssembly(unittest.TestCase):
    def test_explicit_table_caption_is_not_first_attached_to_the_previous_figure(self):
        rows = [
            observed("figure", "figure", 20),
            observed("caption", "caption", 75, related_to="table"),
            observed("table", "table", 90),
        ]
        with tempfile.TemporaryDirectory() as directory:
            state = assembled(rows, Path(directory))
        self.assertEqual({"table": "caption"}, associations(state))
        self.assertIsNone(state.blocks[0]["caption_id"])
        self.assertEqual("", state.blocks[0]["alt"])
        self.assertEqual(1, len(state.assets))

    def test_an_unrelated_genuine_figure_caption_keeps_existing_ownership(self):
        rows = [
            observed("figure", "figure", 20),
            observed("caption", "caption", 75),
            observed("table", "table", 90),
        ]
        with tempfile.TemporaryDirectory() as directory:
            state = assembled(rows, Path(directory))
        self.assertEqual({"table": None}, associations(state))
        self.assertEqual("caption", state.blocks[0]["caption_id"])
        self.assertEqual("caption", state.blocks[0]["alt"])
        self.assertEqual(1, len(state.assets))
