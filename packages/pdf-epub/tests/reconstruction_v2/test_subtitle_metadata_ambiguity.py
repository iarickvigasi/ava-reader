"""A complete matching prefix is insufficient when the selected subtitle run is larger."""

import copy
import unittest

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.reconstruction_v2.native_line_offsets import NativeLineOffset

from .subtitle_metadata_fixture import source_state, subtitles


def append_part(state, *, page=2, text="an extra selected line", gap=10):
    previous = state.segments[state.blocks[-2]["id"]]
    ident = f"extra-{len(state.blocks)}"
    box = previous.box.model_copy(
        update=dict(y0=previous.box.y1 + gap, y1=previous.box.y1 + gap + 20)
    )
    segment = previous.model_copy(
        update=dict(
            id=ident,
            page=page,
            text=text,
            box=box,
            native_line_ids=[ident + "-line"],
            style=state.segments[state.blocks[2]["id"]].style,
        )
    )
    state.segments[ident] = segment
    evidence = [dict(page=page, region_id=ident, method="native", box=box.model_dump())]
    state.blocks.insert(
        -1, dict(id=ident, kind="heading", content=dict(text=text), evidence=evidence)
    )
    state.bibliographic_roles[ident] = "subtitle", text
    state.bibliographic_source_ranges[ident] = (
        0,
        len(text),
        len(text),
        text_digest(text),
        "a" * 64,
        "b" * 64,
    )
    state.native_line_maps[ident + "-line"] = NativeLineOffset(
        line_id=ident + "-line",
        segment_id=ident,
        start=0,
        end=len(text),
        text_sha256=text_digest(text),
    )
    return ident


class SubtitleMetadataAmbiguityTests(unittest.TestCase):
    def test_complete_prefix_does_not_suppress_any_of_three_selected_parts(self):
        state = source_state()
        append_part(state)
        self.assertEqual(len(subtitles(state)), 4)

    def test_unqualified_neighbor_does_not_make_a_matched_prefix_complete(self):
        state = source_state()
        ident = append_part(state)
        state.bibliographic_source_ranges.pop(ident)
        self.assertEqual(len(subtitles(state)), 4)

    def test_same_witness_cannot_greedily_suppress_two_different_runs(self):
        state = source_state()
        divider = copy.deepcopy(state.blocks[1])
        divider["id"] = "divider"
        state.segments["divider"] = state.segments[state.blocks[1]["id"]].model_copy(
            update=dict(id="divider", page=3)
        )
        state.blocks.insert(-1, divider)
        append_part(state, page=3, text="A journey through")
        append_part(state, page=3, text="measured lines")
        result = subtitles(state)
        self.assertEqual(
            [c["value"] for c in result],
            ["A JOURNEY THROUGH MEASURED LINES", "A journey through", "measured lines"],
        )
        self.assertEqual([len(c["evidence"]) for c in result], [1, 2, 2])

    def test_reversed_source_parts_do_not_match_a_complete_witness(self):
        state = source_state()
        state.blocks[2], state.blocks[3] = state.blocks[3], state.blocks[2]
        self.assertEqual(len(subtitles(state)), 3)
