"""Named-looking but ambiguous source evidence cannot fall back to generated numbering."""

import unittest

from .named_list_fixture import assemble, item


def span(start, end, mode, **values):
    return dict(start=start, end=end, style=dict(id="script", vertical_align=mode), **values)


class NamedListRefusalsTests(unittest.TestCase):
    def test_bad_source_metadata_or_vertical_evidence_refuses(self):
        cases = [
            item("one", "Q1¹", 1),
            item("one", "Q1₁", 1),
            item("one", "Q¹", 1),
            item("one", "Q11", 1),
            item("one", "Q1", 2),
            item("one", "Q11", 1, spans=[span(1, 2, "super")]),
            item("one", "Q11", 1, spans=[span(2, 3, "sub")]),
            item("one", "Q11", 1, spans=[span(2, 3, "super"), span(2, 3, "baseline")]),
            item("one", "Q111", 1, spans=[span(2, 3, "super")]),
            item("one", "Q11", 1, spans=[span(2, 3, "super", note_label="1")]),
            item("one", "Q11", 1, spans=[span(2, 3, "super", target_text="Elsewhere")]),
            item("one", "Q11", 1, spans=[span(2, 3, "super", url="https://example.com")]),
            item("one", "Q1", 1, style=dict(id="block", vertical_align="super")),
            item("one", "Q1", 1).model_copy(update={"list_ordered": False, "list_start": None}),
            item("one", "Q1", 1).model_copy(update={"list_start": None}),
            item("one", "Q1", 1).model_copy(update={"list_depth": None}),
            item("one", "Q1", 1).model_copy(update={"text": "Q1   "}),
        ]
        for index, segment in enumerate(cases):
            with self.subTest(index=index), self.assertRaisesRegex(ValueError, "Named list label"):
                assemble([segment])

    def test_no_role_inference_from_paragraph_code_or_verse(self):
        for kind in ["paragraph", "code", "verse"]:
            segment = item("one", "Q1", 1).model_copy(update={"kind": kind})
            state = assemble([segment])
            self.assertEqual(state.lists, [])
            self.assertEqual(state.segments["one"].model_dump(), segment.model_dump())

    def test_generated_numeric_alpha_roman_and_word_continuity_stays_strict(self):
        for first, second in [("1.", "3."), ("a.", "c."), ("IV)", "VI)"), ("First", "Third")]:
            a, b = (4, 6) if first == "IV)" else (1, 3)
            with (
                self.subTest(first=first),
                self.assertRaisesRegex(ValueError, "numbering discontinuity"),
            ):
                assemble([item("one", first, a), item("two", second, b)])
