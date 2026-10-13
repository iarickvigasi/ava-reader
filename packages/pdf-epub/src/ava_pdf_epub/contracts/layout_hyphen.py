"""Explicit source-bound decisions; physical line position never authorizes deletion."""

from typing import Literal

from pydantic import Field, model_validator

from .common import Digest, Id, Record, document_digest
from .source import Box


class LayoutHyphenLine(Record):
    line_id: Id
    method: Literal["native", "ocr"]
    page: int = Field(ge=1, le=500)
    region_id: Id
    box: Box
    source_start: int = Field(ge=0, le=200000)
    source_end: int = Field(gt=0, le=200000)

    @model_validator(mode="after")
    def exact_frame(self) -> "LayoutHyphenLine":
        if self.source_start >= self.source_end:
            raise ValueError("Layout-hyphen line requires an ordered source range")
        if self.box.coordinate_space != "page_points_top_left":
            raise ValueError("Layout-hyphen line requires source-page geometry")
        return self


class LayoutHyphenCandidate(Record):
    schema_version: Literal["ava-layout-hyphen-candidate-1"]
    id: Id
    source_sha256: Digest
    source_text_sha256: Digest
    source_start: int = Field(ge=0, le=200000)
    source_end: int = Field(gt=0, le=200000)
    left: LayoutHyphenLine
    right: LayoutHyphenLine
    role: Literal["paragraph", "note", "list_item"]
    boundary: Literal["line", "column", "page"]
    preserve_line_breaks: Literal[False]
    consecutive: Literal[True]

    @model_validator(mode="after")
    def source_order(self) -> "LayoutHyphenCandidate":
        if not (
            self.left.source_start
            <= self.source_start
            < self.left.source_end
            <= self.right.source_start
            <= self.source_end
            < self.right.source_end
        ):
            raise ValueError("Layout-hyphen boundary is outside its ordered source lines")
        if self.left.line_id == self.right.line_id:
            raise ValueError("Layout-hyphen boundary requires distinct source lines")
        left, right = self.left, self.right
        if self.boundary == "page":
            if right.page != left.page + 1:
                raise ValueError("Layout-hyphen page continuation is not consecutive")
        elif left.page != right.page:
            raise ValueError("Layout-hyphen line/column boundary changes source page")
        elif self.boundary == "line":
            if left.region_id != right.region_id or left.box.y0 >= right.box.y0:
                raise ValueError("Layout-hyphen line continuation changes reading region/order")
        elif left.region_id == right.region_id or left.box.x0 >= right.box.x0:
            raise ValueError("Layout-hyphen column continuation changes reading region/order")
        return self


class LayoutHyphenDisposition(Record):
    candidate_id: Id
    candidate_sha256: Digest
    disposition: Literal["layout", "literal", "unresolved"]


def candidate_digest(candidate: LayoutHyphenCandidate) -> str:
    return document_digest(LayoutHyphenCandidate.model_validate(candidate.model_dump()))
