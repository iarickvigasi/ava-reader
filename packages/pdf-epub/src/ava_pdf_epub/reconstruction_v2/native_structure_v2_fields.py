"""Closed role variants prohibit irrelevant decisions before source validation."""

from typing import Literal

from pydantic import Field

from ..contracts.common import Id, Record


class NativeStructureGroup2Base(Record):
    id: Id
    region_id: Id
    line_ids: list[Id] = Field(min_length=1, max_length=10000)


class NativeChapterGroup2(NativeStructureGroup2Base):
    kind: Literal["heading"]
    heading_role: Literal["chapter"]
    chapter_role: Literal["frontmatter", "bodymatter", "backmatter"]


class NativeSectionGroup2(NativeStructureGroup2Base):
    kind: Literal["heading"]
    heading_role: Literal["section"]
    heading_level: int = Field(ge=1, le=6)


class NativeParagraphGroup2(NativeStructureGroup2Base):
    kind: Literal["paragraph"]
    continues_from_previous: bool
    continues_to_next: bool


class NativeNoteGroup2(NativeStructureGroup2Base):
    kind: Literal["note"]
    note_label: str = Field(min_length=1, max_length=100)
    note_role: Literal["footnote", "endnote"]


class NativeOrderedListGroup2(NativeStructureGroup2Base):
    kind: Literal["list_item"]
    list_role: Literal["ordered"]
    list_start: int = Field(ge=0, le=1000000)
    list_depth: int = Field(ge=1, le=3)


class NativeUnorderedListGroup2(NativeStructureGroup2Base):
    kind: Literal["list_item"]
    list_role: Literal["unordered"]
    list_depth: int = Field(ge=1, le=3)


class NativeRelatedGroup2(NativeStructureGroup2Base):
    kind: Literal["caption", "credit"]
    related_to: Id | None


class NativePlainGroup2(NativeStructureGroup2Base):
    kind: Literal["quote", "aside", "verse", "code", "separator", "furniture"]


NativeStructureGroup2 = (
    NativeChapterGroup2
    | NativeSectionGroup2
    | NativeParagraphGroup2
    | NativeNoteGroup2
    | NativeOrderedListGroup2
    | NativeUnorderedListGroup2
    | NativeRelatedGroup2
    | NativePlainGroup2
)
