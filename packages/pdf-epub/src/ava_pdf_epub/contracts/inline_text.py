"""Hash and ranges refer to the exact text stored here, with no implicit trimming."""

from typing import Self

from pydantic import Field, model_validator

from .common import Digest, Id, Record, text_digest, unique
from .links import LinkTarget
from .normalization import NormalizationMap
from .offsets import codepoint_to_utf16


class InlineSpan(Record):
    id: Id
    start: int = Field(ge=0, le=200000)
    end: int = Field(gt=0, le=200000)
    style_id: Id | None = None
    link: LinkTarget | None = None


class TextValue(Record):
    text: str = Field(max_length=200000)
    sha256: Digest
    spans: list[InlineSpan] = Field(default_factory=list, max_length=20000)
    normalization: NormalizationMap | None = None
    codepoint_utf16: list[int] = Field(min_length=1, max_length=200001)

    @model_validator(mode="after")
    def exact_ranges(self) -> Self:
        if text_digest(self.text) != self.sha256:
            raise ValueError("Canonical text digest mismatch")
        if self.codepoint_utf16 != codepoint_to_utf16(self.text):
            raise ValueError("Codepoint/UTF-16 boundaries do not match exact text")
        unique([s.id for s in self.spans], "inline identity")
        for span in self.spans:
            if not 0 <= span.start < span.end <= len(self.text):
                raise ValueError("Inline range outside canonical text")
            if span.style_id is None and span.link is None:
                raise ValueError("Inline span must have a style or link")
        links = sorted((s for s in self.spans if s.link), key=lambda s: s.start)
        if any(a.end > b.start for a, b in zip(links, links[1:], strict=False)):
            raise ValueError("Overlapping links are ambiguous")
        if self.normalization:
            self.normalization.validate_canonical(self.text)
        return self
