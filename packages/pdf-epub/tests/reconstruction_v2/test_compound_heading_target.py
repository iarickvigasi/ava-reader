"""The complete original compound heading maps without changing text, geometry or caller proof."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.ocr_glyph_fragments import source_fragments
from ava_pdf_epub.reconstruction_v2.ocr_glyph_map import prove_glyph_map
from ava_pdf_epub.reconstruction_v2.ocr_glyph_target import ocr_glyph_target
from ava_pdf_epub.reconstruction_v2.ocr_literal_glyph_map import literal_fragment_map
from ava_pdf_epub.reconstruction_v2.source_numbered_heading_map import source_numbered_heading_map

from .compound_heading_fixture import fixture


class CompoundHeadingTargetTests(unittest.TestCase):
    def test_public_first_physical_ordinal_and_ligature_offsets_preserve_all_input(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            before = (
                f.source.read_bytes(),
                f.page.model_dump(),
                [o.model_dump() for o in f.owners],
            )
            self.assertEqual(("chapter", 0), f.resolve())
            self.assertEqual(
                ("chapter", 3),
                ocr_glyph_target(
                    f.page,
                    f.page.lines[1],
                    f.owners,
                    20,
                    10,
                    POLICY,
                    reader=f.reader,
                    source_target=f.target,
                ),
            )
            self.assertEqual(
                before,
                (f.source.read_bytes(), f.page.model_dump(), [o.model_dump() for o in f.owners]),
            )

    def test_source_literal_and_shared_caller_routes_remain_strict(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            owner = f.owners[0]
            fragments = source_fragments(f.page, owner)
            self.assertIsNotNone(fragments)
            self.assertIsNone(literal_fragment_map(f.page, owner, f.owners, fragments))
            self.assertIsNone(prove_glyph_map(f.page, owner, f.owners, POLICY))
            self.assertIsNone(
                source_numbered_heading_map(f.reader, f.page, owner, f.owners, POLICY)
            )
            with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                ocr_glyph_target(f.page, f.page.lines[0], f.owners, -10, -5, POLICY)

    def test_disabled_target_proof_retains_original_refusal(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            with patch(
                "ava_pdf_epub.reconstruction_v2.ocr_glyph_target.numbered_heading_map",
                return_value=None,
            ):
                with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                    f.resolve()

    def test_complete_literal_compound_title_also_has_exact_authority(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory), printed="Rivers and roads", accepted="Rivers and roads")
            item = f.page.lines[3]
            f.page.lines[3] = item.model_copy(
                update={
                    "text": item.text.replace("ﬂ", "x"),
                    "glyphs": [
                        g.model_copy(update={"text": "x"}) if g.text == "ﬂ" else g
                        for g in item.glyphs
                    ],
                }
            )
            f.owners[0] = f.owners[0].model_copy(
                update={"text": f.owners[0].text.replace("flea", "xea")}
            )
            from pypdf.generic import NameObject, TextStringObject

            f.reader.trailer["/Root"]["/Outlines"]["/First"][NameObject("/Title")] = (
                TextStringObject(f.owners[0].text.replace("–", "-"))
            )
            self.assertEqual(("chapter", 0), f.resolve())
