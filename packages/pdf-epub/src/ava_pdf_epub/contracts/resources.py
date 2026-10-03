"""Immutable source-derived pixels; occurrences belong to separate figure nodes."""

from typing import Literal, Self

from pydantic import Field, model_validator

from .common import Digest, Id, Record, RelativePath
from .source import Evidence


class ImageResource(Record):
    id: Id
    path: RelativePath
    sha256: Digest
    byte_length: int = Field(ge=1, le=209715200)
    media_type: Literal["image/png", "image/jpeg"]
    width: int = Field(ge=1, le=6000)
    height: int = Field(ge=1, le=6000)
    evidence: list[Evidence] = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def pixel_limit(self) -> Self:
        if self.width * self.height > 20000000:
            raise ValueError("Decoded image pixel bound exceeded")
        return self
