"""Independent authored PDF positions and prose form the style-boundary oracle."""

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

GROUPS = [
    [
        (
            "Ordinary prose occupies this original body measure "
            "and continues across the whole printed line",
            48,
        ),
        (
            "the next source line provides a second observation "
            "of the independent paragraph margin",
            48,
        ),
        (
            "and its last printed line ends this first original paragraph "
            "without changing its text.",
            48,
        ),
    ],
    [
        (
            "A hanging paragraph begins at the physical outer edge "
            "and continues through its original words",
            48,
        ),
        (
            "then the continuation adopts its inset body margin while retaining every source word",
            62,
        ),
        ("and the final continuation shares that body margin and ends the hanging paragraph.", 62),
    ],
    [
        ("An inset block keeps every source line aligned to the same independent block margin", 84),
        ("then its continuation remains aligned while every ordinary word stays present", 84),
        ("and the final line ends the inset block at that same source margin.", 84),
    ],
]


def authored_pdf(path):
    writer = PdfWriter()
    page = writer.add_blank_page(width=600, height=800)
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
    rows = [("Preface", 48, 740)] + [
        (text, x, 690 - group * 85 - row * 15)
        for group, lines in enumerate(GROUPS)
        for row, (text, x) in enumerate(lines)
    ]
    stream = DecodedStreamObject()
    stream.set_data(
        "\n".join(f"BT /F1 11 Tf {x} {y} Td ({text}) Tj ET" for text, x, y in rows).encode()
    )
    page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)
