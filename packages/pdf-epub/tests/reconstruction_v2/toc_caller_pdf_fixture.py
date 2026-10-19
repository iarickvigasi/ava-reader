"""Authored original annotations, labels and bookmarks; no private book content."""

from pypdf import PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, NumberObject, TextStringObject


def write_source(path, *, roman=False):
    writer = PdfWriter()
    for _ in range(6):
        writer.add_blank_page(width=120, height=100)
    writer._root_object[NameObject("/PageLabels")] = DictionaryObject(
        {
            NameObject("/Nums"): ArrayObject(
                [
                    NumberObject(0),
                    DictionaryObject({NameObject("/P"): TextStringObject("Cover")}),
                    NumberObject(1),
                    DictionaryObject({NameObject("/S"): NameObject("/r")}),
                    NumberObject(3),
                    DictionaryObject({NameObject("/S"): NameObject("/D")}),
                ]
            )
        }
    )
    rows = [(20, 42, 2 if roman else 4), (52, 62, 5), (77, 87, 6)]
    for top, bottom, target in rows:
        writer.add_annotation(
            0,
            DictionaryObject(
                {
                    NameObject("/Subtype"): NameObject("/Link"),
                    NameObject("/Rect"): ArrayObject(
                        [
                            NumberObject(4),
                            NumberObject(100 - bottom),
                            NumberObject(108),
                            NumberObject(100 - top),
                        ]
                    ),
                    NameObject("/A"): DictionaryObject(
                        {
                            NameObject("/S"): NameObject("/GoTo"),
                            NameObject("/D"): ArrayObject(
                                [
                                    writer.pages[target - 1].indirect_reference,
                                    NameObject("/XYZ"),
                                    NumberObject(-102),
                                    NumberObject(80),
                                    NumberObject(0),
                                ]
                            ),
                        }
                    ),
                }
            ),
        )
    # Production books may store /Annots as an indirect array.
    writer.pages[0][NameObject("/Annots")] = writer._add_object(writer.pages[0]["/Annots"])
    writer.add_outline_item(
        "Preface continued" if roman else "1 Alpha - beta continued", 1 if roman else 3
    )
    writer.add_outline_item("Next", 4)
    writer.add_outline_item("Last", 5)
    writer.write(path)
