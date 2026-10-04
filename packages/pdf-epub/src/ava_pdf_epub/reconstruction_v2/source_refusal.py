"""Typed, text-free source findings for required material that cannot form a candidate."""

import hashlib
import re
from typing import Literal, TypedDict

from pydantic import Field, model_validator

from ..contracts.common import Digest, Id, Record
from ..contracts.source import Box
from .prepared import PreparedPage
from .recognition_contract import RecognitionTask
from .segments import Segment

RefusalCode = Literal[
    "ESSENTIAL_STRUCTURE_UNSUPPORTED", "RECOGNITION_UNRESOLVED", "SOURCE_LANGUAGE_UNSUPPORTED"
]


class SourceBlockingFinding(Record):
    code: RefusalCode
    severity: Literal["blocking"] = "blocking"
    page: int = Field(ge=1, le=500)
    box: Box
    region_box: Box
    block_id: Id | None = None
    segment_id_sha256: Digest | None = None
    task_id: Id | None = None
    render_sha256: Digest | None = None

    @model_validator(mode="after")
    def source_geometry(self) -> "SourceBlockingFinding":
        a, b = self.region_box, self.box
        if a.coordinate_space != "page_points_top_left" or b.coordinate_space != a.coordinate_space:
            raise ValueError("Refusal geometry must use source page points")
        if not (a.x0 <= b.x0 < b.x1 <= a.x1 and a.y0 <= b.y0 < b.y1 <= a.y1):
            raise ValueError("Refusal segment must stay inside the source region")
        return self


class SourceRefusalDiagnostic(Record):
    schema_version: Literal["ava-source-refusal-1"] = "ava-source-refusal-1"
    source_sha256: Digest
    stage: Literal["extraction", "assembly"]
    findings: list[SourceBlockingFinding] = Field(min_length=1, max_length=100)


class SourceContentRefusal(ValueError):
    def __init__(self, diagnostic: SourceRefusalDiagnostic) -> None:
        self.diagnostic = diagnostic
        reasons = {
            "ESSENTIAL_STRUCTURE_UNSUPPORTED": "Essential unsupported source content",
            "RECOGNITION_UNRESOLVED": "Essential recognition uncertainty requires source review",
            "SOURCE_LANGUAGE_UNSUPPORTED": "Unsupported recognition language",
        }
        super().__init__(reasons[diagnostic.findings[0].code])


class SegmentIdentity(TypedDict):
    block_id: str | None
    segment_id_sha256: str | None


def _identity(segment: Segment | None) -> SegmentIdentity:
    if segment is None:
        return {"block_id": None, "segment_id_sha256": None}
    return {
        "block_id": segment.id
        if re.fullmatch(r"[A-Za-z][A-Za-z0-9_.-]{0,119}", segment.id)
        else None,
        "segment_id_sha256": hashlib.sha256(segment.id.encode()).hexdigest(),
    }


def refuse_task(task: RecognitionTask, code: RefusalCode, segment: Segment | None = None) -> None:
    raise SourceContentRefusal(
        SourceRefusalDiagnostic(
            source_sha256=task.source_sha256,
            stage="extraction",
            findings=[
                SourceBlockingFinding(
                    code=code,
                    page=task.page_number,
                    box=segment.box if segment else task.region_box,
                    region_box=task.region_box,
                    task_id=task.task_id,
                    render_sha256=task.image.sha256,
                    **_identity(segment),
                )
            ],
        )
    )


def refuse_segment(prepared: PreparedPage, segment: Segment) -> None:
    page = prepared.observation
    if segment.page != page.number or not segment.box.within(page.width_pt, page.height_pt):
        raise ValueError("Refused segment is outside its prepared source page")
    raise SourceContentRefusal(
        SourceRefusalDiagnostic(
            source_sha256=prepared.source_sha256,
            stage="assembly",
            findings=[
                SourceBlockingFinding(
                    code="ESSENTIAL_STRUCTURE_UNSUPPORTED",
                    page=segment.page,
                    box=segment.box,
                    region_box=segment.box,
                    **_identity(segment),
                )
            ],
        )
    )
