"""Opt-in complete-title authority; all historical refinement inputs remain closed."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Record
from .printed_title_v2_contract import FrontmatterTitleResponse, FrontmatterTitleTask
from .protocol_recognition_geometry import RecognitionGeometryReconstructionInput
from .refinement_contract import HistoricalRefinementResponse, HistoricalRefinementTask

FrontmatterRefinementTask = HistoricalRefinementTask | FrontmatterTitleTask
FrontmatterRefinementResponse = HistoricalRefinementResponse | FrontmatterTitleResponse


class FrontmatterTitleRefinementBatch(Record):
    schema_version: Literal["ava-book-refinement-batch-3"]
    source_sha256: Digest
    source_title_policy: Literal["ava-frontmatter-title-1"]
    tasks: list[FrontmatterRefinementTask] = Field(max_length=32)

    @model_validator(mode="after")
    def title_authority(self) -> "FrontmatterTitleRefinementBatch":
        if sum(isinstance(task, FrontmatterTitleTask) for task in self.tasks) > 1:
            raise ValueError("Complete-title batch permits at most one title task")
        return self


class FrontmatterTitleReconstructionInput(RecognitionGeometryReconstructionInput):
    schema_version: Literal["ava-reconstruct-input-7"]  # type: ignore[assignment]
    source_title_policy: Literal["ava-frontmatter-title-1"]
    refinements: list[FrontmatterRefinementResponse] = Field(  # type: ignore[assignment]
        default_factory=list, max_length=32
    )

    @model_validator(mode="after")
    def complete_title_authority(self) -> "FrontmatterTitleReconstructionInput":
        if sum(isinstance(response, FrontmatterTitleResponse) for response in self.refinements) > 1:
            raise ValueError("Complete-title input permits at most one title receipt")
        return self
