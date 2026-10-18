"""An authored original compound heading links to a different source page."""

import hashlib

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, NumberObject

from ava_pdf_epub.pdf_navigation import pdf_navigation
from ava_pdf_epub.reconstruction_v2.prepared import PreparedPage

from .compound_heading_fixture import fixture as heading_fixture
from .heading_caller_fixture import HeadingCallerFixture
from .test_pdf_links import box


def fixture(root):
    f = heading_fixture(root)
    writer = PdfWriter(clone_from=f.source)
    writer.add_annotation(
        0,
        DictionaryObject(
            {
                NameObject("/Subtype"): NameObject("/Link"),
                NameObject("/Rect"): ArrayObject([NumberObject(x) for x in (4, 56, 110, 90)]),
                NameObject("/A"): DictionaryObject(
                    {
                        NameObject("/S"): NameObject("/GoTo"),
                        NameObject("/D"): ArrayObject(
                            [
                                writer.pages[1].indirect_reference,
                                NameObject("/XYZ"),
                                NumberObject(0),
                                NumberObject(90),
                                NumberObject(0),
                            ]
                        ),
                    }
                ),
            }
        ),
    )
    writer.write(f.source)
    f.reader.close()
    f.reader = PdfReader(f.source)
    annotation = f.reader.pages[0]["/Annots"][0].get_object()
    checkpoint = PreparedPage(
        schema_version="ava-prepared-page-1",
        source_sha256=hashlib.sha256(f.source.read_bytes()).hexdigest(),
        source_byte_length=f.source.stat().st_size,
        source_page_count=2,
        observation=f.page,
        tables=[],
        native_segments=[],
        tasks=[],
    )
    return HeadingCallerFixture(
        f, annotation, pdf_navigation(f.reader, annotation), checkpoint, box(4, 10, 110, 44)
    )
