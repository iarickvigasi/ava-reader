"""An authored original chapter heading links back to a different source page."""

import hashlib
from dataclasses import dataclass

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, NumberObject

from ava_pdf_epub.pdf_navigation import pdf_navigation
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.pdf_link_page import LinkPage
from ava_pdf_epub.reconstruction_v2.pdf_ocr_caller import ocr_pdf_caller
from ava_pdf_epub.reconstruction_v2.prepared import PreparedPage

from .numbered_heading_fixture import fixture as heading_fixture
from .test_pdf_links import box


@dataclass
class HeadingCallerFixture:
    heading: object
    annotation: object
    target: object
    checkpoint: object
    caller: object

    def prove(
        self, *, page=None, owners=None, caller=None, target=None, annotation=None, policy=POLICY
    ):
        checkpoint = self.checkpoint.model_copy(update={"observation": page or self.heading.page})
        return ocr_pdf_caller(
            self.heading.reader,
            target or self.target,
            annotation or self.annotation,
            caller or self.caller,
            LinkPage(checkpoint, self.heading.owners if owners is None else owners),
            AssemblyState(source_continuation_policy=policy),
            None,
            self.heading.source,
        )


def fixture(root, *, subtitle=True):
    f = heading_fixture(root, subtitle=subtitle)
    writer = PdfWriter(clone_from=f.source)
    writer.add_annotation(
        0,
        DictionaryObject(
            {
                NameObject("/Subtype"): NameObject("/Link"),
                NameObject("/Rect"): ArrayObject([NumberObject(x) for x in (4, 54, 84, 90)]),
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
        f,
        annotation,
        pdf_navigation(f.reader, annotation),
        checkpoint,
        box(4, 10, 84, 46 if subtitle else 32),
    )
