"""A source-backed numbered heading maps the first physical glyph without skipping it."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.ocr_glyph_map import prove_glyph_map
from ava_pdf_epub.reconstruction_v2.ocr_glyph_target import ocr_glyph_target

from .numbered_heading_fixture import fixture


class NumberedHeadingTargetTests(unittest.TestCase):
    def test_full_original_title_alone_or_with_immediate_subtitle_maps_original_ordinal(self):
        with tempfile.TemporaryDirectory() as directory:
            for subtitle in (False, True):
                with self.subTest(subtitle=subtitle):
                    f = fixture(Path(directory), subtitle=subtitle)
                    before = [owner.model_dump() for owner in f.owners]
                    self.assertIsNone(prove_glyph_map(f.page, f.owners[0], f.owners, POLICY))
                    self.assertEqual(("chapter", 0), f.resolve())
                    self.assertEqual(before, [owner.model_dump() for owner in f.owners])

    def test_direct_generic_proof_without_original_source_context_stays_strict(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                ocr_glyph_target(f.page, f.page.lines[0], f.owners, -10, -5, POLICY)

    def test_accepted_whitespace_and_styles_are_immutable(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            item = f.owners[0].model_copy(update={"text": "5  Rivers and roads\n\nat dusk –"})
            before = item.model_dump()
            self.assertEqual(("chapter", 0), f.resolve(owners=[item, *f.owners[1:]]))
            self.assertEqual(before, item.model_dump())

    def test_public_refusal_without_new_proof_and_legacy_branch_remain_exact(self):
        from ava_pdf_epub.reconstruction_v2.pdf_link_target import page_target

        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            with patch(
                "ava_pdf_epub.reconstruction_v2.ocr_glyph_target.numbered_heading_map",
                return_value=None,
            ):
                with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                    f.resolve()
            with patch(
                "ava_pdf_epub.reconstruction_v2.ocr_glyph_target.numbered_heading_map",
                side_effect=AssertionError("legacy must not invoke current proof"),
            ):
                self.assertEqual(("chapter", 0), page_target(f.target, f.owners, f.reader, f.page))
