"""Current-only role authority without a manufactured body-typography reference."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Id, Record
from ..contracts.profiles import ProfileId
from ..contracts.source import Box
from .recognition_contract import RecognitionImage


class SourceRoleNode(Record):
    id: Id
    page: int = Field(ge=1, le=500)
    kind: Literal["paragraph", "quote"]
    source_box: Box
    text_sha256: Digest
    owner_sha256: Digest
    text_length: int = Field(ge=1, le=200000)
    text_excerpt: str = Field(max_length=500)


class SourceRoleCrop(Record):
    id: Id
    part: Literal["page", "local"]
    node_id: Id | None
    source_box: Box
    render_sha256: Digest
    image_box: list[int] = Field(min_length=4, max_length=4)


class SourceRoleTask(Record):
    schema_version: Literal["ava-book-refinement-task-6"]
    task_id: Id
    source_sha256: Digest
    observation_sha256: Digest
    profile_id: ProfileId
    prompt_version: Literal["ava-book-refinement-9"]
    response_schema_version: Literal["ava-book-refinement-response-6"]
    page: int = Field(ge=1, le=500)
    page_width_pt: float = Field(gt=0, le=20000)
    page_height_pt: float = Field(gt=0, le=20000)
    pixels_per_point: Literal[2]
    nodes: list[SourceRoleNode] = Field(min_length=1, max_length=24)
    crops: list[SourceRoleCrop] = Field(min_length=2, max_length=25)
    image: RecognitionImage

    @model_validator(mode="after")
    def identity(self) -> "SourceRoleTask":
        from .source_role_identity import validate_source_role_task

        validate_source_role_task(self)
        return self


class SourceRoleDecision(Record):
    node_id: Id
    text_sha256: Digest
    role: Literal["paragraph", "quote"] | None
    reason: Literal["source_blurred", "source_clipped", "source_context_insufficient"] | None
    evidence_ids: list[Id] = Field(min_length=2, max_length=2)


class SourceRoleResponse(Record):
    schema_version: Literal["ava-book-refinement-response-6"]
    task_id: Id
    source_sha256: Digest
    observation_sha256: Digest
    image_sha256: Digest
    role_decisions: list[SourceRoleDecision] = Field(min_length=1, max_length=24)
    unresolved: list[str] = Field(max_length=100)
