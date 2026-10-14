"""Opt-in compact native decisions; historical Native1 contracts remain closed."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Id, Record
from ..contracts.layout_hyphen import LayoutHyphenDisposition
from ..contracts.profiles import ProfileId
from .native_structure_fields import (
    NativeStructureArtifact,
    NativeStructureBoundary,
    NativeStructureCallout,
    NativeStructureLine,
    NativeStructureReference,
    NativeStructureRegion,
)
from .native_structure_v2_fields import NativeStructureGroup2
from .recognition_contract import RecognitionImage


class NativeStructureTask2(Record):
    schema_version: Literal["ava-native-structure-task-2"]
    task_id: Id
    purpose: Literal["pdf_native_structure"]
    source_sha256: Digest
    observation_sha256: Digest
    profile_id: ProfileId
    page_number: int = Field(ge=1, le=500)
    page_width_pt: float = Field(gt=0, le=20000)
    page_height_pt: float = Field(gt=0, le=20000)
    image: RecognitionImage
    lines: list[NativeStructureLine] = Field(min_length=1, max_length=10000)
    regions: list[NativeStructureRegion] = Field(min_length=1, max_length=2000)
    artifacts: list[NativeStructureArtifact] = Field(max_length=2000)
    boundaries: list[NativeStructureBoundary] = Field(max_length=10000)
    eligible_callouts: list[NativeStructureCallout] = Field(max_length=20000)
    prompt_version: Literal["ava-native-structure-2"]
    response_schema_version: Literal["ava-native-structure-response-2"]

    @model_validator(mode="after")
    def identity(self) -> "NativeStructureTask2":
        from .native_structure_identity import validate_native_structure_task

        validate_native_structure_task(self)
        return self


class NativeStructureResponse2(Record):
    schema_version: Literal["ava-native-structure-response-2"]
    task_id: Id
    source_sha256: Digest
    observation_sha256: Digest
    render_sha256: Digest
    groups: list[NativeStructureGroup2] = Field(max_length=2000)
    boundary_dispositions: list[LayoutHyphenDisposition] = Field(max_length=10000)
    references: list[NativeStructureReference] = Field(max_length=20000)
    unresolved: list[str] = Field(max_length=100)
    language: str = Field(min_length=1, max_length=50)
