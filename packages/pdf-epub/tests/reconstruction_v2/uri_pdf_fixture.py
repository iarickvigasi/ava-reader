"""Authored Courier PDF with one URL split over two reversed original annotations."""

from pypdf import PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    FloatObject,
    NameObject,
    TextStringObject,
)


def uri_pdf(path, *, raw="www.example.test/chapter.htm", cross_gutter=False):
    first, last = raw.rsplit("/", 1)
    first += "/"
    writer = PdfWriter()
    page = writer.add_blank_page(width=400, height=500)
    page[NameObject("/Resources")] = DictionaryObject(
        {
            NameObject("/Font"): DictionaryObject(
                {
                    NameObject("/F1"): DictionaryObject(
                        {
                            NameObject("/Type"): NameObject("/Font"),
                            NameObject("/Subtype"): NameObject("/Type1"),
                            NameObject("/BaseFont"): NameObject("/Courier"),
                        }
                    )
                }
            )
        }
    )
    rows = [
        (36, 440, "An unrelated para-"),
        (36, 426, "graph belongs to the ordinary surrounding prose."),
        (160, 412, "Visit " + first),
        (36, 398, last + ". Reading continues here."),
    ]
    positions = [(36, 398, last), (196, 412, first)]
    if cross_gutter:
        rows = [
            (36, 440, "Left source row"),
            (236, 440, "Right source row"),
            (36, 426, "Another left row"),
            (200, 426, "Visit " + first),
            (36, 412, last + ". Read on."),
            (236, 412, "Another right row"),
        ]
        positions = [(36, 412, last), (236, 426, first)]
    stream = DecodedStreamObject()
    stream.set_data(
        "\n".join(f"BT /F1 10 Tf {x} {y} Td ({text}) Tj ET" for x, y, text in rows).encode()
    )
    page[NameObject("/Contents")] = writer._add_object(stream)
    for x, y, text in positions:
        writer.add_annotation(
            0,
            DictionaryObject(
                {
                    NameObject("/Subtype"): NameObject("/Link"),
                    NameObject("/Rect"): ArrayObject(
                        [FloatObject(v) for v in (x, y - 3, x + len(text) * 6, y + 9)]
                    ),
                    NameObject("/A"): DictionaryObject(
                        {
                            NameObject("/S"): NameObject("/URI"),
                            NameObject("/URI"): TextStringObject(raw),
                        }
                    ),
                }
            ),
        )
    writer.write(path)
    return first, last
