"""Explicit provider observations with sparse source-style exceptions."""

from typing import Literal, Self

from pydantic import Field, field_validator, model_validator

from ..contracts.common import Record
from ..contracts.styles import Style
from .recognition_anchors import RecognitionTextAnchor, anchored_offsets


class RecognitionBox(Record):
    coordinate_space: Literal["render_normalized_1000"]
    x0: float = Field(ge=0, lt=1000)
    y0: float = Field(ge=0, lt=1000)
    x1: float = Field(gt=0, le=1000)
    y1: float = Field(gt=0, le=1000)

    @model_validator(mode="after")
    def ordered(self) -> Self:
        if self.x0 >= self.x1 or self.y0 >= self.y1:
            raise ValueError("Empty or reversed recognition box")
        return self


class RecognitionSpan(Record):
    start: int | None = Field(default=None, ge=0, le=200000, exclude_if=lambda v: v is None)
    end: int | None = Field(default=None, gt=0, le=200000, exclude_if=lambda v: v is None)
    anchor: RecognitionTextAnchor | None = Field(default=None, exclude_if=lambda v: v is None)
    style: Style | None
    note_label: str | None = Field(max_length=100)
    target_text: str | None = Field(max_length=1000)
    url: str | None = Field(max_length=2048)

    @model_validator(mode="after")
    def exact_offset_authority(self) -> Self:
        if self.anchor is not None:
            if self.start is not None or self.end is not None:
                raise ValueError("Inline anchor cannot also supply numeric offsets")
        elif self.start is None or self.end is None or self.start >= self.end:
            raise ValueError("Inline span requires ordered offsets or an exact anchor")
        return self

    def offsets(self, text: str) -> tuple[int, int]:
        if self.anchor is not None:
            return anchored_offsets(text, self.anchor)
        if self.start is None or self.end is None or not 0 <= self.start < self.end <= len(text):
            raise ValueError("Inline span outside exact text")
        return self.start, self.end

    @field_validator("url")
    @classmethod
    def printed_web_address(cls, value: str | None) -> str | None:
        # Reuse PDF annotation policy for the same printed bare web address.
        # Display text and offsets stay unchanged; no arbitrary scheme inference.
        if value is not None and value.startswith("www."):
            from ..pdf_navigation import navigation_uri

            return navigation_uri(value).url
        return value


class RecognitionCell(Record):
    row_span: int = Field(default=1, ge=1, le=20, exclude_if=lambda value: value == 1)
    column_span: int = Field(default=1, ge=1, le=8, exclude_if=lambda value: value == 1)
    text: str = Field(max_length=200000)
    box: RecognitionBox | None
    source_cell_id: str | None = Field(
        default=None, min_length=1, max_length=120, exclude_if=lambda value: value is None
    )
    style: Style | None
    header_axis: Literal["row", "column", "both"] | None
    spans: list[RecognitionSpan] = Field(max_length=20000)

    @model_validator(mode="after")
    def exact_geometry_authority(self) -> Self:
        if (self.box is None) == (self.source_cell_id is None):
            raise ValueError("Cell requires exactly one geometry authority")
        for span in self.spans:
            span.offsets(self.text)
        return self
