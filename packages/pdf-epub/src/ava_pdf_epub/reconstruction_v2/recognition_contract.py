"""Content request identity excludes execution authority; the trusted host supplies that."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Id, Record
from ..contracts.source import Box
from .recognition_segment import RecognitionSegment


class RecognitionImage(Record):
    media_type: Literal["image/png", "image/jpeg"]
    sha256: Digest
    byte_length: int = Field(ge=1, le=16777216)
    width: int = Field(ge=1, le=6000)
    height: int = Field(ge=1, le=6000)
    base64: str = Field(min_length=4, max_length=22369624)


class RecognitionTask(Record):
    schema_version: Literal["ava-recognition-task-1"]
    task_id: Id
    purpose: Literal["pdf_region_recognition", "pdf_structure_repair"]
    source_sha256: Digest
    profile_id: Literal["ava-pdf-prose-en-v2"]
    page_number: int = Field(ge=1, le=500)
    page_width_pt: float = Field(gt=0, le=20000)
    page_height_pt: float = Field(gt=0, le=20000)
    region_box: Box
    image: RecognitionImage
    native_evidence: str = Field(max_length=200000)
    native_evidence_sha256: Digest
    prompt_version: Literal["ava-prose-region-2"]
    response_schema_version: Literal["ava-recognition-response-2"]

    @model_validator(mode="after")
    def identity(self) -> "RecognitionTask":
        from .task_identity import validate_task

        validate_task(self)
        return self


class RecognitionResponse(Record):
    schema_version: Literal["ava-recognition-response-2"]
    task_id: Id
    source_sha256: Digest
    render_sha256: Digest
    segments: list[RecognitionSegment] = Field(max_length=2000)
    unresolved: list[str] = Field(max_length=100)
    language: str = Field(min_length=1, max_length=50)
