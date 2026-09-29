"""Distinguish executed source corroboration from a model's unverified heading rank."""

from .findings import Finding
from .segments import Segment


def structure_findings(segments: list[Segment], ranked: set[str]) -> list[Finding]:
    return [
        Finding(
            code="OCR_HIERARCHY_UNCORROBORATED",
            message=(
                "OCR heading rank needs whole-book source corroboration; "
                "page-local rank is not proof."
            ),
            severity="blocking",
            page=segment.page,
            box=segment.box,
            block_id=segment.id,
        )
        for segment in segments
        if segment.kind == "heading" and segment.method == "ocr" and segment.id not in ranked
    ]
