"""Map3 retains original classification and structural provenance under its own marker."""

from typing import Literal

from pydantic import Field, model_validator

from .common import Digest, Record, text_digest
from .layout_authority_checks_v3 import validate_owner_authorities
from .layout_hyphen_authority_v3 import LayoutHyphenAuthorityV3
from .layout_hyphen_v3 import LayoutOwnerRole
from .layout_input_v3 import layout_input_text
from .layout_normalization import LayoutNormalizationSegment
from .layout_prefix_cut_v3 import LayoutSourceCut
from .normalization import NormalizationMap, NormalizationSegment


class LayoutNormalizationMapV3(Record):
    schema_version: Literal["ava-source-normalization-3"]
    source_text: str = Field(max_length=200000)
    source_sha256: Digest
    source_pdf_sha256: Digest
    owner_role: LayoutOwnerRole
    original_source_text: str | None = Field(
        default=None, max_length=200000, exclude_if=lambda v: v is None
    )
    source_cuts: list[LayoutSourceCut] = Field(max_length=10000)
    authorities: list[LayoutHyphenAuthorityV3] = Field(min_length=1, max_length=10000)
    input_segments: list[NormalizationSegment] = Field(max_length=200000)
    input_text_sha256: Digest
    input_text_length: int = Field(ge=0, le=200000)
    segments: list[LayoutNormalizationSegment] = Field(max_length=200000)

    @model_validator(mode="after")
    def original_bindings(self) -> "LayoutNormalizationMapV3":
        if text_digest(self.source_text) != self.source_sha256:
            raise ValueError("Source text digest mismatch")
        original = (
            self.source_text if self.original_source_text is None else self.original_source_text
        )
        validate_owner_authorities(
            original,
            self.source_text,
            self.source_cuts,
            self.owner_role,
            self.source_pdf_sha256,
            self.authorities,
        )
        text = self.input_text()
        if text_digest(text) != self.input_text_sha256 or len(text) != self.input_text_length:
            raise ValueError("Pre-normalization input identity differs")
        return self

    def input_text(self) -> str:
        return layout_input_text(self.source_text, self.input_segments)

    def input_mapping(self) -> NormalizationMap:
        return NormalizationMap(
            source_text=self.source_text,
            source_sha256=self.source_sha256,
            segments=self.input_segments,
        )

    def validate_canonical(self, text: str) -> None:
        from .layout_segments import validate_layout_segments

        validate_layout_segments(
            self.source_text,
            text,
            self.segments,
            {a.candidate.id: a.body_range() for a in self.authorities},
        )

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
