"""Original test prose; real PDF appearance pixels, never a private book copy."""

from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
    TextStringObject,
)

from .helpers import link, writer

BODY = "The book keeps this ordinary sentence and its original words."
EDITORIAL = "Editorial textbox survives."


def annotated_document(subtype="/FreeText"):
    annotation = link()
    annotation[NameObject("/Subtype")] = NameObject(subtype)
    annotation[NameObject("/Contents")] = TextStringObject(EDITORIAL)
    annotation[NameObject("/DA")] = TextStringObject("/F1 12 Tf 0 g")
    annotation[NameObject("/F")] = NumberObject(4)
    annotation[NameObject("/Rect")] = ArrayObject([NumberObject(n) for n in [30, 150, 230, 180]])
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    resources = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})})
    appearance = DecodedStreamObject()
    appearance.set_data(f"BT /F1 12 Tf 0 8 Td ({EDITORIAL}) Tj ET".encode())
    appearance[NameObject("/BBox")] = ArrayObject([NumberObject(n) for n in [0, 0, 200, 30]])
    appearance[NameObject("/Resources")] = resources
    appearance[NameObject("/Type")] = NameObject("/XObject")
    appearance[NameObject("/Subtype")] = NameObject("/Form")
    annotation[NameObject("/AP")] = DictionaryObject({NameObject("/N"): appearance})
    document = writer(annotation)
    annotation[NameObject("/AP")] = DictionaryObject(
        {NameObject("/N"): document._add_object(appearance)}
    )
    document.add_blank_page(width=300, height=400)
    for page in document.pages:
        page[NameObject("/Resources")] = resources
        stream = DecodedStreamObject()
        stream.set_data(f"BT /F1 10 Tf 20 250 Td ({BODY}) Tj ET".encode())
        page[NameObject("/Contents")] = document._add_object(stream)
    return document


def passive_document(subtype):
    """Distinct highlight/ink geometry and appearance; not a renamed textbox."""
    document = annotated_document()
    annotation = document.pages[0]["/Annots"][0].get_object()
    annotation[NameObject("/Subtype")] = NameObject(subtype)
    del annotation[NameObject("/DA")]
    del annotation[NameObject("/Contents")]
    appearance = DecodedStreamObject()
    appearance[NameObject("/Type")] = NameObject("/XObject")
    appearance[NameObject("/Subtype")] = NameObject("/Form")
    if subtype == "/Highlight":
        rectangle = [20, 247, 150, 260]
        annotation[NameObject("/QuadPoints")] = ArrayObject(
            [NumberObject(n) for n in [20, 260, 150, 260, 20, 247, 150, 247]]
        )
        annotation[NameObject("/C")] = ArrayObject(
            [NumberObject(1), NumberObject(1), NumberObject(0)]
        )
        appearance.set_data(b"q /GS gs 1 1 0 rg 0 0 130 13 re f Q")
        state = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/ExtGState"),
                NameObject("/BM"): NameObject("/Multiply"),
            }
        )
        appearance[NameObject("/Resources")] = DictionaryObject(
            {NameObject("/ExtGState"): DictionaryObject({NameObject("/GS"): state})}
        )
    elif subtype in {"/Underline", "/StrikeOut"}:
        rectangle = [20, 247, 150, 260]
        annotation[NameObject("/QuadPoints")] = ArrayObject(
            [NumberObject(n) for n in [20, 260, 150, 260, 20, 247, 150, 247]]
        )
        annotation[NameObject("/C")] = ArrayObject(
            [NumberObject(0), NumberObject(0), NumberObject(1)]
        )
        y = 1 if subtype == "/Underline" else 6
        appearance.set_data(f"q 0 0 1 RG 1 w 0 {y} m 130 {y} l S Q".encode())
    elif subtype == "/Ink":
        rectangle = [30, 160, 230, 200]
        points = [40, 175, 75, 190, 110, 168, 145, 188, 185, 172, 220, 192]
        annotation[NameObject("/InkList")] = ArrayObject(
            [ArrayObject([NumberObject(n) for n in points])]
        )
        annotation[NameObject("/C")] = ArrayObject(
            [NumberObject(0), NumberObject(0), NumberObject(1)]
        )
        appearance.set_data(b"q 0 0 1 RG 3 w 10 15 m 45 30 l 80 8 l 115 28 l 155 12 l 190 32 l S Q")
    else:
        raise ValueError("Fixture expects genuine Highlight, Underline, StrikeOut or Ink")
    width, height = rectangle[2] - rectangle[0], rectangle[3] - rectangle[1]
    annotation[NameObject("/Rect")] = ArrayObject([NumberObject(n) for n in rectangle])
    appearance[NameObject("/BBox")] = ArrayObject([NumberObject(n) for n in [0, 0, width, height]])
    annotation[NameObject("/AP")] = DictionaryObject(
        {NameObject("/N"): document._add_object(appearance)}
    )
    return document


def multiline_highlight():
    """Two separated quads, with an unmarked line between them."""
    document = passive_document("/Highlight")
    annotation = document.pages[0]["/Annots"][0].get_object()
    annotation[NameObject("/Rect")] = ArrayObject([NumberObject(n) for n in [20, 207, 150, 260]])
    annotation[NameObject("/QuadPoints")] = ArrayObject(
        [
            NumberObject(n)
            for n in [20, 260, 150, 260, 20, 247, 150, 247, 20, 220, 150, 220, 20, 207, 150, 207]
        ]
    )
    appearance = annotation["/AP"]["/N"].get_object()
    appearance[NameObject("/BBox")] = ArrayObject([NumberObject(n) for n in [0, 0, 130, 53]])
    appearance.set_data(b"q /GS gs 1 1 0 rg 0 40 130 13 re f 0 0 130 13 re f Q")
    stream = DecodedStreamObject()
    stream.set_data(
        (
            f"BT /F1 10 Tf 20 250 Td ({BODY}) Tj "
            "0 -20 Td (Unmarked line between the quads.) Tj "
            "0 -20 Td (The book keeps this ordinary second line.) Tj ET"
        ).encode()
    )
    document.pages[0][NameObject("/Contents")] = document._add_object(stream)
    return document
