"""Logical chapter, contents, and list structure independent of source pages."""

from typing import Literal, Self

from pydantic import Field, model_validator

from .common import Id, Record, RelativePath
from .links import InternalTarget


class Chapter(Record):
    id: Id
    title: str = Field(min_length=1, max_length=1000)
    resource_paths: list[RelativePath] = Field(min_length=1, max_length=128)
    role: Literal["frontmatter", "bodymatter", "backmatter"]
    block_ids: list[Id] = Field(min_length=1, max_length=20000)


class TocEntry(Record):
    id: Id
    label: str = Field(min_length=1, max_length=1000)
    parent_id: Id | None = None
    target: InternalTarget


class ListGroup(Record):
    id: Id
    ordered: bool
    # Omit an absent extension from the model dump so existing ava-json-v1
    # content hashes remain valid. Explicit markers participate in the hash.
    marker_style: (
        Literal["decimal", "lower-alpha", "upper-alpha", "lower-roman", "upper-roman", "bullet"]
        | None
    ) = Field(default=None, exclude_if=lambda value: value is None)
    start: int | None = Field(default=None, ge=0, le=1000000)
    depth: int = Field(ge=1, le=3)
    parent_item_id: Id | None = None
    item_ids: list[Id] = Field(min_length=1, max_length=20000)

    @model_validator(mode="after")
    def marker_matches_order(self) -> Self:
        if self.marker_style is not None and (self.marker_style == "bullet") == self.ordered:
            raise ValueError("List marker must match ordered or unordered semantics")
        return self
