"""Composition preserves fixed page text, original receipts and exact joined offsets."""

import unittest

from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.reconstruction_v2.layout_hyphen_composition import compose_layout_normalizations

from .layout_hyphen_composition_fixture import paired_map
from .layout_hyphen_fixtures import PDF_SHA


class LayoutHyphenCompositionTests(unittest.TestCase):
    def test_two_maps_keep_original_receipts_and_canonical_page_alias_positions(self):
        first_source, first = paired_map("possess-\r\ning", "first", prefix="😀 Lead\n")
        second_source, second = paired_map("desir-\nable tail", "second")
        before = (document_digest(first.normalization), document_digest(second.normalization))
        mapping = compose_layout_normalizations(
            first_source,
            first.text,
            first.normalization,
            second_source,
            second.text,
            second.normalization,
            separator=" ",
            source_sha256=PDF_SHA,
        )
        joined = first.text + " " + second.text
        self.assertEqual("😀 Lead possessing desirable tail", joined)
        mapping.validate_canonical(joined)
        self.assertEqual(len(first.text) + 1, mapping.source_boundary(len(first_source) + 1))
        self.assertEqual(
            first.normalization.derivations[0].source_disposition,
            mapping.derivations[0].source_disposition,
        )
        self.assertEqual(
            second.normalization.derivations[0].source_disposition,
            mapping.derivations[1].source_disposition,
        )
        self.assertEqual(len(first_source) + 1, mapping.derivations[1].source_offset)
        self.assertEqual(
            before, (document_digest(first.normalization), document_digest(second.normalization))
        )

    def test_none_side_uses_only_existing_exact_layout_map(self):
        source, first = paired_map("prom-\nised", "first")
        mapping = compose_layout_normalizations(
            source,
            first.text,
            first.normalization,
            "tail\nline",
            "tail line",
            None,
            separator=" ",
            source_sha256=PDF_SHA,
        )
        mapping.validate_canonical("promised tail line")
        self.assertEqual(1, len(mapping.candidates))

    def test_retained_compound_join_keeps_its_hyphen_with_zero_separator(self):
        source, first = paired_map("possess-\ning well-", "first")
        mapping = compose_layout_normalizations(
            source,
            first.text,
            first.normalization,
            "known",
            "known",
            None,
            separator="",
            source_sha256=PDF_SHA,
        )
        mapping.validate_canonical("possessing well-known")
        self.assertEqual(len(first.text), mapping.source_boundary(len(source) + 1))
        self.assertEqual(1, sum(s.kind == "layout_hyphen" for s in mapping.segments))
