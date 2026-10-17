"""Foreign ink and incomplete geometry cannot borrow an otherwise matching string."""

import unittest

from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.observations import Graphic, RequiredRegion
from ava_pdf_epub.reconstruction_v2.ocr_glyph_map import prove_glyph_map
from ava_pdf_epub.reconstruction_v2.ocr_glyph_ranges import ocr_glyph_ranges

from .ocr_glyph_fixture import columns
from .test_pdf_links import box


class OcrGlyphSafetyTests(unittest.TestCase):
    def test_every_kind_of_competing_owner_blocks_the_complete_proof(self):
        page, owners = columns()
        for kind, method, text in (
            ("paragraph", "native", "x"),
            ("figure", "ocr", ""),
            ("furniture", "ocr", ""),
            ("paragraph", "ocr", "no end 54,"),
        ):
            other = owners[0].model_copy(
                update={"id": "other", "kind": kind, "method": method, "text": text}
            )
            self.assertIsNone(prove_glyph_map(page, owners[0], [*owners, other], POLICY))

    def test_missing_hidden_artifact_cut_and_duplicate_glyphs_refuse(self):
        page, owners = columns()
        line = page.lines[0]
        cases = [
            line.model_copy(update={"glyphs": line.glyphs[1:]}),
            line.model_copy(
                update={
                    "glyphs": [
                        line.glyphs[0].model_copy(update={"visible": False}),
                        *line.glyphs[1:],
                    ]
                }
            ),
            line.model_copy(
                update={
                    "glyphs": [
                        line.glyphs[0].model_copy(update={"source_artifact": True}),
                        *line.glyphs[1:],
                    ]
                }
            ),
        ]
        for value in cases:
            self.assertIsNone(
                prove_glyph_map(
                    page.model_copy(update={"lines": [value]}), owners[0], owners, POLICY
                )
            )
        cut = owners[0].model_copy(update={"box": box(3.8, 20, 32, 30)})
        self.assertIsNone(prove_glyph_map(page, cut, [cut, owners[1]], POLICY))
        self.assertIsNone(
            prove_glyph_map(
                page.model_copy(update={"lines": [line, line]}), owners[0], owners, POLICY
            )
        )

    def test_graphics_required_regions_and_partial_callers_refuse(self):
        page, owners = columns()
        for change in (
            {"graphics": [Graphic(kind="image", box=owners[0].box)]},
            {"graphics": [Graphic(kind="vector", box=owners[0].box)]},
            {"required_regions": [RequiredRegion(kind="text", box=owners[0].box)]},
        ):
            self.assertIsNone(
                prove_glyph_map(page.model_copy(update=change), owners[0], owners, POLICY)
            )
        for caller in (box(21, 20, 28, 30), box(20, 22, 28, 30)):
            self.assertIsNone(ocr_glyph_ranges(page, owners, caller, POLICY))

    def test_an_owner_crossing_the_source_gutter_is_not_a_single_stream(self):
        page, owners = columns()
        both = owners[0].model_copy(update={"text": "noend54, noend54,", "box": box(0, 20, 97, 30)})
        self.assertIsNone(prove_glyph_map(page, both, [both], POLICY))

    def test_narrow_source_gutter_cannot_be_hidden_inside_one_ocr_row(self):
        page, owners = columns()
        native = page.lines[0]
        glyphs = [
            g.model_copy(
                update={"box": g.box.model_copy(update={"x0": g.box.x0 - 24, "x1": g.box.x1 - 24})}
            )
            if i >= 8
            else g
            for i, g in enumerate(native.glyphs)
        ]
        # Nine-point separation is narrower than the old two-font-size cutoff.
        page = page.model_copy(update={"lines": [native.model_copy(update={"glyphs": glyphs})]})
        both = owners[0].model_copy(update={"text": "noend54, noend54,", "box": box(0, 20, 73, 30)})
        self.assertIsNone(prove_glyph_map(page, both, [both], POLICY))
