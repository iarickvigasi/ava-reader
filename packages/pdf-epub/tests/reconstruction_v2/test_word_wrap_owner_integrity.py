"""Changed or ambiguous immutable line ownership refuses before catalogue dispatch."""

import unittest

from ava_pdf_epub.reconstruction_v2.word_wrap_owners import catalogue_owners

from .test_word_wrap_catalogue import prepare
from .word_wrap_fixture import authored_source


class WordWrapOwnerIntegrityTests(unittest.TestCase):
    def test_changed_native_witness_refuses(self):
        owners, pages, _, _, _ = authored_source([(1, "trans-"), (1, "formation")])
        pages[0] = pages[0].model_copy(
            update={
                "lines": [
                    pages[0].lines[0].model_copy(update={"text": "other-"}),
                    pages[0].lines[1],
                ]
            }
        )
        with self.assertRaises(ValueError):
            prepare(owners, pages)

    def test_overlapping_source_regions_refuse(self):
        _, pages, segment, source_pages, receipts = authored_source(
            [(1, "trans-"), (1, "formation")]
        )
        source_pages[0] = source_pages[0].model_copy(
            update={
                "regions": [
                    source_pages[0].regions[0],
                    source_pages[0].regions[0].model_copy(update={"id": "overlap"}),
                ]
            }
        )
        with self.assertRaises(ValueError):
            catalogue_owners([segment], pages, source_pages, receipts, "en")

    def test_duplicate_final_native_ownership_refuses(self):
        owners, pages, _, _, _ = authored_source([(1, "trans-"), (1, "formation")])
        with self.assertRaises(ValueError):
            prepare([owners[0], owners[0].model_copy(update={"id": "duplicate-owner"})], pages)

    def test_typed_marker_receipt_cannot_cut_an_unrelated_role(self):
        owners, pages, _, _, _ = authored_source(
            [(1, "1. trans-"), (1, "formation")],
            role="note",
            prefixes={0: "1. "},
        )
        owners[0] = owners[0].model_copy(update={"role": "paragraph"})
        with self.assertRaises(ValueError):
            prepare(owners, pages)
