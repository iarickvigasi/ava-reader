"""Independently authored headers with identical body geometry distinguish routing intent."""

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

HEADERS = [
    "General index",
    "216 General index",
    "Contents",
    "Bibliography",
    "An index can be useful",
    "Chapter Two",
]


def index_pdf(path):
    writer = PdfWriter()
    for number, header in enumerate(HEADERS, 1):
        page = writer.add_blank_page(width=346, height=582)
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Times-Roman"),
            }
        )
        page[NameObject("/Resources")] = DictionaryObject(
            {
                NameObject("/Font"): DictionaryObject({NameObject("/F1"): font}),
            }
        )
        rows = [f"BT /F1 {16 if number == 1 else 8.5} Tf 36 540 Td ({header}) Tj ET"]
        if number == 1:
            rows.append(
                "BT /F1 8.5 Tf 36 500 Td "
                "(An introduction explains these original references.) Tj ET"
            )
        for i in range(8):
            for x, term in [(178, "omega"), (36 if i % 2 == 0 else 44.5, "alpha")]:
                rows.append(
                    f"BT /F1 8.5 Tf {x} {450 - i * 14} Td ({term} original entry {i + 10}) Tj ET"
                )
        stream = DecodedStreamObject()
        stream.set_data("\n".join(rows).encode())
        page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)
    return path
