"""Captured continuation presentation never widens historical input/batch unions."""

from typing import Literal

from pydantic import Field

from .continuation_presentation_contract import (
    PresentationRefinementResponse,
    PresentationRefinementTask,
)
from .protocol_cell_geometry import CellGeometryReconstructionInput
from .protocol_frontmatter_title import (
    FrontmatterRefinementResponse,
    FrontmatterRefinementTask,
    FrontmatterTitleRefinementBatch,
)


class ContinuationReconstructionInput(CellGeometryReconstructionInput):
    schema_version: Literal["ava-reconstruct-input-10"]  # type: ignore[assignment]
    source_continuation_policy: Literal["ava-source-continuation-presentation-1"]
    refinements: list[FrontmatterRefinementResponse | PresentationRefinementResponse] = Field(
        default_factory=list, max_length=32
    )  # type: ignore[assignment]


class ContinuationRefinementBatch(FrontmatterTitleRefinementBatch):
    schema_version: Literal["ava-book-refinement-batch-4"]  # type: ignore[assignment]
    source_continuation_policy: Literal["ava-source-continuation-presentation-1"]
    tasks: list[FrontmatterRefinementTask | PresentationRefinementTask] = Field(max_length=32)
