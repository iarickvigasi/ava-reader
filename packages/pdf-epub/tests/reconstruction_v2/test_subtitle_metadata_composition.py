"""Composition needs a whole independent witness and exact adjacent native source ownership."""

import copy
import unittest

from ava_pdf_epub.reconstruction_v2.segments import Segment

from .subtitle_metadata_fixture import source_state, subtitles


class SubtitleMetadataCompositionTests(unittest.TestCase):
    def test_whole_independent_witness_and_native_ranges_compose_with_all_evidence(self):
        state = source_state()
        before = copy.deepcopy(state)
        result = subtitles(state)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["value"], "A journey through measured lines")
        self.assertEqual([e["region_id"] for e in result[0]["evidence"]], ["r-0", "r-2", "r-3"])
        self.assertEqual(state, before)

    def test_missing_whole_witness_keeps_both_selected_parts(self):
        state = source_state()
        state.bibliographic_roles.pop(state.blocks[0]["id"])
        self.assertEqual(len(subtitles(state)), 2)

    def test_arbitrary_substring_or_nonwhole_native_selection_never_suppresses(self):
        state = source_state()
        ident = state.blocks[2]["id"]
        state.bibliographic_roles[ident] = "subtitle", "journey through"
        self.assertEqual(len(subtitles(state)), 3)

    def test_intervening_credit_or_nonadjacent_geometry_keeps_the_originals(self):
        for change in [
            "credit",
            "gap",
            "column",
            "page",
            "style",
            "mapping",
            "receipt",
            "alias",
            "ocr",
            "multiline",
        ]:
            with self.subTest(change=change):
                state = source_state()
                part = state.segments[state.blocks[3]["id"]]
                if change == "credit":
                    extra = Segment.model_validate(
                        dict(
                            id="credit",
                            page=2,
                            kind="credit",
                            method="native",
                            text="A. Writer",
                            box=part.box,
                        )
                    )
                    state.segments[extra.id] = extra
                    state.blocks.insert(
                        3,
                        dict(
                            id=extra.id,
                            kind="credit",
                            content=dict(text=extra.text),
                            evidence=state.blocks[2]["evidence"],
                        ),
                    )
                elif change == "gap":
                    state.segments[part.id] = part.model_copy(
                        update=dict(box=part.box.model_copy(update=dict(y0=400, y1=420)))
                    )
                elif change == "column":
                    state.segments[part.id] = part.model_copy(
                        update=dict(box=part.box.model_copy(update=dict(x0=250, x1=600)))
                    )
                elif change == "page":
                    state.segments[part.id] = part.model_copy(update=dict(page=3))
                elif change == "style":
                    state.segments[part.id] = part.model_copy(update=dict(style=None))
                elif change == "mapping":
                    state.native_line_maps.clear()
                elif change == "receipt":
                    state.bibliographic_source_ranges.clear()
                elif change == "alias":
                    state.aliases[part.id] = (part.id, 0)
                elif change == "ocr":
                    state.segments[part.id] = part.model_copy(update=dict(method="ocr"))
                else:
                    part.native_line_ids.append("second-native-line")
                self.assertEqual(len(subtitles(state)), 3)
