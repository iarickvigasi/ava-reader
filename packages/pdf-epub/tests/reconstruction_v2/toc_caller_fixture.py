"""A wrapped TOC row with ordinal and folio tab stops and independent source authority."""

import hashlib
from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader

from ava_pdf_epub.pdf_navigation import pdf_navigation
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.ocr_toc_caller import ocr_toc_caller
from ava_pdf_epub.reconstruction_v2.prepared import PreparedPage

from .test_ocr_link_context import line
from .test_pdf_links import box, observation, segment
from .toc_caller_pdf_fixture import write_source


@dataclass
class TocFixture:
    source: Path
    reader: PdfReader
    checkpoint: PreparedPage
    owners: list
    caller: object
    annotation: object
    target: object

    @property
    def page(self):
        return self.checkpoint.observation

    def prove(
        self, *, page=None, owners=None, caller=None, target=None, annotation=None, policy=POLICY
    ):
        return ocr_toc_caller(
            self.reader,
            target or self.target,
            annotation or self.annotation,
            page or self.page,
            self.owners if owners is None else owners,
            caller or self.caller,
            policy,
            self.source,
        )


def fixture(root, *, roman=False):
    source = root / "toc.pdf"
    write_source(source, roman=roman)
    first = line("first", "Preface" if roman else "Alpha – beta", 20, 20)
    if not roman:
        marker = line("marker", "1", 4, 20)
        first = first.model_copy(
            update={
                "text": "1 " + first.text,
                "box": box(4, 20, first.box.x1, 30),
                "glyphs": [*marker.glyphs, *first.glyphs],
            }
        )
    text = ("Preface" if roman else "1 Alpha – beta") + "\ncontinued " + ("i" if roman else "1")
    lines = [
        line("header", "Contents", 20, 0),
        first,
        line("continuation", "continued", 20, 32),
        line("folio", "i" if roman else "1", 104, 32),
        line("second", "Next", 20, 52),
        line("folio2", "2", 104, 52),
        line("third", "Last", 20, 77),
        line("folio3", "3", 104, 77),
    ]
    page = observation().model_copy(update={"width_pt": 120, "render_width": 120, "lines": lines})
    owners = [
        segment("wrapped", text).model_copy(update={"box": box(4, 20, 108, 42)}),
        segment("next", "Next 2").model_copy(update={"box": box(20, 52, 108, 62)}),
        segment("last", "Last 3").model_copy(update={"box": box(20, 77, 108, 87)}),
    ]
    checkpoint = PreparedPage(
        schema_version="ava-prepared-page-1",
        source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
        source_byte_length=source.stat().st_size,
        source_page_count=6,
        observation=page,
        tables=[],
        native_segments=[],
        tasks=[],
    )
    reader = PdfReader(source)
    annotation = reader.pages[0]["/Annots"][0].get_object()
    return TocFixture(
        source,
        reader,
        checkpoint,
        owners,
        box(4, 20, 108, 42),
        annotation,
        pdf_navigation(reader, annotation),
    )
