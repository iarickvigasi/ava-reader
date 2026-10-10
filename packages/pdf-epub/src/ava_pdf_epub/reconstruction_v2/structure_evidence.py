"""Distinguish executed source corroboration from a model's unverified heading rank."""

from .findings import Finding
from .segments import Segment


def structure_findings(
    segments: list[Segment], ranked: set[str], deferred_native: set[str] | None = None
) -> list[Finding]:
    deferred_native = deferred_native or set()
    return [
        Finding(
            code="MIXED_NATIVE_HIERARCHY_UNCORROBORATED"
            if segment.id in deferred_native
            else "NATIVE_ROLE_UNCORROBORATED"
            if segment.structure_candidate
            else "OCR_HIERARCHY_UNCORROBORATED",
            message="Native heading ancestry through OCR needs whole-book source corroboration."
            if segment.id in deferred_native
            else "Native same-font opening needs source-backed role corroboration."
            if segment.structure_candidate
            else (
                "OCR heading rank needs whole-book source corroboration; "
                "page-local rank is not proof."
            ),
            severity="blocking",
            page=segment.page,
            box=segment.box,
            block_id=segment.id,
        )
        for segment in segments
        if segment.structure_candidate
        or (segment.kind == "heading" and segment.method == "ocr" and segment.id not in ranked)
    ]
