"""Page and title fragments retain raw receipts while clamping only proved deletions."""

import unittest

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.reconstruction_v2.layout_projection_v3 import (
    project_fragment,
    project_raw_fragment,
)

from .layout_v3_fixtures import fixture_v3


class LayoutV3FragmentTests(unittest.TestCase):
    def test_positive_crlf_transform_does_not_allow_fragment_boundary_clamping(self):
        result = fixture_v3(prefix="A\r\n")
        with self.assertRaisesRegex(ValueError, "ambiguous"):
            project_raw_fragment(
                result.normalization,
                result.text,
                2,
                3,
                expected_fragment="\n",
                expected_sha256=text_digest("\n"),
            )

    def test_left_page_fragment_ends_inside_deleted_hyphen_and_physical_break(self):
        result = fixture_v3(page=True)
        mapping = result.normalization
        projected = project_fragment(
            mapping.input_text(),
            0,
            8,
            result.removals,
            normalization=mapping,
            expected_fragment="possess-",
            expected_sha256=text_digest("possess-"),
        )
        self.assertEqual("possess", projected.text)
        self.assertEqual(text_digest("possess-"), projected.receipt.source_fragment_sha256)
        self.assertEqual(text_digest("possess"), projected.receipt.canonical_fragment_sha256)
        right = project_fragment(
            mapping.input_text(), 9, 12, result.removals, normalization=mapping
        )
        self.assertEqual("ing", right.text)
        self.assertEqual(7, right.receipt.canonical_start)
        with self.assertRaisesRegex(ValueError, "ambiguous"):
            mapping.source_boundary(8)
        raw = project_raw_fragment(
            mapping,
            result.text,
            0,
            8,
            expected_fragment="possess-",
            expected_sha256=text_digest("possess-"),
        )
        self.assertEqual("possess", raw.text)

    def test_printed_title_and_selected_author_value_keep_both_identities(self):
        result = fixture_v3("Sen-", "tence", role="heading")
        original = result.normalization.input_text()
        receipt_hash = text_digest(original)
        projected = project_fragment(
            original,
            0,
            len(original),
            result.removals,
            normalization=result.normalization,
            expected_fragment=original,
            expected_sha256=receipt_hash,
            referenced=True,
        )
        self.assertEqual("Sentence", projected.text)
        self.assertEqual(receipt_hash, projected.receipt.source_fragment_sha256)
        self.assertEqual(text_digest("Sentence"), projected.receipt.canonical_fragment_sha256)
        author = fixture_v3("Author: Anne-", "Marie", role="credit")
        text = author.normalization.input_text()
        value = project_fragment(
            text,
            8,
            len(text),
            author.removals,
            normalization=author.normalization,
            expected_fragment="Anne- Marie",
            expected_sha256=text_digest("Anne- Marie"),
            referenced=True,
        )
        self.assertEqual("AnneMarie", value.text)

    def test_collapsed_reference_stale_fragment_or_forged_deletion_range_refuses(self):
        result = fixture_v3()
        text = result.normalization.input_text()
        for kwargs in ({"referenced": True}, {"expected_sha256": text_digest("wrong")}):
            with self.assertRaises(ValueError):
                project_fragment(
                    text, 7, 9, result.removals, normalization=result.normalization, **kwargs
                )
        with self.assertRaisesRegex(ValueError, "deletion proof"):
            project_fragment(text, 0, 8, [(0, 3)], normalization=result.normalization)
