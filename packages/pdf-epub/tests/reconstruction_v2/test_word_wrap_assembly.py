"""Canonical text and every dependent coordinate use the same declared deletion map."""

import unittest

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.reconstruction_v2.canonical_text import canonical_text
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan
from ava_pdf_epub.reconstruction_v2.source_page_starts import SourcePageStart
from ava_pdf_epub.reconstruction_v2.word_wrap_apply import apply_word_wrap
from ava_pdf_epub.reconstruction_v2.word_wrap_projections import (
    project_word_wrap_positions,
    verify_projected_page_start,
)

from .word_wrap_assembly_fixture import assembly_case


class WordWrapAssemblyTests(unittest.TestCase):
    def test_cross_page_fragments_styles_links_and_aliases_all_project(self):
        assembly, owners, batch, responses = assembly_case(
            [(1, "form-"), (2, "ation.")],
            spans=[ObservedSpan(start=6, end=11, url="https://example.org/details")],
        )
        state, segment = assembly.state, assembly.segments[0]
        state.internal_targets = [(segment.id, 6, 11, "right-page", 0)]
        state.aliases["right-page"] = (segment.id, 6)
        assembly.page_starts = {
            1: SourcePageStart(segment.id, "form-", owners[0].lines[0].region_id),
            2: SourcePageStart("right-page", "ation.", owners[0].lines[1].region_id),
        }
        changes = apply_word_wrap(assembly, owners, batch, responses)
        project_word_wrap_positions(assembly, changes)
        result = assembly.segments[0]
        self.assertEqual(result.text, "formation.")
        self.assertEqual((result.spans[0].start, result.spans[0].end), (4, 9))
        self.assertEqual(state.internal_targets, [(segment.id, 4, 9, segment.id, 4)])
        self.assertEqual(state.aliases["right-page"], (segment.id, 4))
        self.assertEqual(assembly.page_starts[1].text, "form")
        self.assertEqual(assembly.page_starts[2].text, "ation.")
        for page, offset in [(1, 0), (2, 4)]:
            start = assembly.page_starts[page]
            verify_projected_page_start(
                start, segment.id, offset, state.normalization_maps[segment.id]
            )
        value = canonical_text(result.text, result.spans, result.source_text, result.id, state)
        self.assertEqual(value["normalization"]["schema_version"], "ava-source-normalization-3")

    def test_metadata_projects_selected_text_but_checks_whole_original_owner(self):
        assembly, owners, batch, responses = assembly_case(
            [(1, "Author: Johan Huiz-"), (1, "inga")],
            role="credit",
        )
        state, segment = assembly.state, assembly.segments[0]
        original = segment.text
        state.bibliographic_roles[segment.id] = ("author", original[8:])
        state.bibliographic_source_ranges[segment.id] = (
            8,
            len(original),
            len(original),
            text_digest(original),
            "b" * 64,
            "c" * 64,
        )
        changes = apply_word_wrap(assembly, owners, batch, responses)
        project_word_wrap_positions(assembly, changes)
        self.assertEqual(state.bibliographic_projections[segment.id], "Johan Huizinga")
        self.assertEqual(state.bibliographic_roles[segment.id][1], "Johan Huiz- inga")
        state.bibliographic_source_ranges[segment.id] = (
            8,
            len(original),
            len(original),
            "d" * 64,
            "b" * 64,
            "c" * 64,
        )
        with self.assertRaisesRegex(ValueError, "whole original owner differs"):
            project_word_wrap_positions(assembly, changes)

    def test_literal_and_printed_marker_bodies_keep_correct_authority(self):
        assembly, owners, batch, responses = assembly_case(
            [(1, "1. father-"), (2, "1. in-law")],
            role="note",
            prefixes={0: "1. ", 1: "1. "},
            disposition="literal",
        )
        apply_word_wrap(assembly, owners, batch, responses)
        self.assertEqual(assembly.segments[0].text, "father-in-law")
        mapping = assembly.state.normalization_maps["final-owner"]
        self.assertEqual(mapping.original_source_text, "1. father-\n1. in-law")
        self.assertEqual(len(mapping.source_cuts), 2)

    def test_deleting_an_entire_referenced_caller_refuses(self):
        assembly, owners, batch, responses = assembly_case(
            [(1, "form-"), (1, "ation.")],
            spans=[ObservedSpan(start=4, end=5, url="https://example.org")],
        )
        with self.assertRaisesRegex(ValueError, "referenced"):
            apply_word_wrap(assembly, owners, batch, responses)
