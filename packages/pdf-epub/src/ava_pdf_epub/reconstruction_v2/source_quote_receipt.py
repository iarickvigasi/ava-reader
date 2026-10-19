"""Source offsets and immutable text identities for a narrow punctuation recovery."""

from typing import Literal

from pydantic import Field

from ..contracts.common import Digest, Id, Record


class SourceQuoteSubstitution(Record):
    offset: int = Field(ge=0, le=199999)
    line: int = Field(ge=0, le=9999)
    glyph: int = Field(ge=0, le=199999)


class SourceQuoteReceipt(Record):
    owner_id: Id
    original_sha256: Digest
    recovered_sha256: Digest
    observation_sha256: Digest
    observed: Literal["'"] = "'"
    recovered: Literal["’"] = "’"
    substitutions: list[SourceQuoteSubstitution] = Field(min_length=1, max_length=8)
