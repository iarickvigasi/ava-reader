"""Printed words stay selectable source text; list roles never arise from prose prefixes."""

import unittest

from ava_pdf_epub.contracts.layout_hyphen_v3 import LayoutHyphenCandidateV2
from ava_pdf_epub.reconstruction_v2.assemble_lists import assemble_lists
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.list_markers import MARKER
from ava_pdf_epub.reconstruction_v2.native_hyphen_decisions import retained_hyphen_decisions
from ava_pdf_epub.reconstruction_v2.native_structure_assembly import (
    assemble_native_structure_source,
)
from ava_pdf_epub.reconstruction_v2.native_structure_response import accept_native_structure
from ava_pdf_epub.reconstruction_v2.native_structure_source import prepare_native_structure
from ava_pdf_epub.reconstruction_v2.printed_markers import printed_markers
from ava_pdf_epub.reconstruction_v2.word_wrap_reuse import reusable_word_wrap_authority

from .native_structure_decision_fixture import SOURCE, line, page, region
from .native_structure_v2_fixture import response2
from .word_list_fixture import source_case


class WordListMarkersTests(unittest.TestCase):
    def test_literal_label_styles_and_positions_survive_without_prefix_cut(self):
        observation, task, answer, candidate = source_case()
        result = assemble_native_structure_source(task, answer, observation)
        state = AssemblyState(word_wrap_active=True)
        before = result.segments[0].model_dump()
        after = printed_markers(list(result.segments), state)
        self.assertEqual(after[0].model_dump(), before)
        self.assertEqual(after[0].text, "Fourth Authored trans- formation.")
        self.assertEqual(state.marker_styles, {after[0].id: "none"})
        self.assertEqual(state.source_prefix_cuts, {})
        old = retained_hyphen_decisions(task, answer, [candidate])[0].classification
        final = LayoutHyphenCandidateV2.model_validate(
            {
                **candidate.model_dump(),
                "schema_version": "ava-layout-hyphen-candidate-2",
                "role": "list_item",
            }
        )
        self.assertIsNone(reusable_word_wrap_authority(final, [old], has_cuts=False))
        self.assertEqual(old.original_candidate.role, "paragraph")

    def test_separate_marker_body_fragments_keep_exact_lines_and_words(self):
        lines = [line("label", "First", y=120), line("body", "Authored item.", x=100, y=120)]
        observation, image = page(lines)
        task = prepare_native_structure(
            observation,
            SOURCE,
            image,
            [region("body", lines)],
            structure_policy="ava-native-structure-2",
        )
        group = dict(
            id="item",
            region_id="body",
            kind="list_item",
            line_ids=[s.id for s in lines],
            list_role="ordered",
            list_start=1,
            list_depth=1,
        )
        answer = response2(task, [group])
        result = assemble_native_structure_source(task, answer, observation)
        state = AssemblyState(word_wrap_active=True)
        output = printed_markers(list(result.segments), state)
        self.assertEqual(output[0].source_text, "First\nAuthored item.")
        self.assertEqual(output[0].native_line_ids, ["label", "body"])
        self.assertEqual(output[0].text, "First Authored item.")
        self.assertEqual(state.source_prefix_cuts, {})
        for change in (dict(list_start=2), dict(list_role="unordered", list_start=None)):
            invalid = {**group, **change}
            if invalid["list_start"] is None:
                invalid.pop("list_start")
            with self.assertRaisesRegex(ValueError, "list number differs"):
                accept_native_structure(task, response2(task, [invalid]))

    def test_paragraphs_and_legacy_role_guards_are_unchanged(self):
        self.assertIsNone(MARKER.match("First we discuss ordinary prose."))
        for policy, kind, label in (
            ("ava-native-structure-1", "list_item", "Fourth"),
            ("ava-native-structure-1", "list_item", "1."),
            ("ava-native-structure-2", "code", "1."),
            ("ava-native-structure-2", "verse", "1."),
        ):
            with self.subTest(policy=policy, kind=kind, label=label):
                _, task, answer, _ = source_case(policy, kind, label)
                with self.assertRaises(ValueError):
                    accept_native_structure(task, answer)

    def test_changed_note_role_is_literal_until_fresh_word_wrap_proof(self):
        observation, task, answer, _ = source_case(kind="note", label="1.")
        result = assemble_native_structure_source(task, answer, observation)
        self.assertEqual(result.segments[0].text, "1. Authored trans- formation.")
        self.assertEqual(result.segments[0].kind, "note")

    def test_mixed_marker_modes_split_lists_without_hiding_numeric_labels(self):
        observation, task, answer, _ = source_case()
        item = assemble_native_structure_source(task, answer, observation).segments[0]
        number = item.model_copy(update={"id": "number", "list_start": 5})
        state = AssemblyState()
        state.blocks = [dict(id=s.id, kind="list_item") for s in [item, number]]
        state.segments = {s.id: s for s in [item, number]}
        state.marker_styles = {item.id: "none", number.id: "decimal"}
        assemble_lists(state, [dict(block_ids=[item.id, number.id])])
        self.assertEqual(
            [(g["marker_style"], g["start"]) for g in state.lists], [("none", 4), ("decimal", 5)]
        )
