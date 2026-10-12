"""Observed structure is not canonical content until cross-page conservation and graph checks."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Record
from ..contracts.source import Box, Evidence
from ..contracts.styles import Style
from .embedded_image import EmbeddedImage


class ObservedSpan(Record):
    start: int = Field(ge=0, le=200000)
    end: int = Field(gt=0, le=200000)
    style: Style | None = None
    note_label: str | None = Field(default=None, max_length=100)
    target_text: str | None = Field(default=None, max_length=1000)
    url: str | None = Field(default=None, max_length=2048)


class ObservedCell(Record):
    row_span: int = Field(default=1, ge=1, le=20, exclude_if=lambda value: value == 1)
    column_span: int = Field(default=1, ge=1, le=8, exclude_if=lambda value: value == 1)
    text: str = Field(max_length=200000)
    box: Box
    style: Style | None = None
    header_axis: Literal["row", "column", "both"] | None = None
    spans: list[ObservedSpan] = Field(default_factory=list, max_length=20000)


class Segment(Record):
    id: str = Field(min_length=1, max_length=120)
    page: int = Field(ge=1, le=500)
    box: Box
    kind: Literal[
        "paragraph",
        "heading",
        "quote",
        "aside",
        "caption",
        "credit",
        "verse",
        "code",
        "list_item",
        "note",
        "figure",
        "table",
        "separator",
        "furniture",
        "unsupported",
    ]
    text: str = Field(default="", max_length=200000)
    source_text: str | None = Field(default=None, max_length=200000)
    style: Style | None = None
    spans: list[ObservedSpan] = Field(default_factory=list, max_length=20000)
    native_line_ids: list[str] = Field(default_factory=list, max_length=10000)
    method: Literal["native", "ocr", "render"]
    preserve_line_breaks: bool = Field(default=False, exclude_if=lambda value: not value)
    structure_candidate: bool = False
    heading_level: int | None = Field(default=None, ge=1, le=6)
    chapter_start: bool = False
    chapter_role: Literal["frontmatter", "bodymatter", "backmatter"] | None = None
    note_label: str | None = Field(default=None, max_length=100)
    note_role: Literal["footnote", "endnote"] | None = None
    list_ordered: bool | None = None
    list_start: int | None = Field(default=None, ge=0, le=1000000)
    list_depth: int | None = Field(default=None, ge=1, le=3)
    continues_from_previous: bool = False
    continues_to_next: bool = False
    cells: list[list[ObservedCell]] = Field(default_factory=list, max_length=20)
    related_to: str | None = Field(default=None, max_length=120)
    alt: str = Field(default="", max_length=4000)
    source_image: EmbeddedImage | None = Field(default=None, exclude_if=lambda v: v is None)
    source_image_occurrences: list[Evidence] = Field(
        default_factory=list, max_length=500, exclude_if=lambda v: not v
    )
    source_marginal_furniture: bool = Field(default=False, exclude_if=lambda v: not v)
    decorative: bool = Field(default=False, exclude_if=lambda v: not v)

    @model_validator(mode="after")
    def source_shape(self) -> "Segment":
        from .segment_checks import validate_segment

        validate_segment(self)
        if self.source_image is not None and (
            self.kind != "figure" or not self.source_image.qualified
        ):
            raise ValueError("Qualified source image must belong to a figure")
        if self.source_image_occurrences and self.source_image is None:
            raise ValueError("Image occurrence evidence requires a qualified source image")
        if self.source_marginal_furniture and (self.source_image is None or not self.decorative):
            raise ValueError("Source marginal furniture requires a qualified decorative image")
        return self
