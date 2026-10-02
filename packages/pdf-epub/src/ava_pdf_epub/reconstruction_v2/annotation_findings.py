"""Account for personal note exclusions without exposing their private text in reports."""

from pathlib import Path

from pypdf import PdfReader

from ..admission_actions import inspect_annotations
from ..annotation_kind import annotation_kind
from .findings import Finding


def annotation_findings(source: Path) -> list[Finding]:
    findings = []
    reader = PdfReader(source, strict=True)
    for number, page in enumerate(reader.pages, 1):
        inspect_annotations(page, page_number=number, page_count=len(reader.pages))
        pending = list(page.get("/Annots", []))
        visited: set[int] = set()
        personal = 0
        while pending:
            annotation = pending.pop().get_object()
            if id(annotation) in visited:
                continue
            visited.add(id(annotation))
            personal += annotation_kind(annotation) == "personal"
            pending.extend(
                annotation[key] for key in ("/Popup", "/Parent", "/IRT") if key in annotation
            )
        if personal:
            findings.append(
                Finding(
                    code="PERSONAL_PDF_ANNOTATIONS_RETAINED_IN_ORIGINAL",
                    message=f"{personal} personal note/popup objects remain in the original PDF; "
                    "they were excluded from converted author prose and AVA marks.",
                    severity="information",
                    page=number,
                )
            )
    return findings
