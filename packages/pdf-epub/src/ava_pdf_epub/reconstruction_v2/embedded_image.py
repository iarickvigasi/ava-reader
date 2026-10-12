"""Private source-decoded asset proof; no source name or metadata becomes a book claim."""

from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Record


class EmbeddedImage(Record):
    sha256: Digest
    byte_length: int = Field(ge=1, le=1048576)
    width: int = Field(ge=1, le=1024)
    height: int = Field(ge=1, le=1024)
    media_type: Literal["image/png", "image/jpeg"]
    path: str = Field(pattern=r"^source-images/[0-9a-f]{64}\.(?:png|jpg)$")
    qualified: bool = Field(default=False, exclude_if=lambda v: not v)

    @model_validator(mode="after")
    def identity(self) -> "EmbeddedImage":
        suffix = "png" if self.media_type == "image/png" else "jpg"
        if (
            self.path != f"source-images/{self.sha256}.{suffix}"
            or self.width * self.height > 262144
        ):
            raise ValueError("Embedded image identity or pixel bound differs")
        return self
