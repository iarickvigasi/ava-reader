"""Source-owned native ranges; provider groups cannot supply replacement content."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Id, Record, text_digest
from ..contracts.source import Box, SourceRegion
from ..contracts.styles import Style
from .segments import ObservedSpan


class NativeStructureSpan(ObservedSpan):
    id: Id


class NativeStructureLine(Record):
    id: Id
    text: str = Field(max_length=200000)
    text_sha256: Digest
    box: Box
    style: Style
    spans: list[NativeStructureSpan] = Field(max_length=20000)

    @model_validator(mode="after")
    def exact_source(self) -> "NativeStructureLine":
        from .segment_checks import validate_spans

        if text_digest(self.text) != self.text_sha256:
            raise ValueError("Native structure source line digest differs")
        spans: list[ObservedSpan] = list(self.spans)
        validate_spans(self.text, spans)
        return self


class NativeStructureRegion(Record):
    source: SourceRegion
    line_ids: list[Id] = Field(max_length=10000)
    artifact_id: Id | None = None

    @model_validator(mode="after")
    def source_authority(self) -> "NativeStructureRegion":
        if self.source.route not in {"native", "render"} or self.source.role not in {
            "content",
            "furniture",
        }:
            raise ValueError("Native structure region has no qualified source authority")
        if self.artifact_id is None and (not self.line_ids or self.source.route != "native"):
            raise ValueError("Native structure text region requires native source lines")
        return self


class NativeStructureArtifact(Record):
    id: Id
    kind: Literal["figure", "table", "aside"]
    segment_sha256: Digest


class NativeStructureBoundary(Record):
    candidate_id: Id
    candidate_sha256: Digest
    left_line_id: Id
    right_line_id: Id
    role: Literal["paragraph", "note", "list_item"]
    boundary: Literal["line", "column", "page"]


class NativeStructureCallout(Record):
    span_id: Id
    line_id: Id
    exact_text: str = Field(min_length=1, max_length=20)
    box: Box


class NativeStructureReference(Record):
    span_id: Id
    role: Literal["note_callout"]


class NativeStructureGroup(Record):
    id: Id
    region_id: Id
    line_ids: list[Id] = Field(min_length=1, max_length=10000)
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
        "separator",
        "furniture",
    ]
    heading_level: int | None = Field(default=None, ge=1, le=6)
    chapter_start: bool = False
    chapter_role: Literal["frontmatter", "bodymatter", "backmatter"] | None = None
    note_label: str | None = Field(default=None, min_length=1, max_length=100)
    note_role: Literal["footnote", "endnote"] | None = None
    list_ordered: bool | None = None
    list_start: int | None = Field(default=None, ge=0, le=1000000)
    list_depth: int | None = Field(default=None, ge=1, le=3)
    continues_from_previous: bool = False
    continues_to_next: bool = False
    related_to: Id | None = None

    @model_validator(mode="after")
    def role_fields(self) -> "NativeStructureGroup":
        if self.kind == "heading":
            if self.heading_level is None or (
                self.chapter_start and (self.heading_level != 1 or self.chapter_role is None)
            ):
                raise ValueError("Native structure heading decision is incomplete")
            if not self.chapter_start and self.chapter_role is not None:
                raise ValueError("Native structure section cannot set a chapter role")
        elif self.heading_level is not None or self.chapter_start or self.chapter_role is not None:
            raise ValueError("Native structure chapter fields require a heading")
        if (self.kind == "note") != (self.note_label is not None and self.note_role is not None):
            raise ValueError("Native structure note needs its printed label and role")
        if self.kind != "note" and (self.note_label is not None or self.note_role is not None):
            raise ValueError("Native structure note fields require a note")
        if self.kind == "list_item":
            if self.list_ordered is None or self.list_depth is None:
                raise ValueError("Native structure list decision is incomplete")
        elif any(v is not None for v in (self.list_ordered, self.list_start, self.list_depth)):
            raise ValueError("Native structure list fields require a list item")
        if self.related_to is not None and self.kind not in {"caption", "credit"}:
            raise ValueError("Native structure relationship requires a caption or credit")
        if self.kind != "paragraph" and (self.continues_from_previous or self.continues_to_next):
            raise ValueError("Native structure continuation requires ordinary prose")
        return self
