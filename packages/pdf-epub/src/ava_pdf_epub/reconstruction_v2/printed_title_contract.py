"""Explicit document-title authority is separate from chapter and contributor roles."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Id, Record
from ..contracts.profiles import ProfileId
from ..contracts.source import Box
from .recognition_contract import RecognitionImage


class PrintedTitleNode(Record):
    id: Id
    page: Literal[1]
    text: str = Field(min_length=1, max_length=200)
    text_sha256: Digest
    method: Literal["native", "ocr"]
    box: Box
    page_width_pt: float = Field(gt=0, le=14400)
    page_height_pt: float = Field(gt=0, le=14400)
    render_sha256: Digest


class PrintedTitleCrop(Record):
    id: Id
    part: Literal["title", "context"]
    node_id: Id
    page: Literal[1]
    source_box: Box
    render_sha256: Digest
    image_box: list[int] = Field(min_length=4, max_length=4)


class PrintedTitleTask(Record):
    schema_version: Literal["ava-printed-title-task-1"]
    task_id: Id
    source_sha256: Digest
    observation_sha256: Digest
    profile_id: ProfileId
    prompt_version: Literal["ava-printed-title-1"]
    response_schema_version: Literal["ava-printed-title-response-1"]
    node: PrintedTitleNode
    pixels_per_point: Literal[2]
    crops: list[PrintedTitleCrop] = Field(min_length=2, max_length=2)
    image: RecognitionImage

    @model_validator(mode="after")
    def identity(self) -> "PrintedTitleTask":
        from .printed_title_identity import validate_printed_title_task

        validate_printed_title_task(self)
        return self


class PrintedTitleDecision(Record):
    node_id: Id
    text_sha256: Digest
    evidence_ids: list[Id] = Field(min_length=2, max_length=2)
    role: Literal["title"] | None


class PrintedTitleResponse(Record):
    schema_version: Literal["ava-printed-title-response-1"]
    task_id: Id
    source_sha256: Digest
    observation_sha256: Digest
    image_sha256: Digest
    decision: PrintedTitleDecision
