"""Composition adds no authority for new deletions, foreign maps or missing origins."""

import unittest

from ava_pdf_epub.contracts.normalization import NormalizationMap
from ava_pdf_epub.reconstruction_v2.layout_hyphen_composition import compose_layout_normalizations
from ava_pdf_epub.reconstruction_v2.layout_hyphen_normalization import normalize_layout_hyphens
from ava_pdf_epub.reconstruction_v2.normalization_map import line_wrap_map

from .layout_hyphen_composition_fixture import paired_map
from .layout_hyphen_fixtures import PDF_SHA, authored_hyphens


class LayoutHyphenCompositionRefusalTests(unittest.TestCase):
    def test_historical_map_source_hash_is_revalidated_before_composition(self):
        source, first = paired_map("possess-\ning", "first")
        base = NormalizationMap.model_validate(line_wrap_map("tail", "tail"))
        stale = base.model_copy(update={"source_sha256": "b" * 64})
        with self.assertRaisesRegex(ValueError, "Source text digest mismatch"):
            compose_layout_normalizations(
                source,
                first.text,
                first.normalization,
                "tail",
                "tail",
                stale,
                separator=" ",
                source_sha256=PDF_SHA,
            )

    def test_foreign_pdf_changed_source_and_unproven_separator_refuse(self):
        source, first = paired_map("possess-\ning", "first")
        for raw, separator, pdf in (
            (source, " ", "b" * 64),
            (source + "!", " ", PDF_SHA),
            (source, "", PDF_SHA),
            (source, "x", PDF_SHA),
        ):
            with self.subTest(raw=raw, separator=separator, pdf=pdf), self.assertRaises(ValueError):
                compose_layout_normalizations(
                    raw,
                    first.text,
                    first.normalization,
                    "tail",
                    "tail",
                    None,
                    separator=separator,
                    source_sha256=pdf,
                )

    def test_direct_map_cannot_fabricate_original_pair_authority(self):
        source = "possess-\ning"
        candidates, decisions = authored_hyphens(source, [(0, "layout")])
        direct = normalize_layout_hyphens(source, PDF_SHA, candidates, decisions)
        with self.assertRaisesRegex(ValueError, "complete original pair"):
            compose_layout_normalizations(
                source,
                direct.text,
                direct.normalization,
                "tail",
                "tail",
                None,
                separator=" ",
                source_sha256=PDF_SHA,
            )

    def test_original_candidate_collision_is_not_silently_renamed(self):
        left_source, left = paired_map("possess-\ning", "same")
        right_source, right = paired_map("desir-\nable", "same")
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            compose_layout_normalizations(
                left_source,
                left.text,
                left.normalization,
                right_source,
                right.text,
                right.normalization,
                separator=" ",
                source_sha256=PDF_SHA,
            )
