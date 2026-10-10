"""Do not reinterpret bibliographic citations as this book's anchors; preserve joined offsets."""

import unittest

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.internal_links import internal_links
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan, Segment
from ava_pdf_epub.reconstruction_v2.source_references import source_references


def node(ident, text, page=1, kind="paragraph"):
    return Segment(
        id=ident,
        text=text,
        page=page,
        kind=kind,
        method="native",
        heading_level=1 if kind == "heading" else None,
        box=dict(coordinate_space="page_points_top_left", x0=10, y0=10, x1=150, y1=30),
    )


class SourceReferenceTests(unittest.TestCase):
    def test_current_source_url_exclusion_requires_complete_reference_and_range_coverage(self):
        for text in ["See page 999.", "See pages 2-3, 5."]:
            value = node("url", text)
            value = value.model_copy(
                update={
                    "spans": [
                        ObservedSpan(start=4, end=len(text) - 1, url="https://example.invalid/book")
                    ]
                }
            )
            state = AssemblyState()
            source_references([value], {}, state, set())
            self.assertEqual([], state.internal_targets)
            value = value.model_copy(
                update={"spans": [value.spans[0].model_copy(update={"end": 8})]}
            )
            with self.assertRaisesRegex(ValueError, "Printed page"):
                source_references([value], {}, AssemblyState(), set())

    def test_default_source_url_lookup_and_unqualified_credit_are_not_relaxed(self):
        value = node("credit", "Qualification print page 1", kind="credit")
        with self.assertRaisesRegex(ValueError, "Printed page reference"):
            source_references([value], {}, AssemblyState(), set())
        value = node("url", "See page 999.")
        value = value.model_copy(
            update={"spans": [ObservedSpan(start=4, end=12, url="https://example.invalid/book")]}
        )
        with self.assertRaisesRegex(ValueError, "Printed page reference"):
            source_references([value], {}, AssemblyState())

    def test_positive_named_self_reference_and_unambiguous_see_page(self):
        for text in ["Return to Harbour on page 2.", "See page 2."]:
            state = AssemblyState()
            source_references(
                [node("head", "Harbour", 2, "heading"), node("ref", text, 3)], {"2": 2}, state
            )
            self.assertEqual("head", state.internal_targets[0][3])

    def test_bibliographic_page_abbreviations_stay_text_and_ambiguity_refuses(self):
        state = AssemblyState()
        source_references(
            [node("head", "Harbour", 2, "heading"), node("ref", "Smith, pp. 2-3.", 3)],
            {"2": 2},
            state,
        )
        self.assertEqual([], state.internal_targets)
        for text in ["A citation to another book, page 2.", "See page 2 in Another Volume."]:
            with self.assertRaisesRegex(ValueError, "Printed reference"):
                source_references(
                    [node("head", "Harbour", 2, "heading"), node("ref", text, 3)],
                    {"2": 2},
                    AssemblyState(),
                )

    def test_page_anchor_inside_joined_paragraph_retains_interior_offset(self):
        joined = node("joined", "First second part.")
        ref = node("ref", "See page 2.", 3)
        state = AssemblyState(
            segments={"joined": joined, "ref": ref},
            aliases={"page2start": ("joined", 6)},
            internal_targets=[("ref", 4, 10, "page2start", 0)],
        )
        state.blocks = [
            dict(id=s.id, kind=s.kind, content=dict(text=s.text, spans=[])) for s in [joined, ref]
        ]
        internal_links(state, {"joined": "ch1", "ref": "ch2"})
        link = state.blocks[1]["content"]["spans"][0]["link"]
        self.assertEqual(dict(kind="internal", chapter_id="ch1", block_id="joined", offset=6), link)


if __name__ == "__main__":
    unittest.main()
