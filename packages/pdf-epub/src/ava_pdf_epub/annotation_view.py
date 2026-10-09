"""Create a private rendering view; the original source remains immutable and authoritative."""

from pathlib import Path
from uuid import uuid4

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, NameObject

from .admission_actions import inspect_annotations, inspect_catalog
from .annotation_kind import annotation_kind
from .annotation_view_cache import POLICY, cached_view, remember_view
from .worker_observation import observe


def annotation_view(source: Path, scratch: Path, *, exclude_inline: bool = False) -> Path:
    policy = POLICY + ":word-geometry-inline-v1" if exclude_inline else POLICY
    cached, output, receipt = cached_view(source, scratch, policy=policy)
    if cached is not None:
        observe("reuse", "annotation_view", True)
        return cached
    observe("reuse", "annotation_view", False)
    reader = PdfReader(source, strict=True)
    inspect_catalog(reader.trailer["/Root"])
    changed = False
    for page_number, page in enumerate(reader.pages, 1):
        inspect_annotations(page, page_number=page_number, page_count=len(reader.pages))
        kept = []
        for reference in page.get("/Annots", []):
            kind = annotation_kind(reference.get_object())
            if kind in {"personal", "empty"} or (
                exclude_inline
                and reference.get_object().get("/Subtype")
                in {"/Highlight", "/Underline", "/StrikeOut"}
            ):
                changed = True
            else:
                annotation = reference.get_object()
                if any(key in annotation for key in ("/Popup", "/Parent", "/IRT")):
                    changed = True
                kept.append(reference)
        if "/Annots" in page:
            page[NameObject("/Annots")] = ArrayObject(kept)
    if not changed:
        remember_view(None, receipt, policy=policy)
        return source
    output.parent.mkdir(parents=True, exist_ok=True)
    writer = PdfWriter()
    # Reader page wrappers are distinct from the catalog page tree in pypdf.
    # Explicitly add the inspected pages so exclusion edits survive serialization.
    for page in reader.pages:
        kept = list(page.get("/Annots", []))
        projected = writer.add_page(page, excluded_keys=["/Annots", "/B"])
        projected[NameObject("/Annots")] = ArrayObject(
            [
                writer._add_object(
                    ref.get_object().clone(writer, ignore_fields=["/Popup", "/Parent", "/IRT"])
                )
                for ref in kept
            ]
        )
    temporary = output.with_name(output.name + "." + uuid4().hex + ".partial")
    try:
        writer.write(temporary)
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    remember_view(output, receipt, policy=policy)
    return output
