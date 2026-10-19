"""Descriptor shape is not possession of bytes or authority to publish them."""

from typing import Literal, Self

from pydantic import Field, model_validator

from .common import Digest, Id, Record, RelativePath, unique

FORMATS = {
    "SOURCE_PDF": ("PDF", "application/pdf"),
    "CANONICAL_BOOK": ("CANONICAL_JSON", "application/json"),
    "DERIVED_EPUB": ("EPUB", "application/epub+zip"),
    "DERIVED_READER": ("READER_PACKAGE", "application/json"),
    "VALIDATION_REPORT": ("REPORT_JSON", "application/json"),
    "DIAGNOSTIC": ("REPORT_JSON", "application/json"),
    "RESOURCE": ("IMAGE", None),
}


class Artifact(Record):
    id: Id
    role: Literal[
        "SOURCE_PDF",
        "CANONICAL_BOOK",
        "DERIVED_EPUB",
        "DERIVED_READER",
        "VALIDATION_REPORT",
        "DIAGNOSTIC",
        "RESOURCE",
    ]
    format: Literal["PDF", "CANONICAL_JSON", "EPUB", "READER_PACKAGE", "REPORT_JSON", "IMAGE"]
    media_type: Literal[
        "application/pdf", "application/json", "application/epub+zip", "image/png", "image/jpeg"
    ]
    path: RelativePath
    sha256: Digest
    byte_length: int = Field(ge=1, le=2147483648)

    @model_validator(mode="after")
    def role_format(self) -> Self:
        format_, media = FORMATS[self.role]
        if self.format != format_ or (media is not None and self.media_type != media):
            raise ValueError("Artifact role/format/media type mismatch")
        if self.role == "RESOURCE" and self.media_type not in {"image/png", "image/jpeg"}:
            raise ValueError("Resource must contain source-derived image bytes")
        if self.role == "SOURCE_PDF" and self.byte_length > 52428800:
            raise ValueError("Source PDF byte bound exceeded")
        return self


def require_role(artifact: Artifact, role: str) -> None:
    if artifact.role != role:
        raise ValueError("Artifact has the wrong semantic role")


def distinct_artifacts(artifacts: list[Artifact]) -> None:
    unique([a.id for a in artifacts], "artifact ID")
    unique([a.path for a in artifacts], "artifact path")


def bound_artifacts(artifacts: list[Artifact], limit: int = 2147483648) -> None:
    if sum(artifact.byte_length for artifact in artifacts) > limit:
        raise ValueError("Aggregate artifact byte bound exceeded")
