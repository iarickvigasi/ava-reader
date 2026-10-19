"""Named, generated and bullet modes keep explicit boundaries and source parents."""

import unittest

from .named_list_fixture import assemble, item


class NamedListGroupingTests(unittest.TestCase):
    def test_modes_split_without_reordering_nested_parents_or_labels(self):
        parent = item("parent", "Q2", 2)
        child = item("child", "P1", 1).model_copy(update={"list_depth": 2})
        following = item("following", "Q1", 1)
        bullet = item("bullet", "Plain", 1).model_copy(
            update={"list_ordered": False, "list_start": None}
        )
        number = item("number", "3.", 3)
        last = item("last", "P5", 5)
        state = assemble([parent, child, following, bullet, number, last])
        self.assertEqual(
            [g["item_ids"] for g in state.lists],
            [
                ["parent", "following"],
                ["child"],
                ["bullet"],
                ["number"],
                ["last"],
            ],
        )
        self.assertEqual(state.lists[1]["parent_item_id"], "parent")
        self.assertEqual(
            [g["marker_style"] for g in state.lists], ["none", "none", None, "decimal", "none"]
        )
        self.assertEqual(state.segments["last"].text, last.text)
