"""Discriminated content nodes. The existing ava-book-1 CLI remains separate."""

from typing import Annotated, Literal

from pydantic import Field

from .common import Id, Record
from .inline_text import TextValue
from .source import Evidence


class BlockBase(Record):
    id: Id
    style_id: Id | None = None
    evidence: list[Evidence] = Field(min_length=1, max_length=500)


class ProseBlock(BlockBase):
    kind: Literal["paragraph", "quote", "aside", "caption", "credit", "verse", "code"]
    content: TextValue


class HeadingBlock(BlockBase):
    kind: Literal["heading"]
    level: int = Field(ge=1, le=6)
    content: TextValue


class NoteBlock(BlockBase):
    kind: Literal["note"]
    note_role: Literal["footnote", "endnote"]
    label: str = Field(min_length=1, max_length=100)
    content: TextValue
    callout_ids: list[Id] = Field(min_length=1, max_length=20000)


class ListItemBlock(BlockBase):
    kind: Literal["list_item"]
    list_id: Id
    content: TextValue


class FigureBlock(BlockBase):
    kind: Literal["figure"]
    resource_id: Id
    caption_id: Id | None = None
    credit_id: Id | None = None
    alt: str = Field(max_length=4000)
    decorative: bool


class SeparatorBlock(BlockBase):
    kind: Literal["separator"]


class TableCell(BlockBase):
    row_span: int = Field(default=1, ge=1, le=20, exclude_if=lambda value: value == 1)
    column_span: int = Field(default=1, ge=1, le=8, exclude_if=lambda value: value == 1)
    row: int = Field(ge=0, le=19)
    column: int = Field(ge=0, le=7)
    header_axis: Literal["row", "column", "both"] | None = None
    header_ids: list[Id] = Field(default_factory=list, max_length=28)
    content: TextValue


class TableBlock(BlockBase):
    kind: Literal["table"]
    row_count: int = Field(ge=1, le=20)
    column_count: int = Field(ge=1, le=8)
    cells: list[TableCell] = Field(min_length=1, max_length=160)
    caption_id: Id | None = None


Block = Annotated[
    ProseBlock
    | HeadingBlock
    | NoteBlock
    | ListItemBlock
    | FigureBlock
    | SeparatorBlock
    | TableBlock,
    Field(discriminator="kind"),
]
