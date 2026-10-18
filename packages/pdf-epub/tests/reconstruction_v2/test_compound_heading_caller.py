"""Original backlinks preserve whole compound-heading glyphs and accepted scalar offsets."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.ocr_glyph_map import prove_glyph_map

from .compound_heading_caller_fixture import fixture
from .test_pdf_links import box


class CompoundHeadingCallerTests(unittest.TestCase):
    def test_original_backlink_preserves_destination_and_every_input_without_local_ocr(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            self.addCleanup(f.heading.reader.close)
            before = (
                f.heading.source.read_bytes(),
                f.heading.page.model_dump(),
                [owner.model_dump() for owner in f.heading.owners],
                f.target,
            )
            owner = f.heading.owners[0]
            with patch(
                "ava_pdf_epub.reconstruction_v2.pdf_ocr_caller.recognize_annotation_words",
                side_effect=AssertionError("A complete source proof needs no local OCR"),
            ):
                self.assertEqual([(owner.id, 0, len(owner.text))], f.prove())
            self.assertEqual(2, f.target.page)
            self.assertEqual(1, f.heading.page.number)
            self.assertEqual(
                before,
                (
                    f.heading.source.read_bytes(),
                    f.heading.page.model_dump(),
                    [item.model_dump() for item in f.heading.owners],
                    f.target,
                ),
            )
            self.assertIsNone(prove_glyph_map(f.heading.page, owner, f.heading.owners, POLICY))
            self.assertEqual((owner.id, 0), f.heading.resolve())

    def test_each_ligature_selects_its_whole_scalar_expansion_and_partial_coverage_refuses(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            self.addCleanup(f.heading.reader.close)
            owner = f.heading.owners[0]
            for line in f.heading.page.lines:
                for glyph in line.glyphs:
                    if glyph.text not in {"ﬁ", "ﬂ"}:
                        continue
                    word = (
                        "fires"
                        if glyph.text == "ﬁ"
                        else "flights"
                        if line.id == "title"
                        else "flea"
                    )
                    start = owner.text.index(word)
                    with self.subTest(word=word):
                        self.assertEqual([(owner.id, start, start + 2)], f.prove(caller=glyph.box))
                        rect = glyph.box
                        with self.assertRaisesRegex(ValueError, "TEXT_MAPPING"):
                            f.prove(
                                caller=box(
                                    rect.x0 + (rect.x1 - rect.x0) * 0.2, rect.y0, rect.x1, rect.y1
                                )
                            )
