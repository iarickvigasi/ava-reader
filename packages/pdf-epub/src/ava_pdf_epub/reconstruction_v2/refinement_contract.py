"""Structure-only decisions bind immutable observations and source crop identities."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Id, Record
from ..contracts.source import Box
from ..contracts.styles import Style
from .recognition_contract import RecognitionImage


class RefinementNode(Record):
    id: Id
    page: int = Field(ge=1, le=500)
    kind: Literal["heading", "paragraph"]
    text_sha256: Digest
    text_excerpt: str = Field(max_length=500)
    observed_level: int | None = Field(ge=1, le=6)
    observed_chapter: bool
    observed_role: Literal["frontmatter", "bodymatter", "backmatter"] | None
    observed_style: Style | None
    ranked_source: bool
    body_reference_id: Id | None


class RefinementCrop(Record):
    id: Id
    part: Literal["head", "tail"]
    node_id: Id
    page: int = Field(ge=1, le=500)
    source_box: Box
    render_sha256: Digest
    image_box: list[int] = Field(min_length=4, max_length=4)


class RefinementEdge(Record):
    id: Id
    previous_id: Id
    next_id: Id


class BookRefinementTask(Record):
    schema_version: Literal["ava-book-refinement-task-1"]
    task_id: Id
    source_sha256: Digest
    observation_sha256: Digest
    profile_id: Literal["ava-pdf-prose-en-v2"]
    prompt_version: Literal["ava-book-refinement-1"]
    response_schema_version: Literal["ava-book-refinement-response-1"]
    nodes: list[RefinementNode] = Field(min_length=1, max_length=256)
    pixels_per_point: Literal[2]
    decision_ids: list[Id] = Field(min_length=1, max_length=24)
    edges: list[RefinementEdge] = Field(max_length=16)
    crops: list[RefinementCrop] = Field(min_length=1, max_length=48)
    image: RecognitionImage

    @model_validator(mode="after")
    def identity(self) -> "BookRefinementTask":
        from .refinement_identity import validate_refinement_task

        validate_refinement_task(self)
        return self


class RefinementBatch(Record):
    schema_version: Literal["ava-book-refinement-batch-1"]
    source_sha256: Digest
    tasks: list[BookRefinementTask] = Field(max_length=32)


class RefinementStyle(Style):
    """Sparse source typography with the wire observations required by acceptance."""

    id: Literal["observed"]
    relative_size: float = Field(ge=0.5, le=3)
    bold: bool = Field()


class RefinementDecision(Record):
    node_id: Id
    text_sha256: Digest
    evidence_ids: list[Id] = Field(min_length=1, max_length=48)
    heading_level: int | None = Field(ge=1, le=6)
    parent_id: Id | None
    chapter_start: bool | None
    chapter_role: Literal["frontmatter", "bodymatter", "backmatter"] | None
    style: RefinementStyle


class RefinementJoin(Record):
    edge_id: Id
    join: bool
    evidence_ids: list[Id] = Field(min_length=2, max_length=48)


class BookRefinementResponse(Record):
    schema_version: Literal["ava-book-refinement-response-1"]
    task_id: Id
    source_sha256: Digest
    observation_sha256: Digest
    image_sha256: Digest
    decisions: list[RefinementDecision] = Field(min_length=1, max_length=24)
    joins: list[RefinementJoin] = Field(max_length=16)
    unresolved: list[str] = Field(max_length=100)
