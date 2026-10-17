"""Recognize empty FreeText artifacts without mistaking empty Contents for empty pixels."""

from typing import Any

from pypdf.errors import PdfReadError
from pypdf.generic import DictionaryObject, IndirectObject, StreamObject


def empty_freetext(annotation: Any) -> bool:
    if annotation.get("/Subtype") != "/FreeText":
        return False
    # Rich text, optional layers and alternate appearances need separate visible-content handling.
    if any(annotation.get(key) for key in ("/Contents", "/RC", "/OC", "/CL", "/LE")):
        return False
    appearances = annotation.get("/AP")
    if appearances is None:
        return True
    appearances = appearances.get_object()
    if not isinstance(appearances, DictionaryObject):
        return False
    for reference in appearances.values():
        try:
            appearance = reference.get_object() if hasattr(reference, "get_object") else reference
        except PdfReadError:
            # Object zero is reserved, so this particular placeholder cannot contain pixels.
            # Any other broken reference is unknown content, not an empty artifact.
            if isinstance(reference, IndirectObject) and reference.idnum == 0:
                continue
            return False
        # Some publishers leave an undefined normal-appearance reference on an empty text box.
        if appearance is None:
            if isinstance(reference, IndirectObject) and reference.idnum != 0:
                return False
            continue
        if not isinstance(appearance, StreamObject):
            return False
        # Even an empty Contents field can have visible text/artwork in its appearance stream.
        # Only zero paint operations are automatically empty; whitespace alone is harmless.
        if len(appearance.get_data()) > 65536 or appearance.get_data().strip():
            return False
    return True
