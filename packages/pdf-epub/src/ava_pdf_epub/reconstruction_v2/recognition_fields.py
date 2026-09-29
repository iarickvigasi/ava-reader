"""Explicit provider observations with sparse source-style exceptions."""

from typing import Literal, Self

from pydantic import Field, model_validator

from ..contracts.common import Record
from ..contracts.styles import Style


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
    start: int = Field(ge=0, le=200000)
    end: int = Field(gt=0, le=200000)
    style: Style | None
    note_label: str | None = Field(max_length=100)
    target_text: str | None = Field(max_length=1000)
    url: str | None = Field(max_length=2048)


class RecognitionCell(Record):
    text: str = Field(max_length=200000)
    box: RecognitionBox
    style: Style | None
    header_axis: Literal["row", "column", "both"] | None
    spans: list[RecognitionSpan] = Field(max_length=20000)
