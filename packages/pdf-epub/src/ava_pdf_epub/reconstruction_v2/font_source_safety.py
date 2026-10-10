"""Do not use concealed OCR fonts, transparency or form/type3 paint as print-face evidence."""

from typing import Any

from pypdf import PdfReader
from pypdf.generic import ContentStream

from .outline_type3 import outline_type3_safe
from .visibility_state import inert_graphics_state


def font_source_safe(page: Any, reader: PdfReader, *, allow_outline_type3: bool = False) -> bool:
    resources = page.get("/Resources", {})
    for font in resources.get("/Font", {}).values():
        if font.get_object().get("/Subtype") == "/Type3" and (
            not allow_outline_type3 or not outline_type3_safe(font.get_object(), reader)
        ):
            return False
    contents = page.get_contents()
    if contents is None:
        return False
    operations = ContentStream(contents, reader).operations
    if len(operations) > 1000000:
        return False
    for values, operator in operations:
        if operator == b"Tr" and (len(values) != 1 or int(values[0]) not in {0, 2}):
            return False
        if operator == b"gs" and (
            len(values) != 1 or not inert_graphics_state(resources, values[0])
        ):
            return False
        if operator == b"BDC" and values and str(values[0]) == "/OC":
            return False
        if operator == b"Do" and values:
            obj = resources.get("/XObject", {}).get(values[0])
            if obj is not None and obj.get_object().get("/Subtype") == "/Form":
                return False
    return True
