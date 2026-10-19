"""Additive geometry-only wire types; historical recognition responses remain closed."""

from typing import Literal, Self

from pydantic import Field, model_validator

from ..contracts.common import Digest, Id, Record
from ..contracts.profiles import ProfileId
from .recognition_contract import RecognitionImage
from .recognition_geometry_identity import geometry_digest
from .recognition_geometry_prompt import GEOMETRY_RESPONSE_BYTES, GEOMETRY_SLOT_LIMIT
from .recognition_geometry_slots import RecognitionGeometryPatch, RecognitionGeometrySlot


class RecognitionGeometryTask(Record):
    schema_version: Literal["ava-recognition-geometry-task-1"]
    task_id: Id
    purpose: Literal["repair_recognition_geometry"]
    prompt_version: Literal["ava-recognition-geometry-1"]
    response_schema_version: Literal["ava-recognition-geometry-response-1"]
    source_sha256: Digest
    profile_id: ProfileId
    page_number: int = Field(ge=1, le=500)
    original_task_id: Id
    render_sha256: Digest
    native_evidence_sha256: Digest
    original_response_json: str = Field(min_length=2, max_length=GEOMETRY_RESPONSE_BYTES)
    original_response_sha256: Digest
    image: RecognitionImage
    slots: list[RecognitionGeometrySlot] = Field(min_length=1, max_length=GEOMETRY_SLOT_LIMIT)

    @model_validator(mode="after")
    def binding(self) -> Self:
        from .recognition_geometry_binding import validate_geometry_task

        validate_geometry_task(self)
        return self


class RecognitionGeometryResponse(Record):
    schema_version: Literal["ava-recognition-geometry-response-1"]
    task_id: Id
    source_sha256: Digest
    original_task_id: Id
    render_sha256: Digest
    original_response_sha256: Digest
    outcome: Literal["corrected", "unresolved"]
    patches: list[RecognitionGeometryPatch] = Field(max_length=GEOMETRY_SLOT_LIMIT)
    unresolved_reason: Literal["IMAGE_UNCLEAR", "NO_UNIQUE_SOURCE_BOX"] | None = None

    @model_validator(mode="after")
    def disposition(self) -> Self:
        if (
            self.outcome == "corrected" and (not self.patches or self.unresolved_reason is not None)
        ) or (self.outcome == "unresolved" and (self.patches or self.unresolved_reason is None)):
            raise ValueError("GEOMETRY_DISPOSITION_DIFFERS")
        return self


class RecognitionGeometryProof(Record):
    original_response_json: str = Field(min_length=2, max_length=GEOMETRY_RESPONSE_BYTES)
    original_response_sha256: Digest
    response: RecognitionGeometryResponse

    @model_validator(mode="after")
    def binding(self) -> Self:
        raw = self.original_response_json.encode()
        if (
            len(raw) > GEOMETRY_RESPONSE_BYTES
            or geometry_digest(raw) != self.original_response_sha256
            or self.response.original_response_sha256 != self.original_response_sha256
        ):
            raise ValueError("GEOMETRY_PROOF_BYTES_DIFFER")
        return self
