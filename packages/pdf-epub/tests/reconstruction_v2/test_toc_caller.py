"""Public caller preserves exact text and skips OCR only when original TOC authorities agree."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.ocr_glyph_map import prove_glyph_map
from ava_pdf_epub.reconstruction_v2.pdf_link_page import LinkPage
from ava_pdf_epub.reconstruction_v2.pdf_ocr_caller import ocr_pdf_caller

from .test_pdf_links import box
from .toc_caller_fixture import fixture


class TocCallerTests(unittest.TestCase):
    def test_wrapped_ordinal_roman_direct_and_folio_callers_preserve_owners(self):
        with tempfile.TemporaryDirectory() as directory:
            for roman in (False, True):
                with self.subTest(roman=roman):
                    f = fixture(Path(directory), roman=roman)
                    before = [o.model_dump() for o in f.owners]
                    self.assertIsNone(prove_glyph_map(f.page, f.owners[0], f.owners, POLICY))
                    self.assertEqual([("wrapped", 0, len(f.owners[0].text))], f.prove())
                    self.assertEqual(
                        [("wrapped", len(f.owners[0].text) - 1, len(f.owners[0].text))],
                        f.prove(caller=box(104, 32, 108, 42)),
                    )
                    annotation = f.reader.pages[0]["/Annots"][1].get_object()
                    from ava_pdf_epub.pdf_navigation import pdf_navigation

                    self.assertEqual(
                        [("next", 0, 6)],
                        f.prove(
                            caller=box(4, 52, 108, 62),
                            annotation=annotation,
                            target=pdf_navigation(f.reader, annotation),
                        ),
                    )
                    self.assertEqual(before, [o.model_dump() for o in f.owners])

    def test_stock_current_caller_uses_proof_and_old_refusal_remains_reproducible(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            state = AssemblyState(source_continuation_policy=POLICY)
            with patch(
                "ava_pdf_epub.reconstruction_v2.pdf_ocr_caller.recognize_annotation_words"
            ) as ocr:
                result = ocr_pdf_caller(
                    f.reader,
                    f.target,
                    f.annotation,
                    f.caller,
                    LinkPage(f.checkpoint, f.owners),
                    state,
                    None,
                    f.source,
                )
                ocr.assert_not_called()
            self.assertEqual([("wrapped", 0, len(f.owners[0].text))], result)
            self.assertEqual(1, len(state.structure_findings))
            with patch(
                "ava_pdf_epub.reconstruction_v2.ocr_toc_caller.ocr_toc_caller", return_value=None
            ):
                with self.assertRaisesRegex(ValueError, "PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW"):
                    ocr_pdf_caller(
                        f.reader,
                        f.target,
                        f.annotation,
                        f.caller,
                        LinkPage(f.checkpoint, f.owners),
                        AssemblyState(source_continuation_policy=POLICY),
                        None,
                        f.source,
                    )

    def test_accepted_whitespace_is_never_replaced_by_source_spacing(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            for text in ("1 Alpha – beta  continued\n1", "1 Alpha – beta\n\ncontinued   1"):
                owner = f.owners[0].model_copy(update={"text": text})
                self.assertEqual(
                    [("wrapped", 0, len(text))], f.prove(owners=[owner, *f.owners[1:]])
                )
                self.assertEqual(text, owner.text)
            self.assertIsNone(f.prove(policy=None))
