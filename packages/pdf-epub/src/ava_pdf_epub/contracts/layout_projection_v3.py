"""Projection receipts retain original ranges/hashes separately from canonical values."""

from typing import Literal

from pydantic import Field

from .common import Digest, Record


class LayoutTextProjectionReceipt(Record):
    coordinate_space: Literal["normalization_input", "raw_body"]
    source_pdf_sha256: Digest
    map_sha256: Digest
    source_text_sha256: Digest
    source_start: int = Field(ge=0, le=200000)
    source_end: int = Field(ge=0, le=200000)
    source_fragment_sha256: Digest
    canonical_start: int = Field(ge=0, le=200000)
    canonical_end: int = Field(ge=0, le=200000)
    canonical_fragment_sha256: Digest


class LayoutTextProjection(Record):
    text: str = Field(max_length=200000)
    receipt: LayoutTextProjectionReceipt
