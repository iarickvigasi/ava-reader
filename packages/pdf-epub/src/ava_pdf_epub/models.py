"""Versioned, source-linked interchange; offsets are Unicode code points, not UTF-16."""

from __future__ import annotations

import hashlib
import re
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Id = Annotated[str, Field(pattern=r"^[A-Za-z][A-Za-z0-9_.-]{0,119}$")]
Digest = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]


class Record(BaseModel):
    model_config = ConfigDict(
        extra="forbid", strict=True, validate_assignment=True, allow_inf_nan=False
    )

    @field_validator("*")
    @classmethod
    def xml_text(cls, value: object) -> object:
        if isinstance(value, str) and any(
            not (
                c in "\t\n\r"
                or 0x20 <= ord(c) <= 0xD7FF
                or 0xE000 <= ord(c) <= 0xFFFD
                or 0x10000 <= ord(c) <= 0x10FFFF
            )
            for c in value
        ):
            raise ValueError("Text contains an invalid XML character")
        return value


class Evidence(Record):
    page: int = Field(ge=1)
    method: Literal["native", "ocr", "review", "replay", "render"]
    bbox: tuple[float, float, float, float] | None = None
    coordinate_space: Literal["page_points_top_left", "normalized_top_left"] = (
        "page_points_top_left"
    )
    artifact_sha256: Digest | None = None


class Issue(Record):
    code: str
    message: str
    severity: Literal["info", "review", "error"] = "review"
    page: int | None = None
    block_id: str | None = None


class Style(Record):
    observed: list[
        Literal["family", "align", "size", "indent", "space_before", "bold", "italic", "small_caps"]
    ] = Field(default_factory=list)
    family: Literal["serif", "sans-serif", "monospace"] = "serif"
    align: Literal["left", "right", "center", "justify", "start"] = "start"
    size: float = Field(default=1.0, ge=0.5, le=3.0)
    indent: float = Field(default=0.0, ge=-3.0, le=6.0)
    space_before: float = Field(default=0.0, ge=0.0, le=5.0)
    bold: bool = False
    italic: bool = False
    small_caps: bool = False


class Span(Record):
    start: int = Field(ge=0)
    end: int = Field(gt=0)
    kind: Literal["em", "strong", "sup", "sub", "smallcaps", "link", "noteref"]
    target: str | None = None  # block ID for internal links; https/mailto for external.


class PageBreak(Record):
    page: int = Field(ge=1)
    offset: int = Field(ge=0)


class Block(Record):
    id: Id
    kind: Literal[
        "heading", "paragraph", "quote", "verse", "code", "list_item", "note", "figure", "separator"
    ]
    text: str = Field(default="", max_length=200000)
    text_sha256: Digest | None = None
    spans: list[Span] = Field(default_factory=list)
    page_breaks: list[PageBreak] = Field(default_factory=list)
    evidence: list[Evidence] = Field(min_length=1)
    style: Style = Field(default_factory=Style)
    level: int = Field(default=1, ge=1, le=6)
    label: str | None = None
    asset_id: Id | None = None
    continues_from_previous: bool = False
    continues_to_next: bool = False

    @model_validator(mode="after")
    def coherent(self) -> Self:
        actual = hashlib.sha256(self.text.encode()).hexdigest()
        if self.text_sha256 is not None and self.text_sha256 != actual:
            raise ValueError("Text changed without realigning spans")
        for span in self.spans:
            if not 0 <= span.start < span.end <= len(self.text):
                raise ValueError("Span outside canonical text")
            if (span.kind in {"link", "noteref"}) != (span.target is not None):
                raise ValueError("Only links require targets")
        if any(item.offset > len(self.text) for item in self.page_breaks):
            raise ValueError("Page break outside canonical text")
        if len({item.page for item in self.page_breaks}) != len(self.page_breaks):
            raise ValueError("Repeated page boundary in one block")
        if any(item.page not in {e.page for e in self.evidence} for item in self.page_breaks):
            raise ValueError("Page boundary must have source evidence on that page")
        links = sorted((s for s in self.spans if s.target), key=lambda s: s.start)
        if any(a.end > b.start for a, b in zip(links, links[1:], strict=False)):
            raise ValueError("Overlapping links are ambiguous")
        if self.kind == "figure" and self.asset_id is None:
            raise ValueError("Figure requires an asset")
        return self


