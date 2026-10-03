"""Reject oversized page/raster work before native decoding inside the container."""

from pathlib import Path
from typing import Any

from pypdf import PdfReader

from ..admission import inspect_admission
from ..annotation_kind import annotation_kind

MAX_PIXELS = 20_000_000
MAX_EDGE = 6000


def preflight(source: Path, page_limit: int = 500) -> dict[str, object]:
    inspection = inspect_admission(source)
    if int(str(inspection["page_count"])) > page_limit:
        raise ValueError("PDF_PAGE_LIMIT")
    reader = PdfReader(source, strict=True)
    visited: set[int] = set()
    for page in reader.pages:
        resources = page.get("/Resources", {})
        _resources(resources, visited, 0)
        for reference in page.get("/Annots", []):
            annotation = reference.get_object()
            if annotation_kind(annotation) == "visible":
                appearance = annotation["/AP"]["/N"]
                _resources(appearance.get("/Resources", {}), visited, 0)
    return inspection


def _resources(raw: Any, visited: set[int], depth: int) -> None:
    if depth > 20 or len(visited) > 10000:
        raise ValueError("PDF_RESOURCE_LIMIT")
    resource = raw.get_object() if hasattr(raw, "get_object") else raw
    objects = resource.get("/XObject", {})
    objects = objects.get_object() if hasattr(objects, "get_object") else objects
    for reference in objects.values():
        obj = reference.get_object()
        if id(obj) in visited:
            continue
        if len(visited) >= 10000:
            raise ValueError("PDF_RESOURCE_LIMIT")
        visited.add(id(obj))
        if obj.get("/Subtype") == "/Image":
            width, height = int(obj["/Width"]), int(obj["/Height"])
            if not (0 < width <= MAX_EDGE and 0 < height <= MAX_EDGE):
                raise ValueError("PDF_RASTER_LIMIT")
            if width * height > MAX_PIXELS:
                raise ValueError("PDF_RASTER_LIMIT")
            for key in ("/SMask", "/Mask"):
                mask = obj.get(key)
                resolved = mask.get_object() if hasattr(mask, "get_object") else mask
                if hasattr(resolved, "get"):
                    _resources({"/XObject": {"mask": mask}}, visited, depth + 1)
        elif obj.get("/Subtype") == "/Form":
            _resources(obj.get("/Resources", {}), visited, depth + 1)
