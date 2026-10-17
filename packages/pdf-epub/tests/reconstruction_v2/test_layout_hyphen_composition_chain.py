"""Repeated joins compose source positions without replaying any reading decision."""

import unittest

from ava_pdf_epub.reconstruction_v2.layout_hyphen_composition import compose_layout_normalizations

from .layout_hyphen_composition_fixture import paired_map
from .layout_hyphen_fixtures import PDF_SHA


class LayoutHyphenCompositionChainTests(unittest.TestCase):
    def test_three_map_chain_rebases_raw_offsets_without_replaying_reading_decisions(self):
        left_source, left = paired_map("possess-\ning", "first")
        middle_source, middle = paired_map("desir-\nable", "second")
        right_source, right = paired_map("prom-\nised", "third")
        first = compose_layout_normalizations(
            left_source,
            left.text,
            left.normalization,
            middle_source,
            middle.text,
            middle.normalization,
            separator=" ",
            source_sha256=PDF_SHA,
        )
        joined_source = left_source + "\n" + middle_source
        joined_text = left.text + " " + middle.text
        result = compose_layout_normalizations(
            joined_source,
            joined_text,
            first,
            right_source,
            right.text,
            right.normalization,
            separator=" ",
            source_sha256=PDF_SHA,
        )
        result.validate_canonical("possessing desirable promised")
        self.assertEqual(len(joined_text) + 1, result.source_boundary(len(joined_source) + 1))
        self.assertEqual(3, len(result.derivations))