class Page(Record):
    number: int = Field(ge=1)
    label: str | None = None
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    route: Literal["native", "ocr", "replay", "blank", "needs_ocr"]
    blocks: list[Block] = Field(default_factory=list)
    issues: list[Issue] = Field(default_factory=list)


class Chapter(Record):
    id: Id
    title: str = Field(min_length=1, max_length=1000)
    start_block_id: Id
    kind: Literal["frontmatter", "bodymatter", "backmatter"] = "bodymatter"
    parent_id: Id | None = None
    verified: bool = False


class Claim(Record):
    field: str = Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")
    value: str = Field(min_length=1, max_length=4000)
    status: Literal["accepted", "candidate", "conflict"] = "candidate"
    scope: Literal["work", "source_edition", "conversion"] = "source_edition"
    role: str | None = None
    evidence: list[Evidence] = Field(default_factory=list)


class Asset(Record):
    id: Id
    path: str  # relative to the explicitly supplied asset root; containment checked at I/O.
    sha256: Digest
    media_type: Literal["image/png", "image/jpeg"]
    width: int = Field(gt=0, le=30000)
    height: int = Field(gt=0, le=30000)
    alt: str = Field(max_length=4000)
    decorative: bool = False
    evidence: list[Evidence] = Field(min_length=1)


class Book(Record):
    schema_version: Literal["ava-book-1"] = "ava-book-1"
    source_sha256: Digest
    page_count: int = Field(ge=1, le=5000)
    pages: list[Page] = Field(min_length=1, max_length=5000)
    chapters: list[Chapter] = Field(min_length=1, max_length=10000)
    metadata: list[Claim] = Field(default_factory=list)
    assets: list[Asset] = Field(default_factory=list)
    cover_asset_id: Id | None = None
    issues: list[Issue] = Field(default_factory=list)

    @model_validator(mode="after")
    def graph(self) -> Self:
        if [p.number for p in self.pages] != list(range(1, self.page_count + 1)):
            raise ValueError("Every source page must be accounted for exactly once in order")
        blocks = [b for p in self.pages for b in p.blocks]
        ids = [b.id for b in blocks]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate block IDs")
        positions = {id_: i for i, id_ in enumerate(ids)}
        chapter_ids: set[str] = set()
        last = -1
        for chapter in self.chapters:
            pos = positions.get(chapter.start_block_id, -1)
            if pos <= last or chapter.id in chapter_ids:
                raise ValueError("Chapters require distinct ordered source block boundaries")
            if chapter.parent_id and chapter.parent_id not in chapter_ids:
                raise ValueError("Chapter parent must precede child")
            chapter_ids.add(chapter.id)
            last = pos
        asset_ids = {a.id for a in self.assets}
        if len(asset_ids) != len(self.assets):
            raise ValueError("Duplicate asset IDs")
        if self.cover_asset_id and self.cover_asset_id not in asset_ids:
            raise ValueError("Unknown cover asset")
        for block in blocks:
            if block.asset_id and block.asset_id not in asset_ids:
                raise ValueError("Unknown figure asset")
            if any(e.page > self.page_count for e in block.evidence):
                raise ValueError("Evidence outside source")
            if any(item.page > self.page_count for item in block.page_breaks):
                raise ValueError("Page break outside source")
            if any(ord(c) < 32 and c not in "\t\n\r" for c in block.text):
                raise ValueError("Invalid XML character in source text")
        evidence = [e for block in blocks for e in block.evidence]
        evidence += [e for asset in self.assets for e in asset.evidence]
        evidence += [e for claim in self.metadata for e in claim.evidence]
        for item in evidence:
            if item.page > self.page_count:
                raise ValueError("Evidence outside source")
            if item.bbox:
                x0, y0, x1, y1 = item.bbox
                page = self.pages[item.page - 1]
                width, height = (
                    (1.0, 1.0)
                    if item.coordinate_space == "normalized_top_left"
                    else (page.width, page.height)
                )
                if not (0 <= x0 < x1 <= width and 0 <= y0 < y1 <= height):
                    raise ValueError("Evidence rectangle outside declared coordinate space")
        breaks = [item.page for block in blocks for item in block.page_breaks]
        if len(breaks) != len(set(breaks)):
            raise ValueError("Multiple inline boundaries for one source page")
        for claim in self.metadata:
            if claim.field == "language" and not re.fullmatch(
                r"[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*", claim.value
            ):
                raise ValueError("Language must be a BCP47-style tag")
        return self
