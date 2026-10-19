"""Authored explicit simple-font widths with a genuine TJ word advance."""

from pdfminer.pdffont import FontMetricsDB
from pypdf import PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
)


def spacing_pdf(path, *, advance=-175, tracking=0, matrix="1 0 0 1"):
    _, widths = FontMetricsDB.get_metrics("Helvetica")
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/ABCDEF+Helvetica"),
            NameObject("/FirstChar"): NumberObject(32),
            NameObject("/LastChar"): NumberObject(126),
            NameObject("/Widths"): ArrayObject(
                [NumberObject(widths.get(chr(c), 0)) for c in range(32, 127)]
            ),
            NameObject("/Encoding"): NameObject("/WinAnsiEncoding"),
            NameObject("/FontDescriptor"): DictionaryObject(
                {
                    NameObject("/Type"): NameObject("/FontDescriptor"),
                    NameObject("/FontName"): NameObject("/ABCDEF+Helvetica"),
                    NameObject("/Flags"): NumberObject(32),
                    NameObject("/Ascent"): NumberObject(718),
                    NameObject("/Descent"): NumberObject(-207),
                    NameObject("/FontBBox"): ArrayObject(
                        [NumberObject(x) for x in [0, -207, 1000, 718]]
                    ),
                }
            ),
        }
    )
    writer = PdfWriter()
    page = writer.add_blank_page(width=500, height=300)
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
    )
    stream = DecodedStreamObject()
    stream.set_data(
        (
            f"BT /F1 12 Tf {tracking} Tc {matrix} 36 200 Tm "
            f"[(Alpha) {advance} (Beta continues with many ordinary words here)] TJ ET"
        ).encode()
    )
    page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)
