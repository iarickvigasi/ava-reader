"""Visible print roles can qualify typography, never hidden scan text or transcription."""

import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader
from pypdf.generic import DecodedStreamObject, NameObject

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.font_source_safety import font_source_safe
from ava_pdf_epub.reconstruction_v2.observations import Graphic
from ava_pdf_epub.reconstruction_v2.ocr_font_faces import corroborate_ocr_font_faces
from ava_pdf_epub.reconstruction_v2.prepared import PreparedPage
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan

from .test_native_literal import source_pdf
from .test_pdf_links import box, observation
from .test_refinement_grouping import segment


def checkpoint(page):
    return PreparedPage(
        schema_version="ava-prepared-page-1",
        source_sha256="a" * 64,
        source_byte_length=100,
        source_page_count=1,
        observation=page,
        tables=[],
        native_segments=[],
        tasks=[],
    )


def declared_page():
    page = observation()
    line = page.lines[0]
    return page.model_copy(
        update={
            "lines": [
                line.model_copy(
                    update={
                        "glyphs": [
                            g.model_copy(update={"font": "Calibri-Light"}) for g in line.glyphs
                        ]
                    }
                )
            ]
        }
    )


class OcrFontFacesTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.source = Path(self.directory.name) / "source.pdf"
        source_pdf(self.source, "quote")
        self.page = declared_page()
        self.item = segment("ocr", "Go").model_copy(
            update={
                "box": box(),
                "style": Style(id="wrong", family="serif", bold=True),
                "spans": [
                    ObservedSpan(
                        start=0,
                        end=2,
                        url="https://example.org",
                        style=Style(id="span", italic=True, underline=True, color="#123456"),
                    )
                ],
            }
        )

    def result(self, page=None, items=None):
        state = AssemblyState()
        result = corroborate_ocr_font_faces(
            self.source, [checkpoint(page or self.page)], items or [self.item], state
        )
        return result, state

    def test_uniform_visible_face_corrects_roles_preserving_text_ranges_and_links(self):
        result, state = self.result()
        got = result[0]
        self.assertEqual("sans-serif", got.style.family)
        self.assertFalse(got.style.bold)
        self.assertFalse(got.style.italic)
        self.assertEqual(self.item.text, got.text)
        self.assertEqual(self.item.box, got.box)
        self.assertEqual("ocr", got.method)
        self.assertEqual([], got.native_line_ids)
        self.assertEqual(
            (0, 2, "https://example.org"), (got.spans[0].start, got.spans[0].end, got.spans[0].url)
        )
        self.assertTrue(got.spans[0].style.underline)
        self.assertEqual("#123456", got.spans[0].style.color)
        self.assertEqual("serif", self.item.style.family)
        self.assertEqual("OCR_DECLARED_FONT_FACE_CORROBORATED", state.structure_findings[0].code)

    def test_different_text_displaced_geometry_duplicate_owner_do_not_certify(self):
        for items in (
            [self.item.model_copy(update={"text": "Gone"})],
            [self.item.model_copy(update={"box": box(40, 60, 80, 80)})],
            [self.item, self.item.model_copy(update={"id": "duplicate"})],
        ):
            with self.subTest(items=items):
                result, state = self.result(items=items)
                self.assertEqual(items, result)
                self.assertEqual([], state.structure_findings)

    def test_hidden_unreliable_bitmap_unknown_or_mixed_faces_do_not_certify(self):
        line = self.page.lines[0]
        cases = [
            self.page.model_copy(update={"risks": ["unreliable_glyph_mapping"]}),
            self.page.model_copy(update={"graphics": [Graphic(kind="image", box=box())]}),
        ]
        for update in ({"visible": False}, {"font": "UnclassifiedFont"}, {"font": "Calibri-Bold"}):
            glyphs = [line.glyphs[0].model_copy(update=update), line.glyphs[1]]
            cases.append(
                self.page.model_copy(update={"lines": [line.model_copy(update={"glyphs": glyphs})]})
            )
        for page in cases:
            with self.subTest(page=page):
                result, state = self.result(page=page)
                self.assertEqual([self.item], result)
                self.assertEqual([], state.structure_findings)

    def test_layout_whitespace_does_not_promote_native_text_authority(self):
        item = self.item.model_copy(update={"text": "G\no"})
        result, state = self.result(items=[item])
        self.assertEqual("G\no", result[0].text)
        self.assertEqual("ocr", result[0].method)
        self.assertEqual("sans-serif", result[0].style.family)
        self.assertEqual(1, len(state.structure_findings))

    def test_concealed_rendering_and_type3_are_refused(self):
        reader = PdfReader(self.source)
        page = reader.pages[0]
        self.assertTrue(font_source_safe(page, reader))
        for mode, expected in ((0, True), (2, True), (3, False), (7, False)):
            stream = DecodedStreamObject()
            stream.set_data(f"BT {mode} Tr ET".encode())
            page[NameObject("/Contents")] = stream
            self.assertEqual(expected, font_source_safe(page, reader))
        page["/Resources"]["/Font"]["/F1"][NameObject("/Subtype")] = NameObject("/Type3")
        self.assertFalse(font_source_safe(page, reader))
