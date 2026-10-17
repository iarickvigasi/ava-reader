"""Provider wire fields are explicit; native extraction keeps its separate internal defaults."""

from typing import Any, Literal, Self

from pydantic import ConfigDict, Field, model_validator

from ..contracts.common import Record
from ..contracts.source import Box
from ..contracts.styles import Style
from .recognition_coordinates import source_segment
from .recognition_fields import RecognitionBox, RecognitionCell, RecognitionSpan
from .recognition_requirements import require_kind_fields
from .recognition_shape import segment_shape


class RecognitionSegment(Record):
    model_config = ConfigDict(json_schema_extra=segment_shape)

    id: str = Field(
        min_length=1, max_length=120, description="Unique within this response; s0001, s0002, ..."
    )
    page: int = Field(ge=1, le=500)
    box: RecognitionBox
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
    text: str = Field(
        max_length=200000,
        description="Finalize this segment's exact source transcription before quoting any span. "
        "Characters and placement are separate: ordinary raised/lowered digits use ordinary text "
        "plus vertical_align; intrinsic Unicode stays exact. "
        "Every anchor/context quotes this text.",
    )
    style: Style | None
    spans: list[RecognitionSpan] = Field(max_length=20000)
    method: Literal["ocr"]
    heading_level: int | None = Field(default=None, ge=1, le=6)
    chapter_start: bool = False
    chapter_role: Literal["frontmatter", "bodymatter", "backmatter"] | None = None
    note_label: str | None = Field(default=None, max_length=100)
    note_role: Literal["footnote", "endnote"] | None = None
    list_ordered: bool | None = None
    list_start: int | None = Field(default=None, ge=0, le=1000000)
    list_depth: int | None = Field(default=None, ge=1, le=3)
    continues_from_previous: bool
    continues_to_next: bool
    cells: list[list[RecognitionCell]] = Field(default_factory=list, max_length=20)
    related_to: str | None = Field(default=None, max_length=120)
    alt: str = Field(default="", max_length=4000)

    @model_validator(mode="before")
    @classmethod
    def explicit_kind_fields(cls, value: Any) -> Any:
        from .literal_url_anchor import anchor_literal_url

        return require_kind_fields(anchor_literal_url(value))

    @model_validator(mode="after")
    def semantic_shape(self) -> Self:
        # Pinned physical cells can only be resolved against the exact task.
        # Full observed-grid and geometry validation remains mandatory in acceptance.
        if not any(cell.source_cell_id for row in self.cells for cell in row):
            source_segment(
                self, Box(coordinate_space="page_points_top_left", x0=0, y0=0, x1=1000, y1=1000)
            )
        if self.kind == "note" and self.note_role is None:
            raise ValueError("Note requires its observed role")
        if self.kind == "list_item" and self.list_depth is None:
            raise ValueError("List item requires observed depth")
        if self.chapter_start and self.chapter_role is None:
            raise ValueError("Chapter start requires its observed role")
        if self.chapter_start and self.heading_level != 1:
            raise ValueError("Chapter start requires heading level one")
        if self.list_ordered and (self.kind != "list_item" or self.list_start is None):
            raise ValueError("Ordered list requires its observed start")
        return self
