"""An authored original backlink has unrelated invisible glyphs elsewhere on its page."""

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

from .visible_target_fixture import fixture as visible_fixture


@dataclass
class InkCallerFixture:
    visible: object
    checkpoint: object
    annotation: object
    target: object
    source: object

    def prove(self, *, page=None, owners=None, caller=None, target=None, policy=POLICY):
        f = self.visible
        checkpoint = self.checkpoint.model_copy(update={"observation": page or f.page})
        return ocr_pdf_caller(
            f.reader,
            target or self.target,
            self.annotation,
            caller or f.owners[0].box,
            LinkPage(checkpoint, f.owners if owners is None else owners),
            AssemblyState(source_continuation_policy=policy),
            None,
            self.source,
        )


def fixture(root):
    f = visible_fixture(root)
    source = root / "source.pdf"
    writer = PdfWriter(clone_from=f.reader)
    writer.add_blank_page(width=100, height=100)
    writer.add_annotation(
        0,
        DictionaryObject(
            {
                NameObject("/Subtype"): NameObject("/Link"),
                NameObject("/Rect"): ArrayObject([NumberObject(x) for x in (0, 70, 28, 80)]),
                NameObject("/Dest"): ArrayObject(
                    [
                        writer.pages[1].indirect_reference,
                        NameObject("/XYZ"),
                        NumberObject(0),
                        NumberObject(80),
                        NumberObject(0),
                    ]
                ),
            }
        ),
    )
    writer.write(source)
    f.reader.close()
    f.reader = PdfReader(source)
    annotation = f.reader.pages[0]["/Annots"][0].get_object()
    checkpoint = PreparedPage(
        schema_version="ava-prepared-page-1",
        source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
        source_byte_length=source.stat().st_size,
        source_page_count=2,
        observation=f.page,
        tables=[],
        native_segments=[],
        tasks=[],
    )
    return InkCallerFixture(f, checkpoint, annotation, pdf_navigation(f.reader, annotation), source)
