from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, NumberObject, TextStringObject


def action(kind="/URI", uri="https://example.invalid/"):
    value = DictionaryObject({NameObject("/S"): NameObject(kind)})
    value[NameObject("/URI")] = TextStringObject(uri)
    return value


def link(value=None):
    result = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Annot"),
            NameObject("/Subtype"): NameObject("/Link"),
            NameObject("/Rect"): ArrayObject([NumberObject(n) for n in [0, 0, 10, 10]]),
        }
    )
    if value is not None:
        result[NameObject("/A")] = value
    return result


def writer(annotation=None):
    result = PdfWriter()
    page = result.add_blank_page(width=300, height=400)
    if annotation is not None:
        page[NameObject("/Annots")] = ArrayObject([result._add_object(annotation)])
    return result


def save(document, directory):
    path = Path(directory) / "source.pdf"
    document.write(path)
    return path
