"""Selected profile representation, not a claim the worker/reader implements it."""

from typing import Literal, Self

from pydantic import Field, model_validator

from .blocks import Block
from .common import Id, Record
from .links import Address
from .metadata import MetadataClaim
from .profiles import ProfileId
from .resources import ImageResource
from .source import SourcePage, SourcePdf
from .structure import Chapter, ListGroup, TocEntry
from .styles import Style


class CanonicalBookV2(Record):
    schema_version: Literal["ava-book-2"]
    profile_id: ProfileId
    document_id: Id
    source: SourcePdf
    pages: list[SourcePage] = Field(min_length=1, max_length=500)
    chapters: list[Chapter] = Field(min_length=1, max_length=20000)
    spine: list[Id] = Field(min_length=1, max_length=20000)
    blocks: list[Block] = Field(min_length=1, max_length=20000)
    toc: list[TocEntry] = Field(min_length=1, max_length=20000)
    styles: list[Style] = Field(max_length=5000)
    resources: list[ImageResource] = Field(max_length=1000)
    lists: list[ListGroup] = Field(max_length=10000)
    addresses: list[Address] = Field(min_length=1, max_length=100000)
    metadata: list[MetadataClaim] = Field(max_length=1000)
    cover_resource_id: Id | None = None

    @model_validator(mode="after")
    def complete_graph(self) -> Self:
        from .graph import validate_book

        validate_book(self)
        return self
