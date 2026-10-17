"""Author the tiny independent smoke source and its exact text oracle."""

from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject, NumberObject

EXPECTED = [
    "Chapter One",
    "This is an original native smoke paragraph.",
    "Chapter Two",
    "The second chapter remains available for review.",
]


def fixture(path: Path) -> None:
    """No parser/model output is used as the expected text."""
    writer = PdfWriter()
    writer.add_metadata({"/Title": "AVA native smoke", "/Author": "AVA Fixture Studio"})
    for i in range(2):
        page = writer.add_blank_page(width=400, height=600)
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
        page[NameObject("/Resources")] = DictionaryObject(
            {NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})}
        )
        stream = DecodedStreamObject()
        content = (
            f"BT /F1 24 Tf 40 550 Td ({EXPECTED[2 * i]}) Tj "
            f"/F1 12 Tf 0 -40 Td ({EXPECTED[2 * i + 1]}) Tj ET"
        )
        if i == 0:
            image = DecodedStreamObject()
            image.set_data(bytes([30, 100, 180] * 4))
            image.update(
                {
                    NameObject("/Type"): NameObject("/XObject"),
                    NameObject("/Subtype"): NameObject("/Image"),
                    NameObject("/Width"): NumberObject(2),
                    NameObject("/Height"): NumberObject(2),
                    NameObject("/ColorSpace"): NameObject("/DeviceRGB"),
                    NameObject("/BitsPerComponent"): NumberObject(8),
                }
            )
            page["/Resources"][NameObject("/XObject")] = DictionaryObject(
                {NameObject("/Im0"): writer._add_object(image)}
            )
            content += " q 80 0 0 80 40 350 cm /Im0 Do Q"
        stream.set_data(content.encode("ascii"))
        page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)
