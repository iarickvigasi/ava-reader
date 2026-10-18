"""Authored merged source folios retain original line identity and glyph ordinals."""

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, TextStringObject

from ava_pdf_epub.reconstruction_v2.geometry import union

from .test_pdf_links import box
from .toc_caller_fixture import fixture


def merged_fixture(root, *, single=False):
    f = fixture(root)
    page = f.page.model_copy(deep=True)
    lines = page.lines
    if single:
        writer = PdfWriter(clone_from=f.source)
        writer._root_object["/Outlines"]["/First"][NameObject("/Title")] = TextStringObject(
            "1 Alpha - beta"
        )
        writer.write(f.source)
        f.reader.close()
        f.reader = PdfReader(f.source)
        f.annotation = f.reader.pages[0]["/Annots"][0].get_object()
        f.owners[0] = f.owners[0].model_copy(update={"text": "1 Alpha – beta 1"})
        first = lines[1]
        folio = lines[3].model_copy(deep=True)
        folio.glyphs[0] = folio.glyphs[0].model_copy(update={"box": box(104, 20, 108, 30)})
        folio = folio.model_copy(update={"box": box(104, 20, 108, 30)})
        lines = [lines[0], first, folio, *lines[4:]]
        at = 1
    else:
        at = 2
    body, tail = lines[at : at + 2]
    joined = body.model_copy(
        update={
            "text": body.text + " " + tail.text,
            "glyphs": [*body.glyphs, *tail.glyphs],
            "box": union([body.box, tail.box]),
        }
    )
    page = page.model_copy(update={"lines": [*lines[:at], joined, *lines[at + 2 :]]})
    f.checkpoint = f.checkpoint.model_copy(update={"observation": page})
    return f
