"""Conservative, non-executing admission of ordinary PDF navigation."""

from typing import Any
from urllib.parse import urlsplit

from pypdf.generic import ArrayObject, DictionaryObject, NameObject, TextStringObject


class AdmissionError(ValueError):
    pass


def resolved(value: Any) -> Any:
    return value.get_object() if hasattr(value, "get_object") else value


def ordinary_action(value: Any, *, initial: bool = False) -> None:
    action = resolved(value)
    if initial and isinstance(action, (ArrayObject, TextStringObject, NameObject)):
        return  # Initial destination, not executable code.
    if not isinstance(action, DictionaryObject) or "/Next" in action:
        raise AdmissionError("PDF_ACTIVE_CONTENT_UNSUPPORTED")
    kind = action.get("/S")
    if kind == "/GoTo" and "/D" in action:
        return
    if kind == "/URI" and not initial:
        uri = action.get("/URI")
        if (
            isinstance(uri, str)
            and len(uri) <= 4096
            and not any(ord(char) < 32 or ord(char) == 127 for char in uri)
            and urlsplit(uri).scheme.lower() in {"http", "https", "mailto"}
        ):
            return
    raise AdmissionError("PDF_ACTIVE_CONTENT_UNSUPPORTED")


def inspect_catalog(root: Any) -> None:
    if "/AA" in root:
        raise AdmissionError("PDF_ACTIVE_CONTENT_UNSUPPORTED")
    if "/OpenAction" in root:
        ordinary_action(root["/OpenAction"], initial=True)
    names = resolved(root.get("/Names", {}))
    if "/JavaScript" in names:
        raise AdmissionError("PDF_ACTIVE_CONTENT_UNSUPPORTED")
    if "/EmbeddedFiles" in names or "/Collection" in root:
        raise AdmissionError("PDF_EMBEDDED_CONTENT_UNSUPPORTED")
    form = resolved(root.get("/AcroForm", {}))
    if form.get("/Fields") or "/XFA" in form:
        raise AdmissionError("PDF_FORMS_UNSUPPORTED")


def inspect_annotations(page: Any) -> None:
    annotations = resolved(page.get("/Annots", []))
    if len(annotations) > 1000:
        raise AdmissionError("PDF_RESOURCE_LIMIT")
    if "/AA" in page:
        raise AdmissionError("PDF_ACTIVE_CONTENT_UNSUPPORTED")
    for reference in annotations:
        annotation = resolved(reference)
        if annotation.get("/Subtype") != "/Link":
            raise AdmissionError("PDF_ANNOTATIONS_UNSUPPORTED")
        if "/AA" in annotation:
            raise AdmissionError("PDF_ACTIVE_CONTENT_UNSUPPORTED")
        if "/A" in annotation:
            ordinary_action(annotation["/A"])
