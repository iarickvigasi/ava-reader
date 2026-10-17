"""Selection-only frontmatter title authority; historical Title1 remains closed."""

from typing import Literal, Self

from pydantic import Field, model_validator

from ..contracts.common import Digest, Id, Record
from ..contracts.profiles import ProfileId
from ..contracts.source import Box
from .recognition_contract import RecognitionImage


class FrontmatterTitleNode(Record):
    id: Id
    page: int = Field(ge=1, le=16)
    text: str = Field(min_length=1, max_length=200)
    text_sha256: Digest
    method: Literal["native", "ocr"]
    box: Box
    page_width_pt: float = Field(gt=0, le=14400)
    page_height_pt: float = Field(gt=0, le=14400)
    render_sha256: Digest
    primary_eligible: bool


class FrontmatterTitlePage(Record):
    page: int = Field(ge=1, le=16)
    page_width_pt: float = Field(gt=0, le=14400)
    page_height_pt: float = Field(gt=0, le=14400)
    render_sha256: Digest


class FrontmatterTitleCrop(Record):
    id: Id
    part: Literal["title", "context"]
    node_id: Id | None
    page: int = Field(ge=1, le=16)
    source_box: Box
    render_sha256: Digest
    image_box: list[int] = Field(min_length=4, max_length=4)


class FrontmatterTitleTask(Record):
    schema_version: Literal["ava-printed-title-task-2"]
    task_id: Id
    source_sha256: Digest
    observation_sha256: Digest
    source_page_count: int = Field(ge=1, le=500)
    profile_id: ProfileId
    prompt_version: Literal["ava-printed-title-2"]
    response_schema_version: Literal["ava-printed-title-response-2"]
    nodes: list[FrontmatterTitleNode] = Field(min_length=1, max_length=24)
    pages: list[FrontmatterTitlePage] = Field(min_length=1, max_length=16)
    pixels_per_point: Literal[2]
    crops: list[FrontmatterTitleCrop] = Field(min_length=2, max_length=40)
    image: RecognitionImage

    @model_validator(mode="after")
    def identity(self) -> Self:
        from .printed_title_v2_identity import validate_frontmatter_title_task

        validate_frontmatter_title_task(self)
        return self


class FrontmatterCoverCorroboration(Record):
    node_ids: list[Id] = Field(min_length=1, max_length=8)
    evidence_ids: list[Id] = Field(min_length=2, max_length=9)


class FrontmatterTitleResponse(Record):
    schema_version: Literal["ava-printed-title-response-2"]
    task_id: Id
    source_sha256: Digest
    observation_sha256: Digest
    image_sha256: Digest
    selected_node_id: Id | None
    selected_text_sha256: Digest | None
    evidence_ids: list[Id] = Field(max_length=2)
    cover: FrontmatterCoverCorroboration | None

    @model_validator(mode="after")
    def selection_shape(self) -> Self:
        if (self.selected_node_id is None) != (self.selected_text_sha256 is None):
            raise ValueError("Title selection requires its unchanged text identity")
        if self.selected_node_id is None and (self.evidence_ids or self.cover is not None):
            raise ValueError("Declined title cannot authorize evidence or a cover")
        if self.selected_node_id is not None and len(self.evidence_ids) != 2:
            raise ValueError("Selected title requires its own heading and page context")
        return self
