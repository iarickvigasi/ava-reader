"""Classify passive annotations without treating their private Contents as book prose."""

import math
from typing import Any, Literal

from pypdf.errors import PdfReadError
from pypdf.generic import DictionaryObject, StreamObject

from .annotation_empty import empty_freetext

VISIBLE_TYPES = {
    "/FreeText",
    "/Highlight",
    "/Underline",
    "/Squiggly",
    "/StrikeOut",
    "/Ink",
    "/Stamp",
    "/Square",
    "/Circle",
    "/Line",
    "/Polygon",
    "/PolyLine",
    "/Caret",
}


def annotation_kind(annotation: Any) -> Literal["link", "empty", "personal", "visible"]:
    subtype = annotation.get("/Subtype")
    if subtype == "/Link":
        return "link"
    if subtype == "/Redact":
        raise ValueError("PDF_REDACTION_UNSUPPORTED")
    if subtype in {"/Text", "/Popup"}:
        return "personal"
    if empty_freetext(annotation):
        return "empty"
    if subtype not in VISIBLE_TYPES:
        raise ValueError("PDF_ANNOTATIONS_UNSUPPORTED")
    rect = annotation.get("/Rect", [])
    if len(rect) != 4:
        raise ValueError("PDF_ANNOTATION_GEOMETRY_INVALID")
    coordinates = [float(value) for value in rect]
    if not all(math.isfinite(v) for v in coordinates):
        raise ValueError("PDF_ANNOTATION_GEOMETRY_INVALID")
    if coordinates[2] <= coordinates[0] or coordinates[3] <= coordinates[1]:
        raise ValueError("PDF_ANNOTATION_GEOMETRY_INVALID")
    appearances = annotation.get("/AP")
    appearances = appearances.get_object() if hasattr(appearances, "get_object") else appearances
    if not isinstance(appearances, DictionaryObject):
        raise ValueError("PDF_ANNOTATION_APPEARANCE_REQUIRED")
    normal = appearances.get("/N")
    try:
        if normal is not None and hasattr(normal, "get_object"):
            normal = normal.get_object()
    except PdfReadError as error:
        raise ValueError("PDF_ANNOTATION_APPEARANCE_INVALID") from error
    if not isinstance(normal, StreamObject):
        raise ValueError("PDF_ANNOTATION_APPEARANCE_INVALID")
    box = normal.get("/BBox", [])
    if len(box) != 4 or not all(math.isfinite(float(v)) for v in box):
        raise ValueError("PDF_ANNOTATION_APPEARANCE_INVALID")
    if float(box[2]) <= float(box[0]) or float(box[3]) <= float(box[1]):
        raise ValueError("PDF_ANNOTATION_APPEARANCE_INVALID")
    if not normal.get_data().strip():
        raise ValueError("PDF_ANNOTATION_APPEARANCE_INVALID")
    # Hidden/no-view appearances must not leak Contents into recognition.
    if int(annotation.get("/F", 0)) & (1 | 2 | 32):
        raise ValueError("PDF_ANNOTATION_VISIBILITY_REQUIRES_REVIEW")
    if "/OC" in annotation:
        raise ValueError("PDF_ANNOTATION_VISIBILITY_REQUIRES_REVIEW")
    return "visible"
