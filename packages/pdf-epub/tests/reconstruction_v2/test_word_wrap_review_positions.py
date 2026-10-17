"""Independent review cases use the real marker and metadata entry points."""

import unittest

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.reconstruction_v2.printed_markers import printed_markers
from ava_pdf_epub.reconstruction_v2.printed_metadata import printed_metadata
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan
from ava_pdf_epub.reconstruction_v2.word_wrap_apply import apply_word_wrap
from ava_pdf_epub.reconstruction_v2.word_wrap_projections import project_word_wrap_positions

from .layout_v3_fixtures import fixture_v3
from .word_wrap_assembly_fixture import assembly_case


class WordWrapReviewPositionTests(unittest.TestCase):
    def test_marker_cut_refuses_any_fully_collapsed_reference_span(self):
        assembly, _, _, _ = assembly_case([(1, "1. body")], role="note")
        original = assembly.segments[0]
        for destination in (
            {"url": "https://example.com"},
            {"note_label": "2"},
            {"target_text": "Another section"},
        ):
            with self.subTest(destination=destination):
                referenced = original.model_copy(
                    update={"spans": [ObservedSpan(start=0, end=2, **destination)]}
                )
                with self.assertRaisesRegex(ValueError, "referenced"):
                    printed_markers([referenced], type(assembly.state)(word_wrap_active=True))

    def test_actual_marker_cut_then_hyphen_projection_resolves_incoming_alias_chain(self):
        assembly, _, _, _ = assembly_case([(1, "1. possess-"), (1, "ing")], role="note")
        state, original = assembly.state, assembly.segments[0]
        state.aliases.update({"line-two": (original.id, 12), "goto": ("line-two", 0)})
        state.internal_targets = [("caller", 0, 1, "goto", 0)]
        retained = printed_markers([original], state)[0]
        self.assertEqual(retained.text, "possess- ing")
        self.assertEqual(state.internal_targets, [("caller", 0, 1, original.id, 9)])
        self.assertEqual(state.aliases["goto"], (original.id, 9))
        self.assertEqual(state.source_prefix_cuts[original.native_line_ids[0]].raw_prefix, "1. ")
        result = fixture_v3("1. possess-", "ing", role="note", prefixes=((0, "1. "),))
        normalized = retained.model_copy(update={"text": result.text})
        state.segments[original.id] = normalized
        state.normalization_maps[original.id] = result.normalization
        assembly.segments = [normalized]
        project_word_wrap_positions(assembly, {original.id: (result.removals, retained.text)})
        self.assertEqual(state.internal_targets, [("caller", 0, 1, original.id, 7)])
        self.assertEqual(state.aliases["goto"], (original.id, 7))
        self.assertEqual(normalized.text[7:], "ing")

    def test_actual_metadata_emission_keeps_joined_source_receipt_and_final_owner(self):
        assembly, owners, batch, responses = assembly_case([(1, "Opening. Publi-"), (1, "sher")])
        state, segment = assembly.state, assembly.segments[0]
        offset = len("Opening. ")
        original = segment.text[offset:]
        source_id = "joined-away-publisher"
        state.aliases[source_id] = (segment.id, offset)
        state.bibliographic_roles[source_id] = ("publisher", original)
        receipt = (0, len(original), len(original), text_digest(original), "b" * 64, "c" * 64)
        state.bibliographic_source_ranges[source_id] = receipt
        changes = apply_word_wrap(assembly, owners, batch, responses)
        project_word_wrap_positions(assembly, changes)
        current = assembly.segments[0].model_copy(update={"chapter_role": "frontmatter"})
        state.segments[current.id] = current
        evidence = [dict(page=1, region_id="printed-publisher")]
        state.blocks = [
            dict(id=current.id, kind="paragraph", content={"text": current.text}, evidence=evidence)
        ]
        claims = printed_metadata(state, None)
        self.assertEqual([(c["field"], c["value"]) for c in claims], [("publisher", "Publisher")])
        self.assertEqual(claims[0]["evidence"], evidence)
        self.assertEqual(state.bibliographic_roles[source_id], ("publisher", "Publi- sher"))
        self.assertEqual(state.bibliographic_source_ranges[source_id], receipt)
        self.assertEqual(state.bibliographic_claim_owners[source_id], current.id)


if __name__ == "__main__":
    unittest.main()
