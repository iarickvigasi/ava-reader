"""Author a mixed page with fixed native prose and independently drawn raster passages."""

from pathlib import Path

from PIL import Image
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject, NumberObject

NATIVE_LINES = [
    "The measured paragraph before the image stays exact.",
    "Its second native line retains the same known typography.",
    "The measured paragraph after the image stays exact.",
    "Its second native line also retains known typography.",
]


def authored_mixed(
    path: Path,
    image: Image.Image,
    *,
    image_top: int = 284,
    layout: str = "default",
    framed: bool = False,
    second_image: bool = False,
    lower_baseline: int = 300,
    crossed_table: bool = False,
    chained: bool = False,
) -> None:
    writer = PdfWriter()
    page = writer.add_blank_page(width=600, height=800)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    pixels = image.convert("RGB")
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
    page[NameObject("/Resources")] = DictionaryObject(
        {
            NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)}),
            NameObject("/XObject"): DictionaryObject(
                {NameObject("/Im1"): writer._add_object(graphic)}
            ),
        }
    )
    rows = [
        (text, 72, y)
        for text, y in zip(
            NATIVE_LINES, [710, 692, lower_baseline, lower_baseline - 18], strict=True
        )
    ]
    font_size, image_left, image_width = 12, 72, 450
    if layout == "offset":
        rows = [("The paragraph stays exact.", 72, y) for y in [710, 692, 300, 282]]
        image_left, image_width = 340, 200
    if layout == "columns":
        font_size, image_left, image_width = 9, 20, 560
        rows = [
            ("The measured words remain in this column.", x, y - row * 18)
            for x, y in [(50, 710), (330, 710), (72, 300), (352, 300)]
            for row in [0, 1]
        ]
    content = [f"BT /F1 {font_size} Tf"]
    for text, x, y in rows:
        content.append(f"1 0 0 1 {x} {y} Tm ({text}) Tj")
    image_bottom = 800 - image_top - 86
    content.extend(["ET", f"q {image_width} 0 0 86 {image_left} {image_bottom} cm /Im1 Do Q"])
    if framed:
        content.append("q 340 370 160 40 re S Q")
    if second_image:
        content.append("q 200 0 0 60 300 370 cm /Im1 Do Q")
    if crossed_table:
        content.append("q 80 680 120 60 re S 140 680 m 140 740 l S 80 710 m 200 710 l S Q")
    if chained:
        content.extend(["q 500 350 40 40 re S Q", "q 72 340 8 120 re S Q"])
    commands = DecodedStreamObject()
    commands.set_data("\n".join(content).encode("ascii"))
    page[NameObject("/Contents")] = writer._add_object(commands)
    writer.write(path)
