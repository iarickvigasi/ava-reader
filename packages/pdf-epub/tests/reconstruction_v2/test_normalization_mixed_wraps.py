"""A source join may retain one compound wrap and remove only another separator."""

import unittest

from ava_pdf_epub.contracts.normalization import NormalizationMap
from ava_pdf_epub.reconstruction_v2.normalization_map import line_wrap_map
from ava_pdf_epub.reconstruction_v2.stream_joins import stream_joins

from .test_native_continuation import observed_pair


class MixedWrapNormalizationTests(unittest.TestCase):
    def test_each_wrap_keeps_its_own_space_empty_or_literal_newline(self):
        for newline in ("\n", "\r\n", "\r"):
            source = newline.join(["A😀B café well-", "known and long-", "term end-", "point."])
            for text in (
                "A😀B café well- known and long-term end- point.",
                "A😀B café well-known and long- term end-point.",
                f"A😀B café well-{newline}known and long-term end- point.",
            ):
                with self.subTest(newline=newline, text=text):
                    mapping = NormalizationMap.model_validate(line_wrap_map(source, text))
                    mapping.validate_canonical(text)
                    self.assertEqual(source, mapping.source_text)
                    self.assertEqual(source.count("-"), text.count("-"))
                    for item in mapping.segments:
                        self.assertEqual(
                            item.canonical_start, mapping.source_boundary(item.source_start)
                        )
                        self.assertEqual(
                            item.canonical_end, mapping.source_boundary(item.source_end)
                        )
                    for source_at, character in enumerate(source):
                        if character == "-":
                            self.assertEqual("-", text[mapping.source_boundary(source_at)])

    def test_stock_native_join_retains_internal_wraps_and_exact_right_alias(self):
        left, right, state = observed_pair()
        left = left.model_copy(
            update={
                "text": "well- known and long-",
                "source_text": "well-\nknown and long-",
                "spans": [],
            }
        )
        right = right.model_copy(
            update={
                "text": "term end- point.",
                "source_text": "term end-\npoint.",
                "spans": [],
            }
        )
        (result,) = stream_joins([left, right], state)
        self.assertEqual("well- known and long-term end- point.", result.text)
        mapping = NormalizationMap.model_validate(line_wrap_map(result.source_text, result.text))
        mapping.validate_canonical(result.text)
        self.assertEqual((left.id, len(left.text)), state.aliases[right.id])
        self.assertEqual(len(left.text), mapping.source_boundary(len(left.source_text) + 1))
        self.assertEqual([*left.native_line_ids, *right.native_line_ids], result.native_line_ids)

    def test_mixed_wrap_support_never_changes_printed_hyphens_glyphs_or_other_gaps(self):
        source = "A😀B café well-\nknown and long-\nterm."
        for text in (
            "A😀B café well known and long-term.",
            "A😀B cafe well- known and long-term.",
            "A😀B café Well- known and long-term.",
            "A😀B café well- known and longterm.",
            "A😀B café well- known and long–term.",
        ):
            with self.subTest(text=text), self.assertRaisesRegex(ValueError, "Unaccounted"):
                line_wrap_map(source, text)
        with self.assertRaisesRegex(ValueError, "Unaccounted"):
            line_wrap_map("ordinary\nwords", "ordinarywords")
