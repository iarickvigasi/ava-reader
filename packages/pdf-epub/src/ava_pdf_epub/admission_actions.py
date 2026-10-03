"""Conservative, non-executing admission of ordinary PDF navigation."""

import re
from typing import Any

from pypdf.errors import PdfReadError
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, TextStringObject

from .annotation_kind import annotation_kind
from .pdf_navigation import navigation_uri
from .static_navigation import static_page_jump


class AdmissionError(ValueError):
    """Stable refusal code with bounded, content-free source location."""

    def __init__(self, code: str, *, finding: dict[str, object] | None = None):
        super().__init__(code if re.fullmatch(r"PDF_[A-Z_]+", code) else "PDF_ANNOTATION_INVALID")
        self.finding = finding

    def refusal(self) -> dict[str, object]:
        result: dict[str, object] = {"accepted": False, "code": str(self)}
        if self.finding is not None:
            result["finding"] = self.finding
        return result


def resolved(value: Any) -> Any:
    return value.get_object() if hasattr(value, "get_object") else value


def ordinary_action(value: Any, *, initial: bool = False, page_count: int | None = None) -> None:
    action = resolved(value)
    if initial and isinstance(action, (ArrayObject, TextStringObject, NameObject)):
        return  # Initial destination, not executable code.
    if not isinstance(action, DictionaryObject) or "/Next" in action:
        raise AdmissionError("PDF_ACTIVE_CONTENT_UNSUPPORTED")
    kind = action.get("/S")
    if kind == "/GoTo" and "/D" in action:
        return
    if kind == "/URI" and not initial:
        try:
            navigation_uri(action.get("/URI"))
            return
        except ValueError as error:
            raise AdmissionError("PDF_ACTIVE_CONTENT_UNSUPPORTED") from error
    if kind == "/JavaScript" and not initial and page_count is not None:
        try:
            static_page_jump(action.get("/JS"), page_count)
            return
        except ValueError as error:
            raise AdmissionError("PDF_ACTIVE_CONTENT_UNSUPPORTED") from error
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


def inspect_annotations(
    page: Any, *, page_number: int | None = None, page_count: int | None = None
) -> None:
    location: dict[str, object] = {}
    if page_number is not None:
        location["page_number"] = page_number
    try:
        annotations = resolved(page.get("/Annots", []))
        if not isinstance(annotations, (ArrayObject, list)):
            raise AdmissionError("PDF_ANNOTATION_INVALID")
        if len(annotations) > 1000:
            raise AdmissionError("PDF_RESOURCE_LIMIT")
        if "/AA" in page:
            raise AdmissionError("PDF_ACTIVE_CONTENT_UNSUPPORTED")
        # Source order makes the first refusal reproducible, including related objects.
        pending: list[tuple[Any, int, tuple[str, ...]]] = [
            (reference, number, ())
            for number, reference in reversed(list(enumerate(annotations, 1)))
        ]
        visited: set[int] = set()
        while pending:
            reference, number, path = pending.pop()
            location = {"annotation_number": number, "relationship_path": list(path)}
            if page_number is not None:
                location["page_number"] = page_number
            if len(path) > 20 or len(visited) >= 10000:
                # Do not emit an over-limit path in the refusal contract.
                location["relationship_path"] = list(path[:20])
                raise AdmissionError("PDF_RESOURCE_LIMIT")
            annotation = resolved(reference)
            if not isinstance(annotation, DictionaryObject):
                raise AdmissionError("PDF_ANNOTATION_INVALID")
            if id(annotation) in visited:
                continue
            visited.add(id(annotation))
            if "/AA" in annotation:
                raise AdmissionError("PDF_ACTIVE_CONTENT_UNSUPPORTED")
            if "/A" in annotation:
                ordinary_action(
                    annotation["/A"],
                    page_count=page_count if annotation.get("/Subtype") == "/Link" else None,
                )
            annotation_kind(annotation)
            for key in reversed(("/Popup", "/Parent", "/IRT")):
                if key in annotation:
                    pending.append((annotation[key], number, (*path, key)))
    except AdmissionError as error:
        raise AdmissionError(str(error), finding=location or None) from error
    except (
        ValueError,
        TypeError,
        KeyError,
        AttributeError,
        IndexError,
        RecursionError,
        PdfReadError,
    ) as error:
        # Parser messages can contain private source values. Never emit them.
        safe_codes = {
            "PDF_REDACTION_UNSUPPORTED",
            "PDF_ANNOTATIONS_UNSUPPORTED",
            "PDF_ANNOTATION_GEOMETRY_INVALID",
            "PDF_ANNOTATION_APPEARANCE_REQUIRED",
            "PDF_ANNOTATION_APPEARANCE_INVALID",
            "PDF_ANNOTATION_VISIBILITY_REQUIRES_REVIEW",
        }
        code = str(error) if str(error) in safe_codes else "PDF_ANNOTATION_INVALID"
        raise AdmissionError(code, finding=location or None) from error
