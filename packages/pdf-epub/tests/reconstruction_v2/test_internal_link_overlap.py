"""Source annotations and corroborated contents can describe the same exact caller."""

import copy
import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts.inline_text import TextValue

from .internal_link_fixture import assemble, source_state


class InternalLinkOverlapTests(unittest.TestCase):
    def test_overlapping_same_destination_becomes_one_exact_occurrence(self):
        for ranges in [
            [(0, 24), (0, 21)],
            [(0, 21), (0, 24)],
            [(0, 8), (6, 14), (12, 24)],
            [(6, 14), (0, 8), (12, 24)],
        ]:
            with self.subTest(ranges=ranges):
                state = source_state(ranges)
                before = copy.deepcopy(state.blocks[0]["content"])
                text = assemble(state)
                self.assertEqual([(s.start, s.end) for s in text.spans], [(0, 24)])
                self.assertEqual(text.text, before["text"])
                self.assertEqual(text.sha256, before["sha256"])
                self.assertEqual(text.codepoint_utf16, before["codepoint_utf16"])
                self.assertTrue(state.structure_findings)

    def test_separate_and_touching_callers_remain_separate(self):
        text = assemble(source_state([(0, 8), (8, 14), (16, 24)]))
        self.assertEqual([(s.start, s.end) for s in text.spans], [(0, 8), (8, 14), (16, 24)])

    def test_conflicting_target_or_offset_is_not_erased(self):
        for target, offset in [("other", 0), ("heading", 1)]:
            state = source_state([(0, 21)])
            state.internal_targets.append(("row", 0, 24, target, offset))
            with self.assertRaisesRegex(ValueError, "[Cc]onflicting|Overlapping"):
                assemble(state)

    def test_style_span_and_utf16_positions_stay_exact(self):
        state = source_state([(0, 24), (0, 21)])
        style = dict(id="emphasis", start=9, end=15, style_id="italic")
        state.blocks[0]["content"]["spans"].append(style.copy())
        text = assemble(state)
        self.assertEqual(text.spans[0].model_dump(exclude_none=True), style)
        self.assertEqual(text.codepoint_utf16[15], 16)

    def test_aliases_resolve_before_equivalence_is_decided(self):
        state = source_state([(0, 24)])
        state.aliases.update(old_row=("row", 3), old_heading=("heading", 2))
        state.internal_targets = [
            ("row", 0, 24, "heading", 2),
            ("old_row", 0, 18, "old_heading", 0),
        ]
        text = assemble(state)
        self.assertEqual(len(text.spans), 1)
        self.assertEqual(text.spans[0].link.offset, 2)

    def test_canonical_overlap_guard_is_not_relaxed(self):
        state = source_state([(0, 24)])
        raw = assemble(state).model_dump()
        raw["spans"].append({**raw["spans"][0], "id": "duplicate"})
        with self.assertRaisesRegex(ValidationError, "Overlapping"):
            TextValue.model_validate(raw)

    def test_invalid_source_range_cannot_disappear_inside_valid_union(self):
        for start, end in [(10, 10), (10, 5), (-1, 12), (0, 100), (False, 12), (0, 12.5)]:
            for ranges in [[(0, 24), (start, end)], [(start, end), (0, 24)]]:
                with self.subTest(ranges=ranges):
                    with self.assertRaisesRegex(ValueError, "range.*canonical text"):
                        assemble(source_state(ranges))
