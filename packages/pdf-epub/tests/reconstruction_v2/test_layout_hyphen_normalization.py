"""Explicit layouts become readable; literal compounds and historical bytes stay fixed."""

import unittest

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.contracts.layout_normalization import LayoutNormalizationMap
from ava_pdf_epub.contracts.normalization import NormalizationMap
from ava_pdf_epub.reconstruction_v2.layout_hyphen_normalization import normalize_layout_hyphens
from ava_pdf_epub.reconstruction_v2.normalization_map import line_wrap_map

from .layout_hyphen_fixtures import PDF_SHA, authored_hyphens


class LayoutHyphenNormalizationTests(unittest.TestCase):
    def test_authored_layouts_and_literal_compounds_share_one_source(self):
        source = "possess-\ning desir-\nable prom-\nised well-\nknown gym-lovers Lottery-Playing"
        candidates, decisions = authored_hyphens(
            source, [(0, "layout"), (1, "layout"), (2, "layout"), (3, "literal")]
        )
        result = normalize_layout_hyphens(source, PDF_SHA, candidates, decisions)
        self.assertEqual(
            "possessing desirable promised well-known gym-lovers Lottery-Playing", result.text
        )
        self.assertIsInstance(result.normalization, LayoutNormalizationMap)
        self.assertEqual(source, result.normalization.source_text)
        self.assertEqual(text_digest(source), result.normalization.source_sha256)
        result.normalization.validate_canonical(result.text)
        self.assertEqual(3, sum(s.kind == "layout_hyphen" for s in result.normalization.segments))

    def test_composes_existing_line_wrap_map_without_guessing_offsets(self):
        source = "A😀B é\npossess-\r\n  ing"
        literal = "A😀B é possess- ing"
        base = NormalizationMap.model_validate(line_wrap_map(source, literal))
        candidates, decisions = authored_hyphens(source, [(0, "layout")])
        result = normalize_layout_hyphens(
            source, PDF_SHA, candidates, decisions, text=literal, normalization=base
        )
        self.assertEqual("A😀B é possessing", result.text)
        self.assertEqual(base.source_sha256, result.normalization.source_sha256)
        result.normalization.validate_canonical(result.text)
        self.assertEqual(
            source.index("possess"), result.normalization.source_boundary(source.index("possess"))
        )
        with self.assertRaisesRegex(ValueError, "ambiguous"):
            result.normalization.source_boundary(source.index("-\r\n") + 2)

    def test_literal_compaction_is_idempotent_with_old_zero_width_wrap(self):
        source, literal = "well-\nknown", "well-known"
        base = NormalizationMap.model_validate(line_wrap_map(source, literal))
        candidates, decisions = authored_hyphens(source, [(0, "literal")])
        result = normalize_layout_hyphens(
            source, PDF_SHA, candidates, decisions, text=literal, normalization=base
        )
        self.assertEqual(literal, result.text)
        self.assertEqual([(5, 5)], result.removals)
        result.normalization.validate_canonical(literal)

    def test_native_and_raster_evidence_do_not_change_transcription_authority(self):
        for method in ("native", "ocr"):
            with self.subTest(method=method):
                source = "desir-\nable"
                candidates, decisions = authored_hyphens(source, [(0, "layout")], method=method)
                result = normalize_layout_hyphens(source, PDF_SHA, candidates, decisions)
                self.assertEqual(method, result.normalization.candidates[0].left.method)
                self.assertEqual("desirable", result.text)

    def test_combining_mark_at_word_edge_remains_exact_without_nfc(self):
        for disposition, expected in (("layout", "caféteria"), ("literal", "café-teria")):
            with self.subTest(disposition=disposition):
                source = "café-\nteria"
                candidates, decisions = authored_hyphens(source, [(0, disposition)])
                result = normalize_layout_hyphens(source, PDF_SHA, candidates, decisions)
                self.assertEqual(expected, result.text)
                self.assertIn("é", result.text)
                self.assertNotIn("é", result.text)

    def test_no_decisions_keep_historical_map_bytes_and_absence(self):
        source, literal = "literal\ntext", "literal text"
        base = NormalizationMap.model_validate(line_wrap_map(source, literal))
        before = base.model_dump_json()
        result = normalize_layout_hyphens(source, PDF_SHA, [], [], text=literal, normalization=base)
        self.assertEqual(before, result.normalization.model_dump_json())
        self.assertNotIn("schema_version", result.normalization.model_dump())
        self.assertIsNone(normalize_layout_hyphens(source, PDF_SHA, [], []).normalization)
