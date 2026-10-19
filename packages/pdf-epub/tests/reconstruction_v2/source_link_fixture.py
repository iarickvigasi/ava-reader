"""Real original annotation order with one non-link preceding duplicate links."""

import hashlib
from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, NumberObject, TextStringObject

from ava_pdf_epub.reconstruction_v2.prepared import PreparedPage

from .test_pdf_links import observation
from .test_refinement_grouping import segment


def fixture(root: Path):
    source = root / "source.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.add_annotation(0, DictionaryObject({NameObject("/Subtype"): NameObject("/Text")}))
    for _ in range(2):
        writer.add_annotation(
            0,
            DictionaryObject(
                {
                    NameObject("/Subtype"): NameObject("/Link"),
                    NameObject("/Rect"): ArrayObject([NumberObject(v) for v in (10, 70, 90, 80)]),
                    NameObject("/A"): DictionaryObject(
                        {
                            NameObject("/S"): NameObject("/URI"),
                            NameObject("/URI"): TextStringObject("https://private.example/secret"),
                        }
                    ),
                }
            ),
        )
    writer.write(source)
    checkpoint = PreparedPage(
        schema_version="ava-prepared-page-1",
        source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
        source_byte_length=source.stat().st_size,
        source_page_count=1,
        observation=observation().model_copy(update={"lines": []}),
        tables=[],
        native_segments=[],
        tasks=[],
    )
    return source, checkpoint, segment("scan", "PRIVATE_BOOK")
