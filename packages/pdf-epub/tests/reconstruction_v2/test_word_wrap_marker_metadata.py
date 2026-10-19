"""Incoming destinations and joined-away metadata must retain source-bound coordinates."""

import unittest

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.reconstruction_v2.marker_cut_positions import marker_cut_positions
from ava_pdf_epub.reconstruction_v2.printed_bibliographic_claims import printed_bibliographic_claims
from ava_pdf_epub.reconstruction_v2.word_wrap_apply import apply_word_wrap
from ava_pdf_epub.reconstruction_v2.word_wrap_projections import project_word_wrap_positions

from .word_wrap_assembly_fixture import assembly_case


class WordWrapMarkerMetadataTests(unittest.TestCase):
    def test_incoming_destination_and_alias_shift_before_lexical_projection(self):
        assembly, owners, batch, responses = assembly_case(
            [(1, "1. possess-"), (1, "ing details.")],
            role="note",
            prefixes={0: "1. "},
        )
        state, segment = assembly.state, assembly.segments[0]
        state.internal_targets = [("outside", 0, 1, segment.id, 12)]
        state.aliases["note-target"] = (segment.id, 12)
        marker_cut_positions(segment.id, 3, len(segment.text) + 3, state)
        self.assertEqual(state.internal_targets[0][-1], 9)
        self.assertEqual(state.aliases["note-target"][1], 9)
        changes = apply_word_wrap(assembly, owners, batch, responses)
        project_word_wrap_positions(assembly, changes)
        self.assertEqual(state.internal_targets[0][-1], 7)
        self.assertEqual(state.aliases["note-target"][1], 7)
        self.assertEqual(assembly.segments[0].text, "possessing details.")

    def test_structural_marker_target_opens_body_and_collapsed_caller_refuses(self):
        assembly, _, _, _ = assembly_case([(1, "body")])
        state = assembly.state
        state.internal_targets = [("outside", 0, 1, "note", 1)]
        marker_cut_positions("note", 3, 10, state)
        self.assertEqual(state.internal_targets[0][-1], 0)
        state.internal_targets = [("note", 0, 2, "outside", 0)]
        with self.assertRaisesRegex(ValueError, "referenced"):
            marker_cut_positions("note", 3, 10, state)

    def test_metadata_receipt_on_joined_away_node_becomes_final_owner_claim(self):
        assembly, owners, batch, responses = assembly_case(
            [(1, "Opening. Author: Johan Huiz-"), (1, "inga")],
            role="paragraph",
        )
        state, segment = assembly.state, assembly.segments[0]
        offset = len("Opening. ")
        original = segment.text[offset:]
        state.aliases["original-author-node"] = (segment.id, offset)
        state.bibliographic_roles["original-author-node"] = ("author", original[8:])
        state.bibliographic_source_ranges["original-author-node"] = (
            8,
            len(original),
            len(original),
            text_digest(original),
            "b" * 64,
            "c" * 64,
        )
        changes = apply_word_wrap(assembly, owners, batch, responses)
        project_word_wrap_positions(assembly, changes)
        state.blocks = [dict(id=segment.id, evidence=[dict(page=1, region_id="source")])]
        claims = printed_bibliographic_claims(state, {segment.id})
        self.assertEqual(len(claims), 1)
        self.assertEqual(claims[0]["value"], "Johan Huizinga")
        self.assertEqual(claims[0]["contributor_role"], "author")
        self.assertEqual(state.bibliographic_roles["original-author-node"][1], "Johan Huiz- inga")
