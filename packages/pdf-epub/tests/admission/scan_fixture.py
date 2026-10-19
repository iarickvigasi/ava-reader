"""Render authored native source into a true image-only page, preserving PDF annotations."""

from pathlib import Path
from typing import Any

from PIL import Image
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject, NumberObject

from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page

from .helpers import save


def scan_first_page(document: Any, scratch: Path) -> Path:
    annotation = document.pages[0].pop(NameObject("/Annots"))
    native_source = save(document, str(scratch))
    native = prepare_page(native_source, scratch, 1)
    with Image.open(scratch / native.observation.render_path) as rendered:
        image = rendered.convert("RGB")
        stream = DecodedStreamObject()
        stream.set_data(image.tobytes())
        stream.update(
            {
                NameObject("/Type"): NameObject("/XObject"),
                NameObject("/Subtype"): NameObject("/Image"),
                NameObject("/Width"): NumberObject(image.width),
                NameObject("/Height"): NumberObject(image.height),
                NameObject("/BitsPerComponent"): NumberObject(8),
                NameObject("/ColorSpace"): NameObject("/DeviceRGB"),
            }
        )
    first = document.pages[0]
    first[NameObject("/Resources")] = DictionaryObject(
        {
            NameObject("/XObject"): DictionaryObject(
                {NameObject("/Scan"): document._add_object(stream.flate_encode())}
            )
        }
    )
    content = DecodedStreamObject()
    content.set_data(b"q 300 0 0 400 0 0 cm /Scan Do Q")
    first[NameObject("/Contents")] = document._add_object(content)
    first[NameObject("/Annots")] = annotation
    source = scratch / "scanned.pdf"
    with source.open("wb") as output:
        document.write(output)
    return source
