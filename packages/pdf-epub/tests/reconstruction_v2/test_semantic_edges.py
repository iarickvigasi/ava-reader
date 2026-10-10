"""Independently authored semantic boundaries without a model or fixture-name shortcut."""

import unittest

from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.reconstruction_v2.assemble_links import assemble_links
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.native_roles import native_roles
from ava_pdf_epub.reconstruction_v2.printed_markers import printed_markers
from ava_pdf_epub.reconstruction_v2.reading_order import reading_order
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan, Segment
from ava_pdf_epub.reconstruction_v2.stream_joins import stream_joins


def segment(ident, text, x=20, y=20, **extra):
    return Segment(
        id=ident,
        text=text,
        page=1,
        method="ocr",
        kind="paragraph",
        box=Box(coordinate_space="page_points_top_left", x0=x, y0=y, x1=x + 100, y1=y + 50),
        **extra,
    )


class SemanticEdges(unittest.TestCase):
    def test_unequal_paragraph_tops_still_read_whole_left_then_right(self):
        values = [
            segment("r1", "Right first", 220, 31),
            segment("l1", "Left first", 20, 20),
            segment("l2", "Left second", 20, 85),
            segment("r2", "Right second", 220, 90),
        ]
        self.assertEqual(
            ["l1", "l2", "r1", "r2"], [p.segment.id for p in reading_order(values, 400)]
        )

    def test_root_alpha_nested_and_roman_markers_keep_family_and_start(self):
        for values, styles, depths in [
            (["a. Apple", "b. Berry"], ["lower-alpha"] * 2, [1, 1]),
            (["A. Apple", "B. Berry"], ["upper-alpha"] * 2, [1, 1]),
            (["i. Apple", "ii. Berry"], ["lower-roman"] * 2, [1, 1]),
            (["I. Apple", "II. Berry"], ["upper-roman"] * 2, [1, 1]),
        ]:
            state = AssemblyState()
            items = native_roles(
                [segment(str(i), text, y=20 + i * 60) for i, text in enumerate(values)]
            )
            result = printed_markers(items, state)
            self.assertEqual(styles, list(state.marker_styles.values()))
            self.assertEqual(depths, [s.list_depth for s in result])
            self.assertEqual([1, 2], [s.list_start for s in result])
            self.assertEqual(["Apple", "Berry"], [s.text for s in result])

    def test_exact_internal_target_resolves_and_ambiguous_target_refuses(self):
        state = AssemblyState()
        source = segment(
            "a", "Read the section.", spans=[ObservedSpan(start=9, end=16, target_text="Section")]
        )
        target = segment("b", "Section")
        state.segments = {"a": source, "b": target}
        state.blocks = [
            dict(id=s.id, kind=s.kind, content=dict(text=s.text, spans=[]))
            for s in [source, target]
        ]
        chapters = [dict(id="one", block_ids=["a"]), dict(id="two", block_ids=["b"])]
        assemble_links(state, chapters)
        link = state.blocks[0]["content"]["spans"][0]["link"]
        self.assertEqual(dict(kind="internal", chapter_id="two", block_id="b", offset=0), link)
        state.segments["c"] = segment("c", "Section")
        state.blocks.append(dict(id="c", kind="paragraph", content=dict(text="Section", spans=[])))
        chapters[1]["block_ids"].append("c")
        with self.assertRaisesRegex(ValueError, "ambiguous"):
            assemble_links(state, chapters)

    def test_declared_crosspage_note_continuation_retains_both_evidence_regions(self):
        a = segment("a", "First part", continues_to_next=True).model_copy(
            update={"kind": "note", "note_label": "1"}
        )
        b = segment("b", "second part.", continues_from_previous=True).model_copy(
            update={"kind": "note", "note_label": "1", "page": 2}
        )
        state = AssemblyState(evidence={"a": [{"page": 1}], "b": [{"page": 2}]})
        joined = stream_joins([a, b], state)
        self.assertEqual("First part second part.", joined[0].text)
        self.assertEqual([{"page": 1}, {"page": 2}], state.evidence["a"])


if __name__ == "__main__":
    unittest.main()
