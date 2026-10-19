"""Version2 explicitly records hyphen decisions; historical normalization stays closed."""

from typing import Literal

from pydantic import Field, model_validator

from .common import Digest, Id, Record, text_digest
from .layout_hyphen import LayoutHyphenCandidate, LayoutHyphenDisposition
from .layout_hyphen_checks import qualify_layout_hyphens
from .layout_hyphen_derivation import LayoutHyphenDerivation
from .layout_hyphen_translation import validate_hyphen_derivations


class LayoutNormalizationSegment(Record):
    source_start: int = Field(ge=0, le=200000)
    source_end: int = Field(ge=0, le=200000)
    canonical_start: int = Field(ge=0, le=200000)
    canonical_end: int = Field(ge=0, le=200000)
    kind: Literal["identity", "nfc", "ligature", "line_wrap", "layout_hyphen"]
    candidate_id: Id | None = Field(default=None, exclude_if=lambda value: value is None)


class LayoutNormalizationMap(Record):
    schema_version: Literal["ava-source-normalization-2"]
    source_text: str = Field(max_length=200000)
    source_sha256: Digest
    source_pdf_sha256: Digest
    candidates: list[LayoutHyphenCandidate] = Field(min_length=1, max_length=10000)
    dispositions: list[LayoutHyphenDisposition] = Field(min_length=1, max_length=10000)
    derivations: list[LayoutHyphenDerivation] = Field(max_length=10000)
    segments: list[LayoutNormalizationSegment] = Field(max_length=200000)

    @model_validator(mode="after")
    def source_bindings(self) -> "LayoutNormalizationMap":
        if text_digest(self.source_text) != self.source_sha256:
            raise ValueError("Source text digest mismatch")
        qualify_layout_hyphens(
            self.source_text, self.source_pdf_sha256, self.candidates, self.dispositions
        )
        validate_hyphen_derivations(
            self.source_text, self.candidates, self.dispositions, self.derivations
        )
        return self

    def validate_canonical(self, text: str) -> None:
        from .layout_normalization_checks import validate_layout_normalization

        validate_layout_normalization(self, text)

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
