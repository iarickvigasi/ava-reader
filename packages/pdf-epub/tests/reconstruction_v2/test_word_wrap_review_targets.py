"""Bind source destinations before their owner changes through joins or lexical deletion."""

import unittest

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.bind_printed_targets import bind_printed_targets
from ava_pdf_epub.reconstruction_v2.internal_links import internal_links
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan
from ava_pdf_epub.reconstruction_v2.stream_joins import stream_joins
from ava_pdf_epub.reconstruction_v2.word_wrap_assembly import WordWrapAssembly
from ava_pdf_epub.reconstruction_v2.word_wrap_projections import project_word_wrap_positions

from .layout_v3_fixtures import fixture_v3
from .test_semantic_edges import segment


def reference(text):
    return segment(
        "caller", "See that part.", spans=[ObservedSpan(start=4, end=13, target_text=text)]
    )


def canonical_link(state, values, target):
    state.segments.update({value.id: value for value in values})
    state.blocks = [dict(id=s.id, kind=s.kind, content=dict(text=s.text, spans=[])) for s in values]
    internal_links(state, {"caller": "chapter-one", target: "chapter-two"})
    return state.blocks[0]["content"]["spans"][0]["link"]


class WordWrapReviewTargetTests(unittest.TestCase):
    def test_heading_reference_survives_exact_source_target_normalization(self):
        result = fixture_v3("Desir-", "able", role="heading")
        original = result.normalization.input_text()
        target = segment("heading", original).model_copy(
            update={"kind": "heading", "heading_level": 2}
        )
        state = AssemblyState(word_wrap_active=True)
        bound = bind_printed_targets([reference(original), target], state)
        self.assertEqual(bound[0].spans[0].target_text, None)
        self.assertEqual(state.internal_targets[0][3:], ("heading", 0))
        bound[1] = target.model_copy(update={"text": result.text})
        state.normalization_maps[target.id] = result.normalization
        assembly = WordWrapAssembly([], bound, state, bound, {})
        project_word_wrap_positions(assembly, {target.id: (result.removals, original)})
        self.assertEqual(canonical_link(state, bound, target.id)["block_id"], target.id)
        self.assertEqual(bound[1].text, "Desirable")

    def test_reference_to_joined_away_right_node_keeps_midword_destination(self):
        left = segment("left", "possess-", continues_to_next=True).model_copy(update={"page": 2})
        right = segment("right", "ing", continues_from_previous=True).model_copy(update={"page": 3})
        state = AssemblyState(
            word_wrap_active=True,
            evidence={"caller": [{"page": 1}], "left": [{"page": 2}], "right": [{"page": 3}]},
        )
        bound = bind_printed_targets([reference("ing"), left, right], state)
        joined = stream_joins(bound, state)
        self.assertEqual(state.aliases["right"], ("left", 9))
        result = fixture_v3("possess-", "ing", page=True)
        joined[1] = joined[1].model_copy(update={"text": result.text})
        state.normalization_maps["left"] = result.normalization
        assembly = WordWrapAssembly([], joined, state, bound, {})
        project_word_wrap_positions(assembly, {"left": (result.removals, "possess- ing")})
        self.assertEqual(
            canonical_link(state, joined, "left"),
            dict(kind="internal", chapter_id="chapter-two", block_id="left", offset=7),
        )
        self.assertEqual(joined[1].text[7:], "ing")

    def test_duplicate_source_targets_refuse_before_any_canonical_lookup(self):
        with self.assertRaisesRegex(ValueError, "ambiguous in source"):
            bind_printed_targets(
                [reference("Same"), segment("a", "Same"), segment("b", "Same")],
                AssemblyState(word_wrap_active=True),
            )


if __name__ == "__main__":
    unittest.main()
