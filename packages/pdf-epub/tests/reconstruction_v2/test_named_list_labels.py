"""Named identifiers preserve source order; they are not increasing counters."""

import unittest

from ava_pdf_epub.contracts.structure import ListGroup
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan

from .named_list_fixture import assemble, item


class NamedListLabelsTests(unittest.TestCase):
    def test_reverse_labels_with_superscript_keep_exact_observations(self):
        last = item(
            "last",
            "Q11",
            1,
            spans=[
                dict(
                    start=2,
                    end=3,
                    style=dict(id="raised", vertical_align="super"),
                ),
                dict(start=15, end=19, url="https://example.com/observed"),
            ],
        )
        segments = [item("first", "Q2", 2), last]
        before = [s.model_dump() for s in segments]
        state = assemble(segments)
        self.assertEqual([s.model_dump() for s in state.segments.values()], before)
        self.assertEqual(state.source_prefix_cuts, {})
        self.assertEqual(state.marker_styles, {})
        group = ListGroup.model_validate(state.lists[0])
        self.assertEqual((group.ordered, group.start, group.marker_style), (False, None, "none"))
        self.assertEqual(group.item_ids, ["first", "last"])
        self.assertEqual(state.blocks[0]["list_id"], group.id)

    def test_singleton_ascending_and_long_prefixes_are_literal_too(self):
        for labels in [[("Q1", 1)], [("QR1", 1), ("ABC2", 2)], [("Q02", 2), ("Q1", 1)]]:
            with self.subTest(labels=labels):
                state = assemble([item(str(i), label, n) for i, (label, n) in enumerate(labels)])
                self.assertEqual(len(state.lists), 1)
                self.assertEqual(state.lists[0]["marker_style"], "none")
                self.assertIsNone(state.lists[0]["start"])

    def test_other_occurrences_of_the_label_are_not_prefixes(self):
        segment = item(
            "one",
            "Q11",
            1,
            spans=[
                dict(
                    start=2,
                    end=3,
                    style=dict(id="raised", vertical_align="super"),
                )
            ],
        )
        segment = segment.model_copy(update={"text": segment.text + " Q11"})
        segment.spans.append(
            ObservedSpan(
                start=len(segment.text) - 1,
                end=len(segment.text),
                style=dict(id="other", vertical_align="super"),
            )
        )
        state = assemble([segment])
        self.assertEqual(state.segments["one"].model_dump(), segment.model_dump())

    def test_plain_label_covering_link_is_preserved(self):
        segment = item(
            "one",
            "Q1",
            1,
            spans=[
                dict(
                    start=0,
                    end=12,
                    url="https://example.com/observed",
                )
            ],
        )
        state = assemble([segment])
        self.assertEqual(state.segments["one"].model_dump(), segment.model_dump())
