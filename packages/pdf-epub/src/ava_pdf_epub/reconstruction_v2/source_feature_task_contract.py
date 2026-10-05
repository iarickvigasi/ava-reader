"""A distinct task/response4 authority cannot reinterpret historical structure decisions."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Id, Record
from ..contracts.profiles import ProfileId
from ..contracts.source import Box
from ..contracts.styles import Style
from .legacy_refinement_contract import RefinementEdge
from .recognition_contract import RecognitionImage
from .source_feature_contract import SourceFeatureDecision, SourceFeatureRequest


class SourceFeatureNode(Record):
    id: Id
    page: int = Field(ge=1, le=500)
    kind: Literal["heading", "paragraph", "quote"]
    structure_candidate: Literal[False] = False
    candidate_original_kind: None = None
    observation_method: Literal["native", "ocr", "render"]
    source_box: Box
    text_length: int = Field(ge=0, le=200000)
    text_sha256: Digest
    text_excerpt: str = Field(max_length=500)
    observed_level: int | None = Field(ge=1, le=6)
    observed_chapter: bool
    observed_role: Literal["frontmatter", "bodymatter", "backmatter"] | None
    observed_style: Style | None
    ranked_source: Literal[True] = True
    body_reference_id: Id | None


class SourceFeatureCrop(Record):
    id: Id
    part: Literal["context"]
    request_node_id: Id
    node_id: Id
    page: int = Field(ge=1, le=500)
    source_box: Box
    render_sha256: Digest
    image_box: list[int] = Field(min_length=4, max_length=4)


class SourceFeatureTask(Record):
    schema_version: Literal["ava-book-refinement-task-4"]
    task_id: Id
    source_sha256: Digest
    observation_sha256: Digest
    profile_id: ProfileId
    prompt_version: Literal["ava-book-refinement-7"]
    response_schema_version: Literal["ava-book-refinement-response-4"]
    nodes: list[SourceFeatureNode] = Field(min_length=1, max_length=256)
    source_features: list[SourceFeatureRequest] = Field(min_length=1, max_length=24)
    pixels_per_point: Literal[2]
    decision_ids: list[Id] = Field(max_length=0)
    metadata_ids: list[Id] = Field(default_factory=list, max_length=0, exclude_if=lambda v: not v)
    edges: list[RefinementEdge] = Field(max_length=0)
    crops: list[SourceFeatureCrop] = Field(min_length=1, max_length=48)
    image: RecognitionImage

    @model_validator(mode="after")
    def identity(self) -> "SourceFeatureTask":
        from .refinement_identity import validate_refinement_task

        validate_refinement_task(self)
        return self


class SourceFeatureResponse(Record):
    schema_version: Literal["ava-book-refinement-response-4"]
    task_id: Id
    source_sha256: Digest
    observation_sha256: Digest
    image_sha256: Digest
    decisions: list[None] = Field(max_length=0)
    joins: list[None] = Field(max_length=0)
    metadata_decisions: list[None] = Field(
        default_factory=list, max_length=0, exclude_if=lambda v: not v
    )
    feature_decisions: list[SourceFeatureDecision] = Field(min_length=1, max_length=24)
    unresolved: list[str] = Field(max_length=100)
