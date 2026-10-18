"""Authored alternating index headers exercise a short run inside a larger book."""

from pypdf import PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    FloatObject,
    NameObject,
    TextStringObject,
)

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.native_layout_policy import NATIVE_LAYOUT_POLICY
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_from_source
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan, Segment
from ava_pdf_epub.reconstruction_v2.source_feature_contract import FEATURE_POLICY
from ava_pdf_epub.reconstruction_v2.source_preparation import SourcePreparation


def header_case(root, *, header_size=8.5, link=False, same_side=False):
    writer = PdfWriter()
    for number in range(1, 9):
        page = writer.add_blank_page(width=346, height=582)
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Times-Roman"),
            }
        )
        page[NameObject("/Resources")] = DictionaryObject(
            {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
        )
        x = 36 if same_side or number % 2 == 0 or number == 1 else 250
        size, y = (16, 540) if number == 1 else (header_size, 554)
        rows = [f"BT /F1 {size} Tf {x} {y} Td (General index) Tj ET"]
        for i in range(8):
            for left, term in [(36, "alpha"), (178, "omega")]:
                rows.append(
                    f"BT /F1 8.5 Tf {left} {450 - i * 14} Td ({term} original entry {i + 10}) Tj ET"
                )
        stream = DecodedStreamObject()
        stream.set_data("\n".join(rows).encode())
        page[NameObject("/Contents")] = writer._add_object(stream)
        if link and number == 4:
            annotation = DictionaryObject(
                {
                    NameObject("/Type"): NameObject("/Annot"),
                    NameObject("/Subtype"): NameObject("/Link"),
                    NameObject("/Rect"): ArrayObject([FloatObject(v) for v in [35, 545, 100, 555]]),
                    NameObject("/A"): DictionaryObject(
                        {
                            NameObject("/S"): NameObject("/URI"),
                            NameObject("/URI"): TextStringObject("https://example.org/index"),
                        }
                    ),
                }
            )
            page[NameObject("/Annots")] = ArrayObject([writer._add_object(annotation)])
    source = root / "source.pdf"
    writer.write(source)
    prepared, qualified = [], {}
    with SourcePreparation(
        source,
        root / "scratch",
        BILINGUAL_PROFILE,
        source_layout_policy=NATIVE_LAYOUT_POLICY,
        source_feature_policy=FEATURE_POLICY,
    ) as prep:
        for number in range(1, 9):
            checkpoint = prepare_from_source(prep, number)
            prepared.append(checkpoint)
            assert len(checkpoint.tasks) == 1 and not checkpoint.native_segments
            task = checkpoint.tasks[0]
            owners = []
            for i, line in enumerate(checkpoint.observation.lines):
                header = line.text == "General index"
                furniture = header and number in {2, 3}
                owners.append(
                    Segment(
                        id=f"page{number}-{task.task_id[10:22]}-{i}",
                        page=number,
                        method="ocr",
                        kind="furniture" if furniture else "heading" if header else "paragraph",
                        text=line.text,
                        box=line.box,
                        heading_level=1 if header and not furniture else None,
                        chapter_start=number == 1 and header,
                        chapter_role="bodymatter" if number == 1 and header else None,
                        style=Style(id="observed", relative_size=1),
                        spans=[ObservedSpan(start=0, end=7, style=Style(id="observed", bold=True))]
                        if header and number == 4
                        else [],
                    )
                )
            qualified[number] = owners
    return source, prepared, qualified
