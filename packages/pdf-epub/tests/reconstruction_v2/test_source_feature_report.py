"""Finite feature report evidence must remain paired to exact canonical OCR source geometry."""

import unittest

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.source_feature_report import source_feature_coverage
from tests.epub_v2.helpers import fixture


class FeatureReport(unittest.TestCase):
    def case(self):
        book, _, _ = fixture()
        raw = book.model_dump(mode="json")
        block = next(b for b in raw["blocks"] if b["id"] == "body-one")
        source = block["evidence"][0]
        source["method"] = "ocr"
        for page in raw["pages"]:
            if page["number"] == source["page"]:
                next(q for q in page["regions"] if q["id"] == source["region_id"])["route"] = "ocr"
        book = CanonicalBookV2.model_validate(raw)
        evidence = dict(
            node_id="original-node",
            canonical_block_id=block["id"],
            canonical_start=0,
            text_length=len(block["content"]["text"]),
            text_sha256=block["content"]["sha256"],
            page=source["page"],
            box=source["box"],
            feature="weight",
            disposition="observed",
            value=False,
            reason=None,
            task_id="task",
            task_sha256="a" * 64,
            response_sha256="b" * 64,
            observation_sha256="c" * 64,
            source_sha256=book.source.sha256,
            crop_ids=["target", "reference"],
            crop_sha256="d" * 64,
        )
        state = AssemblyState(
            source_feature_policy="ava-ocr-source-features-1",
            requested_source_features=1,
            source_feature_evidence=[evidence],
        )
        return book, state

    def test_exact_ocr_geometry_and_bounded_range_are_valid_without_claiming_visual_fidelity(self):
        book, state = self.case()
        ledger = source_feature_coverage(state, book)
        self.assertEqual((1, 0), (ledger["inspected_features"], ledger["uninspected_features"]))

    def test_foreign_page_box_method_or_truncated_range_cannot_reuse_equal_text(self):
        for change in ["page", "box", "method", "range"]:
            book, state = self.case()
            e = state.source_feature_evidence[0]
            if change == "page":
                e["page"] = 500
            if change == "box":
                e["box"] = {**e["box"], "x1": e["box"]["x1"] - 1}
            if change == "range":
                e["text_length"] += 1
            if change == "method":
                block = next(b for b in book.blocks if b.id == e["canonical_block_id"])
                changed = block.model_copy(
                    update={
                        "evidence": [
                            x.model_copy(update={"method": "native"}) for x in block.evidence
                        ]
                    }
                )
                book = book.model_copy(
                    update={"blocks": [changed if b.id == changed.id else b for b in book.blocks]}
                )
            with self.subTest(change=change), self.assertRaises(ValueError):
                source_feature_coverage(state, book)
