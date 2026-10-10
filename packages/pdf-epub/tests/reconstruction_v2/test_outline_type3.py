"""Outline font qualification excludes arbitrary painted glyph programs and false descriptors."""

import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    FloatObject,
    NameObject,
    NumberObject,
)

from ava_pdf_epub.reconstruction_v2.font_source_safety import font_source_safe
from ava_pdf_epub.reconstruction_v2.outline_type3 import numbers, outline_type3_safe


def stream(data):
    result = DecodedStreamObject()
    result.set_data(data)
    return result


def outline_font(program=b"600 0 0 0 600 700 d1 0 0 m 600 0 l 600 700 l h f"):
    return DictionaryObject(
        {
            NameObject("/Subtype"): NameObject("/Type3"),
            NameObject("/FontDescriptor"): DictionaryObject(
                {
                    NameObject("/FontName"): NameObject("/MinionPro-It"),
                    NameObject("/Flags"): NumberObject(68),
                }
            ),
            NameObject("/FontMatrix"): ArrayObject(
                [FloatObject(v) for v in (0.001, 0, 0, 0.001, 0, 0)]
            ),
            NameObject("/FirstChar"): NumberObject(65),
            NameObject("/LastChar"): NumberObject(65),
            NameObject("/Widths"): ArrayObject([NumberObject(600)]),
            NameObject("/ToUnicode"): stream(
                b"/CIDInit /ProcSet findresource begin 12 dict begin "
                b"begincmap 1 begincodespacerange <00> <FF> endcodespacerange "
                b"1 beginbfchar <41> <0041> endbfchar endcmap end end"
            ),
            NameObject("/CharProcs"): DictionaryObject({NameObject("/A"): stream(program)}),
        }
    )


class OutlineType3(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        writer = PdfWriter()
        page = writer.add_blank_page(width=600, height=800)
        page[NameObject("/Resources")] = DictionaryObject(
            {NameObject("/Font"): DictionaryObject({NameObject("/F"): outline_font()})}
        )
        page[NameObject("/Contents")] = stream(b"BT /F 12 Tf 40 400 Td (A) Tj ET")
        path = Path(self.directory.name) / "outline.pdf"
        writer.write(path)
        self.reader = PdfReader(path)
        self.page = self.reader.pages[0]
        self.font = self.page["/Resources"]["/Font"]["/F"]

    def test_outline_subset_is_opt_in_and_still_refuses_hidden_text(self):
        self.assertTrue(outline_type3_safe(self.font, self.reader))
        self.assertFalse(font_source_safe(self.page, self.reader))
        self.assertTrue(font_source_safe(self.page, self.reader, allow_outline_type3=True))
        self.page[NameObject("/Contents")] = stream(b"BT 3 Tr /F 12 Tf (A) Tj ET")
        self.assertFalse(font_source_safe(self.page, self.reader, allow_outline_type3=True))

    def test_images_forms_text_colors_clip_strokes_and_second_metrics_are_not_outline(self):
        for suffix in (
            b"/Im Do",
            b"BT ET",
            b"1 0 0 rg",
            b"0 0 2 2 re W n",
            b"S",
            b"q Q",
            b"1 0 0 1 0 0 cm",
            b"600 0 d0",
            b"/Unknown gs",
        ):
            with self.subTest(suffix=suffix):
                font = outline_font(b"600 0 0 0 600 700 d1 " + suffix)
                self.assertFalse(outline_type3_safe(font, self.reader))
        for program in (b"600 0 d0", b"0 0 m 600 0 0 0 600 700 d1", b"600 1 0 0 600 700 d1"):
            self.assertFalse(outline_type3_safe(outline_font(program), self.reader))

    def test_missing_unicode_unknown_or_contradictory_font_roles_and_resources_are_refused(self):
        for field in ("/ToUnicode", "/FontDescriptor", "/FontMatrix", "/CharProcs", "/Widths"):
            font = outline_font()
            del font[NameObject(field)]
            self.assertFalse(outline_type3_safe(font, self.reader))
        for name, flags in (("/Unknown-It", 68), ("/MinionPro-It", 4), ("/MinionPro-Regular", 68)):
            font = outline_font()
            font["/FontDescriptor"][NameObject("/FontName")] = NameObject(name)
            font["/FontDescriptor"][NameObject("/Flags")] = NumberObject(flags)
            self.assertFalse(outline_type3_safe(font, self.reader))
        font = outline_font()
        font[NameObject("/Resources")] = DictionaryObject(
            {NameObject("/XObject"): DictionaryObject()}
        )
        self.assertFalse(outline_type3_safe(font, self.reader))

    def test_outline_operation_bounds_and_matrix_are_finite(self):
        self.assertFalse(
            outline_type3_safe(
                outline_font(b"600 0 0 0 600 700 d1 " + b"0 0 m " * 10001), self.reader
            )
        )
        font = outline_font()
        font["/FontMatrix"][1] = FloatObject(0.1)
        self.assertFalse(outline_type3_safe(font, self.reader))
        font = outline_font()
        font["/FontMatrix"][3] = FloatObject(-0.001)
        self.assertTrue(outline_type3_safe(font, self.reader))
        for raw in ([float("inf")], [float("nan")], [1000001], ["bad"], None):
            self.assertIsNone(numbers(raw, 1))
