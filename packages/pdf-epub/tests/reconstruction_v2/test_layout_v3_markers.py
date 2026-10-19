"""Both page-owned note/list labels remain explicit structural provenance."""

import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.contracts.layout_normalization_v3 import LayoutNormalizationMapV3

from .layout_v3_fixtures import fixture_v3


class LayoutV3MarkerTests(unittest.TestCase):
    def test_note_continuation_preserves_both_printed_markers_and_full_pair(self):
        result = fixture_v3(
            "1. possess-",
            "1. ing the book",
            role="note",
            page=True,
            prefixes=((0, "1. "), (1, "1. ")),
        )
        self.assertEqual("possessing the book", result.text)
        mapping, authority = result.normalization, result.normalization.authorities[0]
        self.assertEqual("1. possess-\n1. ing the book", authority.pair_source)
        self.assertEqual("possess-\ning the book", mapping.source_text)
        self.assertEqual(
            (3, 3), (authority.retained_left_line_start, authority.retained_right_line_start)
        )
        self.assertEqual(2, len(mapping.source_cuts))
        self.assertEqual(["1", "1"], [c.receipt.label for c in mapping.source_cuts])

    def test_first_line_list_prefix_is_checked_before_affine_body_projection(self):
        result = fixture_v3("a) desir-", "able", role="list_item", prefixes=((0, "a) "),))
        self.assertEqual("desirable", result.text)
        self.assertEqual("a) ", result.normalization.source_cuts[0].receipt.raw_prefix)

    def test_cut_receipt_cannot_authorize_an_interior_word_or_different_original_line(self):
        result = fixture_v3("1. possess-", "ing", role="note", prefixes=((0, "1. "),))
        for field, value in (("source_start", 1), ("source_end", 4)):
            raw = result.normalization.model_dump()
            raw["source_cuts"][0][field] = value
            with self.subTest(field=field), self.assertRaises(ValidationError):
                LayoutNormalizationMapV3.model_validate(raw)
        raw = result.normalization.model_dump()
        raw["source_cuts"][0]["receipt"]["original_line_sha256"] = text_digest("foreign")
        with self.assertRaises(ValidationError):
            LayoutNormalizationMapV3.model_validate(raw)

    def test_conflicting_repeated_note_labels_do_not_join_as_one_source_note(self):
        with self.assertRaisesRegex(ValidationError, "conflicting printed labels"):
            fixture_v3(
                "1. possess-", "2. ing", role="note", page=True, prefixes=((0, "1. "), (1, "2. "))
            )
