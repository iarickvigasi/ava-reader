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
        from .layout_hyphen_order import validate_hyphen_order

        validate_hyphen_order(
            self.left, self.right, self.source_start, self.source_end, self.boundary
        )
        return self


class LayoutHyphenDisposition(Record):
    candidate_id: Id
    candidate_sha256: Digest
    disposition: Literal["layout", "literal", "unresolved"]


def candidate_digest(candidate: LayoutHyphenCandidate) -> str:
    return document_digest(LayoutHyphenCandidate.model_validate(candidate.model_dump()))
