"""OCR digit offsets follow the complete original source-label/comma proof."""

import unittest
from unittest.mock import patch

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, NumberObject

from ava_pdf_epub.pdf_navigation import NavigationTarget
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.ocr_page_label import ocr_page_label_range
from ava_pdf_epub.reconstruction_v2.pdf_links import apply_pdf_links

from .ocr_page_label_fixture import ocr_page_label_fixture
from .test_pdf_links import box


class OcrPageLabelTests(unittest.TestCase):
    def test_exact_source_label_keeps_comma_unlinked_and_stock_path_needs_no_local_ocr(self):
        root, source, checkpoint, owner, caller, reader, annotation = ocr_page_label_fixture(self)
        before = owner.model_dump()
        self.assertEqual(
            [("owner", 7, 9)],
            ocr_page_label_range(
                reader,
                NavigationTarget(page=1),
                checkpoint.observation,
                [owner],
                caller,
                annotation,
                POLICY,
            ),
        )
        state = AssemblyState(source_continuation_policy=POLICY)
        with patch(
            "ava_pdf_epub.reconstruction_v2.pdf_ocr_caller.recognize_annotation_words"
        ) as ocr:
            result = apply_pdf_links(source, [checkpoint], [owner], state, root)
            ocr.assert_not_called()
        self.assertEqual(before, result[0].model_dump())
        self.assertEqual([("owner", 7, 9, "owner", 0)], state.internal_targets)

    def test_policy_label_digit_comma_and_source_action_conflicts_refuse(
        self,
    ):
        _, source, checkpoint, owner, caller, reader, annotation = ocr_page_label_fixture(self)
        for policy, rect in (
            (None, caller),
            (POLICY, box(54, 20, 65, 34)),
            (POLICY, box(52, 20, 68, 34)),
        ):
            self.assertIsNone(
                ocr_page_label_range(
                    reader,
                    NavigationTarget(page=1),
                    checkpoint.observation,
                    [owner],
                    rect,
                    annotation,
                    policy,
                )
            )
        writer = PdfWriter(clone_from=source)
        writer._root_object["/PageLabels"]["/Nums"][1][NameObject("/St")] = NumberObject(55)
        path = source.with_name("wrong-label.pdf")
        writer.write(path)
        with PdfReader(path) as wrong:
            self.assertIsNone(
                ocr_page_label_range(
                    wrong,
                    NavigationTarget(page=1),
                    checkpoint.observation,
                    [owner],
                    caller,
                    wrong.pages[0]["/Annots"][0].get_object(),
                    POLICY,
                )
            )
        self.assertIsNone(
            ocr_page_label_range(
                reader,
                NavigationTarget(page=1, top=2),
                checkpoint.observation,
                [owner],
                caller,
                annotation,
                POLICY,
            )
        )
