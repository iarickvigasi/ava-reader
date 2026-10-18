"""Bind a caller to actual inert original annotations sharing one exact raw URI."""

from typing import Any

from pypdf import PdfReader

from ..contracts.source import Box
from ..pdf_navigation import NavigationTarget, pdf_navigation
from .annotation_regions import upright_box
from .observations import PageObservation
from .uri_group_types import OriginalUriGroup


def uri_original_group(
    reader: PdfReader,
    target: NavigationTarget,
    annotation: Any,
    page: PageObservation,
    caller: Box,
) -> OriginalUriGroup | None:
    if not isinstance(annotation, dict):
        return None
    action = annotation.get("/A")
    action = action.get_object() if action is not None and hasattr(action, "get_object") else action
    if not isinstance(action, dict) or action.get("/S") != "/URI" or not target.url:
        return None
    raw = action.get("/URI")
    if (
        not isinstance(raw, str)
        or not 1 <= len(raw) <= 2048
        or not raw.startswith(("http://", "https://", "www."))
    ):
        return None
    source_page = reader.pages[page.number - 1]
    annotations = source_page.get("/Annots", [])
    annotations = annotations.get_object() if hasattr(annotations, "get_object") else annotations
    if not isinstance(annotations, list) or len(annotations) > 10000:
        return None
    boxes, current = [], None
    for index, reference in enumerate(annotations):
        original = reference.get_object()
        original_action = original.get("/A")
        original_action = (
            original_action.get_object()
            if hasattr(original_action, "get_object")
            else original_action
        )
        if not isinstance(original_action, dict) or original_action.get("/URI") != raw:
            continue
        if "/Dest" in original:
            return None
        try:
            if pdf_navigation(reader, original) != target:
                return None
            rect = upright_box(source_page, [float(v) for v in original["/Rect"]])
        except (ValueError, TypeError, KeyError):
            return None
        if not rect.within(page.width_pt, page.height_pt):
            return None
        boxes.append((index, rect))
        if original is annotation:
            if current is not None or rect != caller:
                return None
            current = index
    if current is None or not boxes or len(boxes) > 16:
        return None
    return OriginalUriGroup(raw, current, tuple(boxes))
