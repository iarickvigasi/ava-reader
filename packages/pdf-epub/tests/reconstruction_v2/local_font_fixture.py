"""Authored direct Type1 paint with one separately recorded unmapped source line."""

from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.observations import NativeLine
from ava_pdf_epub.reconstruction_v2.ocr_font_faces import corroborate_ocr_font_faces

from .test_ocr_font_faces import checkpoint, declared_page
from .test_pdf_links import box
from .test_refinement_grouping import segment


def source(path: Path, prefix=b"", *, state=None, subtype="/Type1", matrix=None):
    writer = PdfWriter()
    page = writer.add_blank_page(width=100, height=100)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject(subtype),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    if matrix is not None:
        font[NameObject("/FontMatrix")] = matrix
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
    )
    if state is not None:
        page["/Resources"][NameObject("/ExtGState")] = DictionaryObject(
            {NameObject("/Safe"): DictionaryObject(state)}
        )
        prefix = b"/Safe gs " + prefix
    stream = DecodedStreamObject()
    stream.set_data(prefix + b" BT /F1 10 Tf 1 0 0 1 0 70 Tm (Go) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)


def observed():
    page = declared_page()
    glyph = (
        page.lines[0]
        .glyphs[0]
        .model_copy(update=dict(text="(cid:2)", font="Symbol", box=box(60, 60, 70, 70)))
    )
    bad = NativeLine(
        id="unmapped", text=glyph.text, box=glyph.box, glyphs=[glyph], style=page.lines[0].style
    )
    return page.model_copy(
        update=dict(lines=[*page.lines, bad], risks=["unreliable_glyph_mapping"])
    )


def result(path, page, owners=None, current=True):
    item = segment("ocr", "Go").model_copy(
        update=dict(box=box(), style=Style(id="wrong", family="serif"))
    )
    state = AssemblyState(source_continuation_policy=POLICY if current else None)
    values = owners or [item]
    return values, corroborate_ocr_font_faces(path, [checkpoint(page)], values, state), state
