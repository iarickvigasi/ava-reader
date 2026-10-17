"""Retain a provider's original pair authority separately from local group coordinates."""

from pydantic import Field, model_validator

from .common import Record
from .layout_hyphen import LayoutHyphenCandidate, LayoutHyphenDisposition
from .layout_hyphen_checks import qualify_layout_hyphens


class LayoutHyphenDerivation(Record):
    source_text: str = Field(max_length=200000)
    source_candidate: LayoutHyphenCandidate
    source_disposition: LayoutHyphenDisposition
    source_offset: int = Field(ge=0, le=200000)

    @model_validator(mode="after")
    def exact_pair_authority(self) -> "LayoutHyphenDerivation":
        candidate = self.source_candidate
        if candidate.left.source_start != 0 or candidate.right.source_end != len(self.source_text):
            raise ValueError("Layout-hyphen derivation requires the complete original source pair")
        qualify_layout_hyphens(
            self.source_text, candidate.source_sha256, [candidate], [self.source_disposition]
        )
        return self
