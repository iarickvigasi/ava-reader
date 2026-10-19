"""Exact target precedence and ambiguity remain unchanged."""

import unittest

from ava_pdf_epub.reconstruction_v2.bind_printed_targets import bind_printed_targets

from .chapter_reference_fixture import fixture
from .test_semantic_edges import segment


class ChapterReferenceExactTests(unittest.TestCase):
    def test_exact_target_precedes_number_route(self):
        items, state = fixture()
        result = bind_printed_targets([*items, segment("exact", "Chapter 1")], state)
        self.assertIsNone(result[1].spans[0].target_text)
        self.assertEqual(("exact", 0), state.internal_targets[-1][3:])

    def test_ambiguous_exact_targets_do_not_use_unique_number(self):
        items, state = fixture()
        with self.assertRaisesRegex(ValueError, "missing or ambiguous"):
            bind_printed_targets(
                [*items, segment("a", "Chapter 1"), segment("b", "Chapter 1")], state
            )

    def test_duplicate_owner_identity_cannot_grant_number_authority(self):
        items, state = fixture()
        with self.assertRaisesRegex(ValueError, "missing or ambiguous"):
            bind_printed_targets([*items, items[0]], state)
