"""Authored cover has distinct large-image, lower-strip and outer-page pixels."""

from pathlib import Path

from PIL import Image
from pypdf import PdfWriter
from pypdf.generic import (
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
)

TITLE = "The Independent Harbour"


def authored_cover(path: Path) -> None:
    writer = PdfWriter()
    page = writer.add_blank_page(width=600, height=800)
    objects = DictionaryObject()
    for name, colour, size in (
        ("Large", "#123456", (598, 759)),
        ("Strip", "#45ab23", (598, 39)),
    ):
        pixels = Image.new("RGB", size, colour)
        stream = DecodedStreamObject()
        stream.set_data(pixels.tobytes())
        graphic = stream.flate_encode()
        graphic.update(
            {
                NameObject("/Type"): NameObject("/XObject"),
                NameObject("/Subtype"): NameObject("/Image"),
                NameObject("/Width"): NumberObject(pixels.width),
                NameObject("/Height"): NumberObject(pixels.height),
                NameObject("/ColorSpace"): NameObject("/DeviceRGB"),
                NameObject("/BitsPerComponent"): NumberObject(8),
            }
        )
        objects[NameObject("/" + name)] = writer._add_object(graphic)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {
            NameObject("/XObject"): objects,
            NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)}),
        }
    )
    commands = DecodedStreamObject()
    commands.set_data(
        (
            "q 1 0 0 rg 0 0 600 800 re f Q\n"
            "q 598 0 0 759 1 40 cm /Large Do Q\n"
            "q 598 0 0 39 1 1 cm /Strip Do Q\n"
            f"BT /F1 16 Tf 30 720 Td ({TITLE}) Tj ET"
        ).encode("ascii")
    )
    page[NameObject("/Contents")] = writer._add_object(commands)
    writer.write(path)
