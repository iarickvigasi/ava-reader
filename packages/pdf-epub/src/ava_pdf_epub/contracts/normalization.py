"""Explicit source-to-canonical transformations with no guessed offset alignment."""

import re
import unicodedata
from typing import Literal, Self

from pydantic import Field, model_validator

from .common import Digest, Record, text_digest

LIGATURES = str.maketrans(
    {"ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st"}
)


class NormalizationSegment(Record):
    source_start: int = Field(ge=0, le=200000)
    source_end: int = Field(ge=0, le=200000)
    canonical_start: int = Field(ge=0, le=200000)
    canonical_end: int = Field(ge=0, le=200000)
    kind: Literal["identity", "nfc", "ligature", "line_wrap"]


class NormalizationMap(Record):
    source_text: str = Field(max_length=200000)
    source_sha256: Digest
    segments: list[NormalizationSegment] = Field(max_length=200000)

    @model_validator(mode="after")
    def source_hash(self) -> Self:
        if text_digest(self.source_text) != self.source_sha256:
            raise ValueError("Source text digest mismatch")
        return self

    def validate_canonical(self, text: str) -> None:
        source_end = canonical_end = 0
        for item in self.segments:
            if item.source_start != source_end or item.canonical_start != canonical_end:
                raise ValueError("Normalization segments must cover contiguous ranges")
            if not item.source_start < item.source_end <= len(self.source_text):
                raise ValueError("Normalization source range outside text")
            if not item.canonical_start < item.canonical_end <= len(text):
                raise ValueError("Normalization canonical range outside text")
            source = self.source_text[item.source_start : item.source_end]
            if item.kind == "nfc":
                source = unicodedata.normalize("NFC", source)
            elif item.kind == "ligature":
                source = source.translate(LIGATURES)
            elif item.kind == "line_wrap":
                source = re.sub(r"[ \t]*(?:\r\n|\r|\n)[ \t]*", " ", source)
            if source != text[item.canonical_start : item.canonical_end]:
                raise ValueError("Declared normalization does not produce canonical text")
            source_end, canonical_end = item.source_end, item.canonical_end
        if source_end != len(self.source_text) or canonical_end != len(text):
            raise ValueError("Normalization does not account for all text")

    def source_boundary(self, offset: int) -> int:
        if type(offset) is not int or not 0 <= offset <= len(self.source_text):
            raise ValueError("Source offset outside text")
        if offset == 0:
            return 0
        for item in self.segments:
            if offset == item.source_start:
                return item.canonical_start
            if offset == item.source_end:
                return item.canonical_end
            if item.source_start < offset < item.source_end:
                if item.kind == "identity":
                    return item.canonical_start + offset - item.source_start
                raise ValueError("Offset inside a changed normalization span is ambiguous")
        raise ValueError("Unmapped source boundary")
