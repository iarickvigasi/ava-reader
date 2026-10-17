"""A joined OCR title keeps exact source evidence through final finite-coverage checks."""

import unittest

from ava_pdf_epub.reconstruction_v2.source_feature_report import source_feature_coverage

from .source_feature_compound_fixture import compound_case


class CompoundFeatureReport(unittest.TestCase):
    def test_inspected_compound_heading_keeps_all_original_boxes_and_exact_text(self):
        book, state = compound_case()
        ledger = source_feature_coverage(state, book)
        self.assertEqual((1, 0), (ledger["inspected_features"], ledger["uninspected_features"]))
        block = next(b for b in book.blocks if b.id == "heading-two")
        self.assertEqual("Appendix 3\nParadoxes 😀 purveyed", block.content.text)
        self.assertEqual(2, len(block.evidence))
        self.assertFalse(
            any(
                e.box.model_dump(mode="json") == ledger["evidence"][0]["box"]
                for e in block.evidence
            )
        )

    def test_uninspected_optional_compound_keeps_unknown_without_inventing_receipts(self):
        book, state = compound_case(inspected=False)
        ledger = source_feature_coverage(state, book)
        self.assertEqual((0, 1), (ledger["inspected_features"], ledger["uninspected_features"]))
        self.assertIsNone(ledger["evidence"][0]["task_id"])
        self.assertEqual([], ledger["evidence"][0]["crop_ids"])
