"""Authored geometry: ordinary prose, repeated margins and a separate ornament row."""

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

BODY = [
    "Several bright readers follow this single stream of text.",
    "A careful paragraph continues along its original measure.",
    "Every ordinary word remains in the independently authored source.",
    "The next sentence ends this original passage without replacement.",
]


def document(path, *, different_style=False, columns=False, hidden=False, math=False):
    writer = PdfWriter()
    for number in range(1, 4):
        page = writer.add_blank_page(width=346, height=582)
        fonts = DictionaryObject()
        for name, face in [("F1", "Times-Roman"), ("F2", "Times-Bold")]:
            fonts[NameObject("/" + name)] = DictionaryObject(
                {
                    NameObject("/Type"): NameObject("/Font"),
                    NameObject("/Subtype"): NameObject("/Type1"),
                    NameObject("/BaseFont"): NameObject("/" + face),
                }
            )
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): fonts})
        rows = [
            f"BT /F1 8.5 Tf 36 545 Td ({number}) Tj ET",
            "BT /F1 8.5 Tf 245 545 Td (Running title) Tj ET",
        ]
        if columns:
            for index in range(5):
                rows.extend(
                    [
                        f"BT /F1 10.5 Tf 210 {470 - index * 14} Td (Right row {index}.) Tj ET",
                        f"BT /F1 10.5 Tf 36 {470 - index * 14} Td (Left row {index}.) Tj ET",
                    ]
                )
        else:
            body = ["Measured x = y remains a source expression.", *BODY[1:]] if math else BODY
            rows += [
                f"BT /F1 10.5 Tf 36 {470 - index * 14} Td ({text}) Tj ET"
                for index, text in enumerate(body)
            ]
        for index, x in enumerate([135, 171, 207]):
            face = "F2" if different_style and index == 1 else "F1"
            mode = "3 Tr " if hidden and index == 1 else ""
            rows.append(f"BT /{face} 10.5 Tf {x} 350 Td {mode}(*) Tj 0 Tr ET")
        rows.append(
            "BT /F1 10.5 Tf 36 310 Td (A later source sentence remains below the ornament.) Tj ET"
        )
        stream = DecodedStreamObject()
        stream.set_data("\n".join(rows).encode())
        page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)
    return path


def contents_document(path, *, ambiguous=False):
    writer = PdfWriter()
    titles = ["Chapter One and its honest ending", "Chapter Two", "Chapter Three"]
    for number in range(4):
        page = writer.add_blank_page(width=346, height=582)
        fonts = DictionaryObject(
            {
                NameObject("/F1"): DictionaryObject(
                    {
                        NameObject("/Type"): NameObject("/Font"),
                        NameObject("/Subtype"): NameObject("/Type1"),
                        NameObject("/BaseFont"): NameObject("/Times-Roman"),
                    }
                )
            }
        )
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): fonts})
        rows = [f"BT /F1 8.5 Tf 36 545 Td ({number or 'i'}) Tj ET"]
        if number == 0:
            rows += [
                "BT /F1 16 Tf 36 500 Td (Contents) Tj ET",
                "BT /F1 10.5 Tf 36 450 Td (Chapter One and) Tj ET",
                "BT /F1 10.5 Tf 36 436 Td (its honest ending) Tj ET",
                "BT /F1 10.5 Tf 296 436 Td (1) Tj ET",
                "BT /F1 10.5 Tf 36 400 Td (Chapter Two) Tj ET",
                "BT /F1 10.5 Tf 296 400 Td (2) Tj ET",
                "BT /F1 10.5 Tf 36 364 Td (Chapter Three) Tj ET",
                "BT /F1 10.5 Tf 296 364 Td (3) Tj ET",
            ]
            if ambiguous:
                rows.append("BT /F1 10.5 Tf 190 436 Td (Unrelated column) Tj ET")
        else:
            rows += [f"BT /F1 15 Tf 36 500 Td ({titles[number - 1]}) Tj ET"]
            rows += [
                f"BT /F1 10.5 Tf 36 {460 - index * 14} Td ({text}) Tj ET"
                for index, text in enumerate(BODY)
            ]
        stream = DecodedStreamObject()
        stream.set_data("\n".join(rows).encode())
        page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)
    return path
